import { describe, it, expect } from "vitest";
import { createJwt, verifyAuth } from "./auth.ts";

describe("JWT auth", () => {
	const secret = "test-secret-key-for-construye-testing-2025";

	it("createJwt produces a valid 3-part token", async () => {
		const token = await createJwt(
			{ userId: "u123", githubLogin: "testuser" },
			secret,
		);
		const parts = token.split(".");
		expect(parts.length).toBe(3);
		// Header should be base64url-encoded JSON with alg: HS256
		const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
		expect(header.alg).toBe("HS256");
		expect(header.typ).toBe("JWT");
	});

	it("createJwt → verifyAuth round-trip succeeds", async () => {
		const token = await createJwt(
			{ userId: "u456", githubLogin: "roundtrip" },
			secret,
		);

		const request = new Request("https://api.construye.lat/api/sessions", {
			headers: { Authorization: `Bearer ${token}` },
		});

		const env = { JWT_SECRET: secret } as never;
		const payload = await verifyAuth(request, env);

		expect(payload).not.toBeNull();
		expect(payload!.userId).toBe("u456");
		expect(payload!.githubLogin).toBe("roundtrip");
		expect(payload!.exp).toBeGreaterThan(Date.now() / 1000);
	});

	it("verifyAuth rejects missing Authorization header", async () => {
		const request = new Request("https://api.construye.lat/api/sessions");
		const env = { JWT_SECRET: secret } as never;
		const payload = await verifyAuth(request, env);
		expect(payload).toBeNull();
	});

	it("verifyAuth rejects malformed token", async () => {
		const request = new Request("https://api.construye.lat/api/sessions", {
			headers: { Authorization: "Bearer not.a.valid-token" },
		});
		const env = { JWT_SECRET: secret } as never;
		const payload = await verifyAuth(request, env);
		expect(payload).toBeNull();
	});

	it("verifyAuth rejects token signed with wrong secret", async () => {
		const token = await createJwt(
			{ userId: "u789", githubLogin: "wrong" },
			"wrong-secret",
		);

		const request = new Request("https://api.construye.lat/api/sessions", {
			headers: { Authorization: `Bearer ${token}` },
		});

		const env = { JWT_SECRET: secret } as never;
		const payload = await verifyAuth(request, env);
		expect(payload).toBeNull();
	});

	it("verifyAuth rejects expired token", async () => {
		// Create a token with 0 TTL (already expired)
		const token = await createJwt(
			{ userId: "expired", githubLogin: "old" },
			secret,
			-1, // negative TTL → already expired
		);

		const request = new Request("https://api.construye.lat/api/sessions", {
			headers: { Authorization: `Bearer ${token}` },
		});

		const env = { JWT_SECRET: secret } as never;
		const payload = await verifyAuth(request, env);
		expect(payload).toBeNull();
	});

	it("createJwt respects custom TTL", async () => {
		const token = await createJwt(
			{ userId: "ttl", githubLogin: "custom" },
			secret,
			3600, // 1 hour
		);

		const parts = token.split(".");
		const payloadJson = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
		const now = Math.floor(Date.now() / 1000);

		// exp should be approximately now + 3600 (within 5 seconds)
		expect(payloadJson.exp).toBeGreaterThan(now + 3595);
		expect(payloadJson.exp).toBeLessThan(now + 3605);
	});

	it("verifyAuth rejects non-Bearer scheme", async () => {
		const request = new Request("https://api.construye.lat/api/sessions", {
			headers: { Authorization: "Basic dXNlcjpwYXNz" },
		});
		const env = { JWT_SECRET: secret } as never;
		const payload = await verifyAuth(request, env);
		expect(payload).toBeNull();
	});
});
