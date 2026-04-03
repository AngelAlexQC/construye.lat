import type { Env, AuthPayload } from "./types.ts";

const ENCODER = new TextEncoder();

/**
 * Import a secret string as an HMAC CryptoKey for JWT signing/verification.
 */
async function importKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		ENCODER.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

/** URL-safe base64 encode */
function base64url(data: ArrayBuffer | Uint8Array | string): string {
	const input = typeof data === "string" ? data : String.fromCharCode(...new Uint8Array(data));
	return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** URL-safe base64 decode to string */
function base64urlDecode(str: string): string {
	const padded = str.replace(/-/g, "+").replace(/_/g, "/");
	return atob(padded);
}

/**
 * Verify JWT token from Authorization header or query parameter.
 * Returns payload or null if invalid.
 */
export async function verifyAuth(
	request: Request,
	env: Env,
): Promise<AuthPayload | null> {
	// Try Authorization header first
	const header = request.headers.get("Authorization");
	if (header?.startsWith("Bearer ")) {
		return verifyJwt(header.slice(7), env.JWT_SECRET);
	}

	// Fallback to query param (needed for WebSocket upgrades from browsers)
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	if (token) {
		return verifyJwt(token, env.JWT_SECRET);
	}

	return null;
}

async function verifyJwt(token: string, secret: string): Promise<AuthPayload | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;

	try {
		const key = await importKey(secret);
		const signingInput = ENCODER.encode(`${parts[0]}.${parts[1]}`);
		const signature = Uint8Array.from(base64urlDecode(parts[2]), (c) => c.charCodeAt(0));

		const valid = await crypto.subtle.verify("HMAC", key, signature, signingInput);
		if (!valid) return null;

		const payload = JSON.parse(base64urlDecode(parts[1])) as AuthPayload;
		if (payload.exp < Date.now() / 1000) return null;
		return payload;
	} catch {
		return null;
	}
}

/**
 * Create a signed JWT for a user using HMAC-SHA256.
 */
export async function createJwt(
	payload: Omit<AuthPayload, "exp">,
	secret: string,
	ttlSeconds = 86400,
): Promise<string> {
	const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const body = base64url(JSON.stringify({
		...payload,
		exp: Math.floor(Date.now() / 1000) + ttlSeconds,
	}));
	const signingInput = ENCODER.encode(`${header}.${body}`);
	const key = await importKey(secret);
	const sig = await crypto.subtle.sign("HMAC", key, signingInput);
	const signature = base64url(sig);
	return `${header}.${body}.${signature}`;
}
