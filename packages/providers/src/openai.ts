import type { ProviderAdapter } from "./types.js";
import type { ModelConfig, StreamChunk, Message } from "@construye/shared";
import { estimateMessagesTokens } from "@construye/shared";

export class OpenAIProvider implements ProviderAdapter {
	readonly name = "openai";
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async *stream(messages: Message[], model: ModelConfig, _tools?: unknown[]): AsyncIterable<StreamChunk> {
		yield {
			type: "text",
			content: `[OpenAI ${model.model}: streaming not yet implemented]`,
		};
	}

	async countTokens(messages: Message[], _model: ModelConfig): Promise<number> {
		return estimateMessagesTokens(messages);
	}
}
