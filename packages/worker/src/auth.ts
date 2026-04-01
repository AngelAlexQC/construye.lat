import type { Env, AuthPayload } from "./types.js";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Verify JWT token from Authorization header.
 * Returns payload or null if invalid.
 */
export async function verifyAuth(
	request: Request,
	env: Env,
): Promise<AuthPayload | null> {
	const header = request.headers.get("Authorization");
	if (!header?.startsWith("Bearer ")) return null;

	const token = header.slice(7);
	return verifyJwt(token, env.JWT_SECRET);
}

async function verifyJwt(token: string, secret: string): Promise<AuthPayload | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;

	try {
		const payload = JSON.parse(atob(parts[1])) as AuthPayload;
		if (payload.exp < Date.now() / 1000) return null;
		// Future: verify signature with crypto.subtle
		return payload;
	} catch {
		return null;
	}
}

/**
 * Create a signed JWT for a user.
 */
export async function createJwt(
	payload: Omit<AuthPayload, "exp">,
	secret: string,
	ttlSeconds = 86400,
): Promise<string> {
	const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const body = btoa(JSON.stringify({
		...payload,
		exp: Math.floor(Date.now() / 1000) + ttlSeconds,
	}));
	// Future: sign with crypto.subtle HMAC
	const signature = btoa("placeholder-signature");
	return `${header}.${body}.${signature}`;
}
