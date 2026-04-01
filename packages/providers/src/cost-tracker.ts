import type { CostEntry } from "./types.js";

const PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
	"claude-sonnet-4-20250514": { input: 3, output: 15 },
	"claude-3-5-haiku-20241022": { input: 1, output: 5 },
	"gpt-4o": { input: 2.5, output: 10 },
	"gpt-4o-mini": { input: 0.15, output: 0.6 },
};

export class CostTracker {
	private entries: CostEntry[] = [];

	record(provider: string, model: string, input: number, output: number): CostEntry {
		const pricing = PRICE_PER_MILLION[model] ?? { input: 1, output: 3 };
		const costUsd =
			(input / 1_000_000) * pricing.input +
			(output / 1_000_000) * pricing.output;

		const entry: CostEntry = {
			provider,
			model,
			inputTokens: input,
			outputTokens: output,
			costUsd,
			timestamp: Date.now(),
		};
		this.entries.push(entry);
		return entry;
	}

	getSessionTotal(): number {
		return this.entries.reduce((sum, e) => sum + e.costUsd, 0);
	}

	getEntries(): readonly CostEntry[] {
		return this.entries;
	}
}
