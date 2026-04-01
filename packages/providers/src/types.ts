import type { ModelConfig, StreamChunk, TokenUsage } from "@construye/shared";
import type { Message } from "@construye/shared";

export interface ProviderAdapter {
	readonly name: string;
	stream(messages: Message[], model: ModelConfig, tools?: unknown[]): AsyncIterable<StreamChunk>;
	countTokens(messages: Message[], model: ModelConfig): Promise<number>;
}

export interface CostEntry {
	provider: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	costUsd: number;
	timestamp: number;
}

export interface RetryOptions {
	maxRetries: number;
	baseDelayMs: number;
	maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryOptions = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
};
