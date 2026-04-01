import type { RetryOptions } from "./types.js";
import { DEFAULT_RETRY } from "./types.js";

export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = DEFAULT_RETRY,
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === options.maxRetries) break;
			if (!isRetryable(lastError)) break;

			const delay = Math.min(
				options.baseDelayMs * 2 ** attempt,
				options.maxDelayMs,
			);
			await sleep(delay + Math.random() * delay * 0.1);
		}
	}

	throw lastError;
}

function isRetryable(error: Error): boolean {
	const message = error.message.toLowerCase();
	return (
		message.includes("rate limit") ||
		message.includes("timeout") ||
		message.includes("503") ||
		message.includes("429") ||
		message.includes("overloaded")
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
