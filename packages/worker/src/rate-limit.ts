import type { Env } from "./types.js";

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const LIMITS: Record<string, { max: number; windowMs: number }> = {
	free: { max: 20, windowMs: 3600_000 },
	pro: { max: 200, windowMs: 3600_000 },
	team: { max: 1000, windowMs: 3600_000 },
};

/**
 * Check if a user has exceeded their rate limit.
 * Uses KV for lightweight distributed rate limiting.
 */
export async function checkRateLimit(
	userId: string,
	tier: string,
	env: Env,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
	const limit = LIMITS[tier] ?? LIMITS.free;
	const key = `ratelimit:${userId}`;

	const cached = await env.KV.get(key, "json") as RateLimitEntry | null;
	const now = Date.now();

	if (!cached || cached.resetAt < now) {
		const entry: RateLimitEntry = { count: 1, resetAt: now + limit.windowMs };
		await env.KV.put(key, JSON.stringify(entry), {
			expirationTtl: Math.ceil(limit.windowMs / 1000),
		});
		return { allowed: true, remaining: limit.max - 1, resetAt: entry.resetAt };
	}

	if (cached.count >= limit.max) {
		return { allowed: false, remaining: 0, resetAt: cached.resetAt };
	}

	cached.count++;
	await env.KV.put(key, JSON.stringify(cached), {
		expirationTtl: Math.ceil((cached.resetAt - now) / 1000),
	});
	return { allowed: true, remaining: limit.max - cached.count, resetAt: cached.resetAt };
}
