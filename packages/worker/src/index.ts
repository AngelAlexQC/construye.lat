import type { Env, AuthPayload } from "./types.ts";
import { verifyAuth, createJwt } from "./auth.ts";
import { checkRateLimit } from "./rate-limit.ts";

/**
 * Main Worker entrypoint: routes HTTP requests to the right handler.
 * Handles auth, API routes, and WebSocket upgrades to Durable Objects.
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers for web dashboard
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders() });
		}

		if (url.pathname === "/health") {
			return json({ status: "ok", version: "0.2.0" });
		}

		if (url.pathname.startsWith("/auth/")) {
			return handleAuth(url, request, env);
		}

		if (url.pathname.startsWith("/api/")) {
			return handleApi(url, request, env);
		}

		return json({ error: "Not found", code: "NOT_FOUND", status: 404 }, 404);
	},
};

// Re-export the Durable Object class for wrangler
export { ConstruyeAgent } from "./agent.ts";

// --- Auth Routes ---

async function handleAuth(url: URL, req: Request, env: Env): Promise<Response> {
	if (url.pathname === "/auth/github") {
		const redirectUri = url.searchParams.get("redirect_uri") ?? "";
		const state = redirectUri ? encodeURIComponent(redirectUri) : "";
		const ghUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo${state ? `&state=${state}` : ""}`;
		return Response.redirect(ghUrl);
	}

	if (url.pathname === "/auth/github/callback" && req.method === "GET") {
		const code = url.searchParams.get("code");
		if (!code) return json({ error: "Missing code parameter", code: "BAD_REQUEST", status: 400 }, 400);

		// Exchange code for access token
		const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({
				client_id: env.GITHUB_CLIENT_ID,
				client_secret: env.GITHUB_CLIENT_SECRET,
				code,
			}),
		});
		const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
		if (!tokenData.access_token) {
			return json({ error: "GitHub OAuth failed", code: "AUTH_FAILED", status: 401 }, 401);
		}

		// Get GitHub user info
		const userRes = await fetch("https://api.github.com/user", {
			headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "construye-worker" },
		});
		const user = (await userRes.json()) as { id: number; login: string };

		// Create JWT
		const jwt = await createJwt(
			{ userId: String(user.id), githubLogin: user.login },
			env.JWT_SECRET,
		);

		// If state contains a redirect URI, redirect back to the web app with the token
		const state = url.searchParams.get("state");
		if (state) {
			const redirectUri = decodeURIComponent(state);
			const sep = redirectUri.includes("?") ? "&" : "?";
			return Response.redirect(`${redirectUri}${sep}token=${jwt}&user=${encodeURIComponent(user.login)}`);
		}

		return json({ token: jwt, user: { id: user.id, login: user.login } });
	}

	return json({ error: "Unknown auth route", code: "NOT_FOUND", status: 404 }, 404);
}

// --- API Routes (require auth) ---

async function handleApi(url: URL, req: Request, env: Env): Promise<Response> {
	const auth = await verifyAuth(req, env);
	if (!auth) {
		return json({ error: "Unauthorized", code: "UNAUTHORIZED", status: 401 }, 401);
	}

	// Rate limiting
	const rateLimit = await checkRateLimit(auth.userId, "free", env);
	if (!rateLimit.allowed) {
		return json(
			{ error: "Rate limit exceeded", code: "RATE_LIMITED", status: 429, resetAt: rateLimit.resetAt },
			429,
		);
	}

	const path = url.pathname.replace("/api/", "");

	// --- Sessions ---
	if (path === "sessions" && req.method === "POST") {
		return createSession(auth, env);
	}
	if (path === "sessions" && req.method === "GET") {
		return listSessions(auth, env);
	}
	const sessionMatch = path.match(/^sessions\/([a-zA-Z0-9_-]+)$/);
	if (sessionMatch) {
		const sessionId = sessionMatch[1];
		if (req.method === "GET") return getSession(sessionId, auth, env);
		if (req.method === "DELETE") return deleteSession(sessionId, auth, env);
	}

	// --- Sessions: WebSocket upgrade ---
	const wsMatch = path.match(/^sessions\/([a-zA-Z0-9_-]+)\/ws$/);
	if (wsMatch) {
		return upgradeToWebSocket(wsMatch[1], auth, env);
	}

	// --- Projects ---
	if (path === "projects" && req.method === "POST") {
		return createProject(auth, req, env);
	}
	if (path === "projects" && req.method === "GET") {
		return listProjects(auth, env);
	}
	const projectMatch = path.match(/^projects\/([a-zA-Z0-9_-]+)$/);
	if (projectMatch) {
		const projectId = projectMatch[1];
		if (req.method === "GET") return getProject(projectId, auth, env);
		if (req.method === "DELETE") return deleteProject(projectId, auth, env);
	}

	// --- Usage ---
	if (path === "usage" && req.method === "GET") {
		return getUsage(auth, env);
	}

	return json({ error: "Not found", code: "NOT_FOUND", status: 404 }, 404);
}

// --- Session handlers ---

async function createSession(auth: AuthPayload, env: Env): Promise<Response> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	await env.DB.prepare(
		`INSERT INTO sessions (id, project_id, user_id, status, mode, model, total_tokens, total_cost_cents, started_at)
		 VALUES (?, '', ?, 'active', 'interactive', '@cf/moonshot/kimi-k2.5', 0, 0, ?)`,
	).bind(id, auth.userId, now).run();
	return json({ id, status: "active", started_at: now }, 201);
}

async function listSessions(auth: AuthPayload, env: Env): Promise<Response> {
	const result = await env.DB.prepare(
		"SELECT id, project_id, status, mode, model, total_tokens, total_cost_cents, started_at, ended_at FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 50",
	).bind(auth.userId).all();
	return json({ sessions: result.results });
}

async function getSession(id: string, auth: AuthPayload, env: Env): Promise<Response> {
	const row = await env.DB.prepare(
		"SELECT * FROM sessions WHERE id = ? AND user_id = ?",
	).bind(id, auth.userId).first();
	if (!row) return json({ error: "Session not found", code: "NOT_FOUND", status: 404 }, 404);
	return json(row);
}

async function deleteSession(id: string, auth: AuthPayload, env: Env): Promise<Response> {
	await env.DB.prepare(
		"DELETE FROM sessions WHERE id = ? AND user_id = ?",
	).bind(id, auth.userId).run();
	return json({ deleted: true });
}

// --- WebSocket upgrade to Durable Object ---

async function upgradeToWebSocket(
	sessionId: string,
	auth: AuthPayload,
	env: Env,
): Promise<Response> {
	// Verify session belongs to user
	const session = await env.DB.prepare(
		"SELECT id FROM sessions WHERE id = ? AND user_id = ?",
	).bind(sessionId, auth.userId).first();
	if (!session) {
		return json({ error: "Session not found", code: "NOT_FOUND", status: 404 }, 404);
	}

	// Get or create Durable Object for this session
	const doId = env.AGENT.idFromName(sessionId);
	const stub = env.AGENT.get(doId);

	// Forward the WebSocket upgrade request to the DO
	const doUrl = new URL(`/ws?sessionId=${sessionId}&userId=${auth.userId}`, "https://agent.internal");
	return stub.fetch(doUrl.toString(), {
		headers: { Upgrade: "websocket" },
	});
}

// --- Project handlers ---

async function createProject(auth: AuthPayload, req: Request, env: Env): Promise<Response> {
	const body = (await req.json()) as { name: string; repo_url?: string };
	if (!body.name || typeof body.name !== "string") {
		return json({ error: "name is required", code: "BAD_REQUEST", status: 400 }, 400);
	}
	const id = crypto.randomUUID();
	const r2Prefix = `projects/${auth.userId}/${id}`;
	await env.DB.prepare(
		`INSERT INTO projects (id, user_id, name, repo_url, r2_prefix, config)
		 VALUES (?, ?, ?, ?, ?, '{}')`,
	).bind(id, auth.userId, body.name, body.repo_url ?? null, r2Prefix).run();
	return json({ id, name: body.name, r2_prefix: r2Prefix }, 201);
}

async function listProjects(auth: AuthPayload, env: Env): Promise<Response> {
	const result = await env.DB.prepare(
		"SELECT id, name, repo_url, r2_prefix FROM projects WHERE user_id = ? ORDER BY name",
	).bind(auth.userId).all();
	return json({ projects: result.results });
}

async function getProject(id: string, auth: AuthPayload, env: Env): Promise<Response> {
	const row = await env.DB.prepare(
		"SELECT * FROM projects WHERE id = ? AND user_id = ?",
	).bind(id, auth.userId).first();
	if (!row) return json({ error: "Project not found", code: "NOT_FOUND", status: 404 }, 404);
	return json(row);
}

async function deleteProject(id: string, auth: AuthPayload, env: Env): Promise<Response> {
	await env.DB.prepare(
		"DELETE FROM projects WHERE id = ? AND user_id = ?",
	).bind(id, auth.userId).run();
	return json({ deleted: true });
}

// --- Usage ---

async function getUsage(auth: AuthPayload, env: Env): Promise<Response> {
	const result = await env.DB.prepare(
		`SELECT SUM(total_tokens) as total_tokens, SUM(total_cost_cents) as total_cost_cents, COUNT(*) as session_count
		 FROM sessions WHERE user_id = ?`,
	).bind(auth.userId).first();
	return json(result ?? { total_tokens: 0, total_cost_cents: 0, session_count: 0 });
}

// --- Helpers ---

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json", ...corsHeaders() },
	});
}

function corsHeaders(): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
	};
}
