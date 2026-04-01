import type { ProviderAdapter } from "./types.js";
import type { ModelConfig, StreamChunk, Message, ToolCall } from "@construye/shared";
import { estimateMessagesTokens } from "@construye/shared";

export class ClaudeProvider implements ProviderAdapter {
	readonly name = "anthropic";
	private apiKey: string;
	private baseUrl: string;

	constructor(apiKey: string, baseUrl = "https://api.anthropic.com") {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl;
	}

	async *stream(messages: Message[], model: ModelConfig, tools?: unknown[]): AsyncIterable<StreamChunk> {
		const systemMsg = messages.find((m) => m.role === "system");
		const nonSystem = messages.filter((m) => m.role !== "system");

		const anthropicMessages = nonSystem.map((m) => {
			if (m.role === "tool") {
				return {
					role: "user" as const,
					content: [
						{
							type: "tool_result" as const,
							tool_use_id: m.tool_call_id,
							content: m.content,
						},
					],
				};
			}
			if (m.role === "assistant" && m.tool_calls?.length) {
				const content: unknown[] = [];
				if (m.content) content.push({ type: "text", text: m.content });
				for (const tc of m.tool_calls) {
					content.push({
						type: "tool_use",
						id: tc.id,
						name: tc.name,
						input: tc.arguments,
					});
				}
				return { role: "assistant" as const, content };
			}
			return { role: m.role as "user" | "assistant", content: m.content };
		});

		const body: Record<string, unknown> = {
			model: model.model,
			max_tokens: model.max_tokens ?? 8192,
			stream: true,
			messages: anthropicMessages,
		};

		if (systemMsg) body.system = systemMsg.content;
		if (model.temperature !== undefined) body.temperature = model.temperature;

		if (tools && Array.isArray(tools) && tools.length > 0) {
			body.tools = tools;
		}

		const response = await fetch(`${this.baseUrl}/v1/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"anthropic-version": "2023-06-01",
				"x-api-key": this.apiKey,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errText = await response.text();
			yield { type: "error", error: `Anthropic API ${response.status}: ${errText}` };
			return;
		}

		if (!response.body) {
			yield { type: "error", error: "No response body" };
			return;
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let currentToolCall: Partial<ToolCall> | null = null;
		let toolInputJson = "";

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const data = line.slice(6).trim();
					if (data === "[DONE]") continue;

					let event: Record<string, unknown>;
					try {
						event = JSON.parse(data);
					} catch {
						continue;
					}

					const eventType = event.type as string;

					if (eventType === "content_block_start") {
						const block = event.content_block as Record<string, unknown>;
						if (block?.type === "tool_use") {
							currentToolCall = {
								id: block.id as string,
								name: block.name as string,
								arguments: {},
							};
							toolInputJson = "";
						}
					}

					if (eventType === "content_block_delta") {
						const delta = event.delta as Record<string, unknown>;
						if (delta?.type === "text_delta") {
							yield { type: "text", content: delta.text as string };
						}
						if (delta?.type === "input_json_delta") {
							toolInputJson += delta.partial_json as string;
						}
					}

					if (eventType === "content_block_stop") {
						if (currentToolCall) {
							try {
								currentToolCall.arguments = JSON.parse(toolInputJson || "{}");
							} catch {
								currentToolCall.arguments = {};
							}
							yield {
								type: "tool_call",
								tool_call: currentToolCall as ToolCall,
							};
							currentToolCall = null;
							toolInputJson = "";
						}
					}

					if (eventType === "message_delta") {
						const usage = (event.usage as Record<string, number>) ?? {};
						if (usage.output_tokens) {
							yield {
								type: "done",
								usage: {
									input_tokens: 0,
									output_tokens: usage.output_tokens,
									cost_cents: 0,
								},
							};
						}
					}

					if (eventType === "message_start") {
						const msgUsage = ((event.message as Record<string, unknown>)?.usage as Record<string, number>) ?? {};
						if (msgUsage.input_tokens) {
							yield {
								type: "done",
								usage: {
									input_tokens: msgUsage.input_tokens,
									output_tokens: 0,
									cost_cents: 0,
								},
							};
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	async countTokens(messages: Message[], _model: ModelConfig): Promise<number> {
		return estimateMessagesTokens(messages);
	}
}
