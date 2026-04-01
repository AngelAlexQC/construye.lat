import type { ProviderAdapter } from "./types.js";
import type { ModelConfig, StreamChunk, Message, ToolCall } from "@construye/shared";
import { estimateMessagesTokens } from "@construye/shared";

/** Default models available on Workers AI with tool calling support */
export const WORKERS_AI_MODELS = {
	"qwen-coder": "@cf/qwen/qwen2.5-coder-32b-instruct",
	"llama-3.3": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
	"llama-3.1": "@cf/meta/llama-3.1-70b-instruct",
	"llama-3.1-8b": "@cf/meta/llama-3.1-8b-instruct",
	"deepseek-r1": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
	"hermes-2-pro": "@hf/nousresearch/hermes-2-pro-mistral-7b",
	"qwen-2.5": "@cf/qwen/qwen2.5-72b-instruct",
	"gpt-oss-120b": "@cf/openai/gpt-oss-120b",
};

/** System prompt optimized for Workers AI function calling models */
const SYSTEM_PROMPT = `You are construye.lat, an expert AI coding agent.
You have access to tools for filesystem operations and shell commands.
When the user asks you to do something, use the appropriate tools.
Always respond concisely. When using tools, call them directly.`;

/**
 * Workers AI provider — hybrid approach:
 * - NON-streaming when tools are present (reliable structured tool_calls)
 * - Streaming for pure text generation
 */
export class WorkersAIProvider implements ProviderAdapter {
	readonly name = "workers-ai";
	private accountId: string;
	private apiToken: string;
	private baseUrl: string;

	constructor(accountId: string, apiToken: string) {
		this.accountId = accountId;
		this.apiToken = apiToken;
		this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
	}

	private lastToolCalls: string[] = [];
	private consecutiveToolRepeats = 0;

	async *stream(messages: Message[], model: ModelConfig, tools?: unknown[]): AsyncIterable<StreamChunk> {
		const modelId = this.resolveModel(model.model);
		const openAiMessages = this.toOpenAIMessages(messages);
		const hasTools = tools && Array.isArray(tools) && tools.length > 0;

		// Detect tool call loops: if last 2+ tool calls were identical, force text-only
		const forceTextOnly = this.consecutiveToolRepeats >= 2;
		if (forceTextOnly) {
			this.debug(`Loop detected (${this.consecutiveToolRepeats} repeats), forcing text-only`);
			this.consecutiveToolRepeats = 0;
			this.lastToolCalls = [];
		}

		if (hasTools && !forceTextOnly) {
			// NON-STREAMING: reliable structured tool_calls from Workers AI
			yield* this.nonStreamingWithTools(openAiMessages, modelId, model, tools);
		} else {
			// Text-only: either no tools or forced by loop detection
			yield* this.nonStreamingText(openAiMessages, modelId, model);
		}
	}

	/** Track tool calls for loop detection */
	private trackToolCalls(calls: ToolCall[]): void {
		const signature = calls.map(c => `${c.name}:${JSON.stringify(c.arguments)}`).sort().join("|");
		const lastSig = this.lastToolCalls.join("|");
		if (signature === lastSig) {
			this.consecutiveToolRepeats++;
		} else {
			this.consecutiveToolRepeats = 1;
			this.lastToolCalls = [signature];
		}
	}

	/** Non-streaming request — Workers AI returns structured tool_calls */
	private async *nonStreamingWithTools(
		messages: unknown[], modelId: string, model: ModelConfig, tools: unknown[],
	): AsyncIterable<StreamChunk> {
		const body: Record<string, unknown> = {
			model: modelId,
			messages,
			stream: false,
			tools: this.toOpenAITools(tools),
		};
		if (model.max_tokens) body.max_tokens = model.max_tokens;
		if (model.temperature !== undefined) body.temperature = model.temperature;

		this.debug(`NON-STREAM request: model=${modelId}, tools=${(body.tools as unknown[]).length}`);

		const resp = await this.fetchAPI(body);
		if (!resp.ok) {
			yield { type: "error", error: `Workers AI ${resp.status}: ${await resp.text()}` };
			return;
		}

		const json = await resp.json() as Record<string, unknown>;
		const choices = json.choices as Array<Record<string, unknown>> | undefined;
		this.debug(`Full response keys: ${Object.keys(json).join(", ")}`);
		if (!choices?.length) {
			this.debug(`No choices. Response: ${JSON.stringify(json).slice(0, 500)}`);
			yield { type: "error", error: "No choices in Workers AI response" };
			return;
		}

		const msg = choices[0].message as Record<string, unknown>;
		this.debug(`Response: content=${!!msg.content}, tool_calls=${!!(msg.tool_calls)}`);

		// Emit text content
		if (msg.content && typeof msg.content === "string") {
			yield { type: "text", content: msg.content };
		}

		// Emit structured tool calls
		const rawToolCalls = msg.tool_calls as Array<Record<string, unknown>> | undefined;
		const emittedCalls: ToolCall[] = [];
		if (rawToolCalls?.length) {
			for (const tc of rawToolCalls) {
				const toolCall = this.parseToolCall(tc);
				if (toolCall) {
					this.debug(`Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
					emittedCalls.push(toolCall);
					yield { type: "tool_call", tool_call: toolCall };
				}
			}
		} else if (msg.content && typeof msg.content === "string") {
			// Fallback: some models embed tool calls in text
			const extracted = this.extractToolCallsFromText(msg.content);
			for (const tc of extracted) {
				emittedCalls.push(tc);
				yield { type: "tool_call", tool_call: tc };
			}
		}

		// Track for loop detection
		if (emittedCalls.length > 0) {
			this.trackToolCalls(emittedCalls);
		} else {
			this.consecutiveToolRepeats = 0;
			this.lastToolCalls = [];
		}

		const usage = json.usage as Record<string, number> | undefined;
		yield {
			type: "done",
			usage: {
				input_tokens: usage?.prompt_tokens ?? 0,
				output_tokens: usage?.completion_tokens ?? 0,
				cost_cents: 0,
			},
		};
	}

	/** Non-streaming text request — no tools, forces text synthesis */
	private async *nonStreamingText(
		messages: unknown[], modelId: string, model: ModelConfig,
	): AsyncIterable<StreamChunk> {
		const body: Record<string, unknown> = {
			model: modelId,
			messages,
			stream: false,
		};
		if (model.max_tokens) body.max_tokens = model.max_tokens;
		if (model.temperature !== undefined) body.temperature = model.temperature;

		this.debug(`NON-STREAM text request: model=${modelId}, messages=${(messages as unknown[]).length}`);

		const resp = await this.fetchAPI(body);
		if (!resp.ok) {
			yield { type: "error", error: `Workers AI ${resp.status}: ${await resp.text()}` };
			return;
		}

		const json = await resp.json() as Record<string, unknown>;
		const choices = json.choices as Array<Record<string, unknown>> | undefined;
		if (!choices?.length) {
			this.debug(`No choices. Response: ${JSON.stringify(json).slice(0, 500)}`);
			yield { type: "error", error: "No choices in Workers AI response" };
			return;
		}

		const msg = choices[0].message as Record<string, unknown>;
		this.debug(`Text response: ${(msg.content as string)?.slice(0, 100)}...`);

		if (msg.content && typeof msg.content === "string") {
			yield { type: "text", content: msg.content };
		}

		const usage = json.usage as Record<string, number> | undefined;
		yield {
			type: "done",
			usage: {
				input_tokens: usage?.prompt_tokens ?? 0,
				output_tokens: usage?.completion_tokens ?? 0,
				cost_cents: 0,
			},
		};
	}

	/** Streaming request — pure text, no tools */
	private async *streamingText(
		messages: unknown[], modelId: string, model: ModelConfig,
	): AsyncIterable<StreamChunk> {
		const body: Record<string, unknown> = {
			model: modelId,
			messages,
			stream: true,
		};
		if (model.max_tokens) body.max_tokens = model.max_tokens;
		if (model.temperature !== undefined) body.temperature = model.temperature;

		const resp = await this.fetchAPI(body);
		if (!resp.ok) {
			yield { type: "error", error: `Workers AI ${resp.status}: ${await resp.text()}` };
			return;
		}
		if (!resp.body) {
			yield { type: "error", error: "No response body from Workers AI" };
			return;
		}

		const reader = resp.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

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
					if (data === "[DONE]") {
						yield { type: "done", usage: { input_tokens: 0, output_tokens: 0, cost_cents: 0 } };
						return;
					}
					try {
						const chunk = JSON.parse(data) as Record<string, unknown>;
						const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
						const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
						if (delta?.content && typeof delta.content === "string") {
							yield { type: "text", content: delta.content };
						}
					} catch { /* skip malformed */ }
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	/** Parse a tool call from OpenAI format or Workers AI native format */
	private parseToolCall(tc: Record<string, unknown>): ToolCall | null {
		// OpenAI format: { id, type: "function", function: { name, arguments } }
		const fn = tc.function as Record<string, string> | undefined;
		if (fn?.name) {
			let args: Record<string, unknown> = {};
			try { args = JSON.parse(fn.arguments || "{}"); } catch { /* empty */ }
			return { id: (tc.id as string) ?? `tc_${Date.now()}`, name: fn.name, arguments: args };
		}
		// Workers AI native: { name, arguments: {...} }
		if (tc.name && typeof tc.name === "string") {
			const args = typeof tc.arguments === "string"
				? JSON.parse(tc.arguments)
				: (tc.arguments as Record<string, unknown>) ?? {};
			return { id: `tc_${Date.now()}`, name: tc.name, arguments: args };
		}
		return null;
	}

	/** Fallback: extract tool calls from text when model doesn't use structured format */
	private extractToolCallsFromText(text: string): ToolCall[] {
		const results: ToolCall[] = [];
		// Pattern: {"name": "tool_name", "arguments": {...}}
		const regex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]+\})\s*\}/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(text)) !== null) {
			try {
				const args = JSON.parse(match[2]);
				results.push({ id: `tc_${Date.now()}_${results.length}`, name: match[1], arguments: args });
			} catch { /* skip */ }
		}
		return results;
	}

	private resolveModel(model: string): string {
		if (model.startsWith("@cf/") || model.startsWith("@hf/")) return model;
		return WORKERS_AI_MODELS[model as keyof typeof WORKERS_AI_MODELS] ?? model;
	}

	private async fetchAPI(body: Record<string, unknown>): Promise<Response> {
		return fetch(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiToken}` },
			body: JSON.stringify(body),
		});
	}

	private toOpenAIMessages(messages: Message[]): unknown[] {
		return messages.map((m) => {
			if (m.role === "tool") {
				return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
			}
			if (m.role === "assistant" && m.tool_calls?.length) {
				return {
					role: "assistant",
					content: m.content || "",
					tool_calls: m.tool_calls.map((tc) => ({
						id: tc.id,
						type: "function",
						function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
					})),
				};
			}
			return { role: m.role, content: m.content || "" };
		});
	}

	private toOpenAITools(tools: unknown[]): unknown[] {
		return (tools as Array<Record<string, unknown>>).map((t) => ({
			type: "function",
			function: {
				name: t.name,
				description: t.description,
				parameters: t.input_schema ?? t.parameters ?? {},
			},
		}));
	}

	private debug(msg: string): void {
		if (process.env.CONSTRUYE_DEBUG) console.error(`[Workers AI] ${msg}`);
	}

	async countTokens(messages: Message[], _model: ModelConfig): Promise<number> {
		return estimateMessagesTokens(messages);
	}
}
