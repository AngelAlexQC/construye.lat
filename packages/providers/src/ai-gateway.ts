import type { ProviderAdapter, RetryOptions, CostEntry } from "./types.ts";
import type { ModelConfig, StreamChunk } from "@construye/shared";
import type { Message } from "@construye/shared";
import { DEFAULT_RETRY } from "./types.ts";

/**
 * AI Gateway routes all LLM calls through a single Cloudflare endpoint.
 * Handles caching, rate limiting, fallback, and logging.
 */
export class AIGateway implements ProviderAdapter {
	readonly name = "ai-gateway";
	private gatewayUrl: string;
	private providers: Map<string, ProviderAdapter>;

	constructor(gatewayUrl: string) {
		this.gatewayUrl = gatewayUrl;
		this.providers = new Map();
	}

	registerProvider(provider: ProviderAdapter): void {
		this.providers.set(provider.name, provider);
	}

	getProvider(name: string): ProviderAdapter | undefined {
		return this.providers.get(name);
	}

	async *stream(messages: Message[], model: ModelConfig): AsyncIterable<StreamChunk> {
		const provider = this.providers.get(model.provider);
		if (!provider) {
			throw new Error(`Provider "${model.provider}" not registered`);
		}
		yield* provider.stream(messages, model);
	}

	async countTokens(messages: Message[], model: ModelConfig): Promise<number> {
		const provider = this.providers.get(model.provider);
		if (!provider) {
			throw new Error(`Provider "${model.provider}" not registered`);
		}
		return provider.countTokens(messages, model);
	}
}
