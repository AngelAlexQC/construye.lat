import type { Env } from "./types.ts";

/**
 * Main Worker entrypoint: routes HTTP requests to the right handler.
 * Handles auth, API routes, and WebSocket upgrades to Durable Objects.
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			return json({ status: "ok", version: "0.1.0" });
		}

		if (url.pathname.startsWith("/auth/")) {
			return handleAuth(url.pathname, request, env);
		}

		if (url.pathname.startsWith("/api/")) {
			return handleApi(url.pathname, request, env);
		}

		return json({ error: "Not found", code: "NOT_FOUND", status: 404 }, 404);
	},
};

async function handleAuth(path: string, _req: Request, env: Env): Promise<Response> {
	if (path === "/auth/github") {
		return Response.redirect(
			`https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo`,
		);
	}
	return json({ error: "Unknown auth route", code: "NOT_FOUND", status: 404 }, 404);
}

async function handleApi(_path: string, _req: Request, _env: Env): Promise<Response> {
	// Future: session CRUD, project management, agent invocation
	return json({ error: "Not implemented", code: "NOT_IMPL", status: 501 }, 501);
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
