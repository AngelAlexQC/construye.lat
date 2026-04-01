import { describe, it, expect } from "vitest";
import { CostTracker } from "./cost-tracker.ts";

describe("CostTracker", () => {
	it("starts with zero total", () => {
		const tracker = new CostTracker();
		expect(tracker.getSessionTotal()).toBe(0);
		expect(tracker.getEntries()).toEqual([]);
	});

	it("records an entry with correct cost calculation", () => {
		const tracker = new CostTracker();
		const entry = tracker.record("openai", "gpt-4o", 1_000_000, 1_000_000);
		// gpt-4o: $2.5/M input + $10/M output
		expect(entry.costUsd).toBeCloseTo(12.5, 2);
		expect(entry.inputTokens).toBe(1_000_000);
		expect(entry.outputTokens).toBe(1_000_000);
		expect(entry.provider).toBe("openai");
		expect(entry.model).toBe("gpt-4o");
		expect(entry.timestamp).toBeGreaterThan(0);
	});

	it("uses fallback pricing for unknown models", () => {
		const tracker = new CostTracker();
		const entry = tracker.record("workers-ai", "@cf/moonshot/kimi-k2.5", 500_000, 100_000);
		// fallback: $1/M input + $3/M output => 0.5 + 0.3 = 0.8
		expect(entry.costUsd).toBeCloseTo(0.8, 4);
	});

	it("accumulates session total across entries", () => {
		const tracker = new CostTracker();
		tracker.record("openai", "gpt-4o-mini", 100_000, 50_000);
		tracker.record("openai", "gpt-4o-mini", 200_000, 100_000);
		// gpt-4o-mini: $0.15/M input + $0.6/M output
		// Entry 1: (0.1 * 0.15) + (0.05 * 0.6) = 0.015 + 0.03 = 0.045
		// Entry 2: (0.2 * 0.15) + (0.1 * 0.6) = 0.03 + 0.06 = 0.09
		expect(tracker.getSessionTotal()).toBeCloseTo(0.135, 4);
		expect(tracker.getEntries()).toHaveLength(2);
	});

	it("entries are readonly", () => {
		const tracker = new CostTracker();
		tracker.record("test", "model", 100, 100);
		const entries = tracker.getEntries();
		expect(entries).toHaveLength(1);
	});
});
