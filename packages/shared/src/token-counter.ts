import { CHARS_PER_TOKEN } from "./constants.js";

/** Estimate token count for a string (rough: ~4 chars per token) */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimate tokens for a message array */
export function estimateMessagesTokens(
	messages: Array<{ content: string }>,
): number {
	let total = 0;
	for (const msg of messages) {
		total += estimateTokens(msg.content) + 4; // overhead per message
	}
	return total;
}

/** Check if adding content would exceed the budget */
export function wouldExceedBudget(
	currentTokens: number,
	newContent: string,
	maxTokens: number,
	threshold = 0.80,
): boolean {
	const newTokens = estimateTokens(newContent);
	return (currentTokens + newTokens) > (maxTokens * threshold);
}
