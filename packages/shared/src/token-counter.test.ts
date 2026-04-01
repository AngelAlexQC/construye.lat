import { describe, it, expect } from "vitest";
import { estimateTokens, estimateMessagesTokens, wouldExceedBudget } from "./token-counter.ts";
import { CHARS_PER_TOKEN } from "./constants.ts";

describe("token-counter", () => {
	describe("estimateTokens", () => {
		it("returns 0 for empty string", () => {
			expect(estimateTokens("")).toBe(0);
		});

		it("estimates tokens based on character count", () => {
			const text = "a".repeat(100);
			expect(estimateTokens(text)).toBe(Math.ceil(100 / CHARS_PER_TOKEN));
		});

		it("handles multi-line text", () => {
			const text = "line1\nline2\nline3";
			expect(estimateTokens(text)).toBeGreaterThan(0);
		});
	});

	describe("estimateMessagesTokens", () => {
		it("returns 0 for empty array", () => {
			expect(estimateMessagesTokens([])).toBe(0);
		});

		it("sums tokens across messages including overhead", () => {
			const messages = [
				{ role: "user" as const, content: "hello world" },
				{ role: "assistant" as const, content: "hi there" },
			];
			const total = estimateMessagesTokens(messages);
			expect(total).toBeGreaterThan(0);
			// Each message adds estimateTokens(content) + 4 overhead
			const expected = estimateTokens("hello world") + 4 + estimateTokens("hi there") + 4;
			expect(total).toBe(expected);
		});

		it("handles messages without content", () => {
			const messages = [
				{ role: "assistant" as const, content: "" },
			];
			expect(estimateMessagesTokens(messages)).toBe(4); // empty content still has per-message overhead
		});
	});

	describe("wouldExceedBudget", () => {
		it("returns true when adding content would exceed threshold", () => {
			// 100 current tokens + ~25 new tokens ("a" * 100 / 4) = 125 > 100 * 0.80 = 80
			expect(wouldExceedBudget(100, "a".repeat(100), 150)).toBe(true);
		});

		it("returns false when within threshold", () => {
			// 10 current tokens + ~3 new tokens = 13 < 1000 * 0.80 = 800
			expect(wouldExceedBudget(10, "hello", 1000)).toBe(false);
		});

		it("respects custom threshold", () => {
			// 50 current + 25 new = 75 < 100 * 1.0 = 100 → false
			expect(wouldExceedBudget(50, "a".repeat(100), 100, 1.0)).toBe(false);
			// 50 current + 25 new = 75 > 100 * 0.5 = 50 → true
			expect(wouldExceedBudget(50, "a".repeat(100), 100, 0.5)).toBe(true);
		});
	});
});
