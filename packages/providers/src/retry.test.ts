import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry.ts";

describe("withRetry", () => {
	it("returns result on first success", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("retries on retryable errors", async () => {
		const fn = vi.fn()
			.mockRejectedValueOnce(new Error("rate limit exceeded"))
			.mockResolvedValue("recovered");
		const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });
		expect(result).toBe("recovered");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("does not retry non-retryable errors", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("invalid input"));
		await expect(
			withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 }),
		).rejects.toThrow("invalid input");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("throws after exhausting retries", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("503 service unavailable"));
		await expect(
			withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 }),
		).rejects.toThrow("503 service unavailable");
		expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
	});

	it("retries on timeout errors", async () => {
		const fn = vi.fn()
			.mockRejectedValueOnce(new Error("request timeout"))
			.mockRejectedValueOnce(new Error("429 too many requests"))
			.mockResolvedValue("success");
		const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });
		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("retries on overloaded errors", async () => {
		const fn = vi.fn()
			.mockRejectedValueOnce(new Error("model overloaded"))
			.mockResolvedValue("done");
		const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 });
		expect(result).toBe("done");
	});
});
