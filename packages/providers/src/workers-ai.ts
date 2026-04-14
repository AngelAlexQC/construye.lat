import type { ProviderAdapter } from "./types.ts";
import type { ModelConfig, StreamChunk, Message, ToolCall } from "@construye/shared";
import { estimateMessagesTokens, WORKERS_AI_MODEL_MAP } from "@construye/shared";

/** Models available on Workers AI with tool calling support */
export const WORKERS_AI_MODELS: Record<string, string> = {
	// Frontier coding — best for SWE tasks
	"kimi-k2.5": WORKERS_AI_MODEL_MAP.heavy,
	"kimi": WORKERS_AI_MODEL_MAP.heavy,
	// Reasoning — dedicated thinking model
	"qwq": WORKERS_AI_MODEL_MAP.reasoning,
	"qwq-32b": WORKERS_AI_MODEL_MAP.reasoning,
	// Fast — tiny MoE for instant responses
	"qwen3-coder": WORKERS_AI_MODEL_MAP.fast,
	"fast": WORKERS_AI_MODEL_MAP.fast,
	// Legacy aliases
	"qwen-coder": "@cf/qwen/qwen2.5-coder-32b-instruct",
	"llama-3.3": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
	"llama-3.1": "@cf/meta/llama-3.1-70b-instruct",
	"llama-3.1-8b": "@cf/meta/llama-3.1-8b-instruct",
	"deepseek-r1": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
	"gpt-oss-120b": "@cf/openai/gpt-oss-120b",
};

/** System prompt optimized for Workers AI function calling models */
const SYSTEM_PROMPT = `You are construye, an elite AI coding agent running on Cloudflare Workers AI. You are built to be faster, cheaper, and more capable than any other coding agent.

## IDENTITY
- You run 100% on Cloudflare — no vendor lock-in, edge-native, global
- You are open source (MIT) — transparent and trustworthy
- You support Spanish, English, and all major languages natively

## CORE OPERATING PRINCIPLES

**1. ACT, don't describe.**
When the user asks you to do something with code or files — DO IT with tools immediately. Never say "I would do X" — just do X. Show the result, then explain briefly if needed.

**2. EXPLORE before editing.**
Before modifying any file: read it first. Before fixing a bug: search for the relevant code. Before adding a feature: understand the existing architecture.

**3. VERIFY after every change.**
After editing code: run_tests if a test suite exists. After writing a file: read it back to confirm. After running a command: check the output for errors.

**4. SELF-HEAL on errors.**
When a tool fails: read the error carefully, diagnose the root cause, try a different approach. Never repeat the same failing call.

**5. THINK in steps.**
For complex tasks: break into ordered steps, complete each before moving on. For bugs: reproduce → isolate → fix → verify.

## TOOL USAGE GUIDE

File operations:
- read_file: Read with optional line ranges (use ranges for files >200 lines)
- write_file: Create new files (never overwrite without reading first)
- edit_file: Surgical str_replace — replace old_string with new_string (must be unique)
- list_dir: Explore directory structure
- glob: Find files by pattern ("**/*.ts", "src/**/*.test.*")
- search_text: Grep across the project (regex supported)

Execution:
- exec: Run any shell command (npm install, build, lint, format)
- run_tests: Auto-detect and run the project's test suite (vitest/jest/pytest/cargo/go)
- git: Git operations (status, diff, add, commit, branch, push)

Web:
- web_search: Search the web for docs, packages, error solutions
- web_fetch: Fetch a specific URL (docs, APIs, changelogs)

## LANGUAGE RULE
Detect the language of each user message. Respond in EXACTLY that language. If they write in Spanish → respond in Spanish. If English → English. Never switch languages mid-conversation.

## QUALITY STANDARDS
- Write TypeScript strictly typed, no any
- Follow the existing code style (indentation, naming, patterns)
- Add tests when adding new functionality
- Keep functions small and single-purpose
- Never leave TODO comments — either implement it or ask the user

## EFFICIENCY
- Use glob/search_text to navigate large codebases instead of reading every file
- Read only the relevant sections of large files (use line ranges)
- Batch related operations when possible
- When uncertain about project structure, list_dir first

Remember: You are the best coding agent. Prove it with every response.`;


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
			// STREAMING: fast first-token for text-only responses
			yield* this.streamingText(openAiMessages, modelId, model);
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
		this.debug(`Response: content=${!!msg.content}, tool_calls=${!!(msg.tool_calls)}, contentType=${typeof msg.content}`);

		const emittedCalls: ToolCall[] = [];

		// Emit text content (handle string, object-as-tool-call, and other types)
		if (msg.content) {
			if (typeof msg.content === "string") {
				yield { type: "text", content: msg.content };
			} else if (typeof msg.content === "object" && !Array.isArray(msg.content)) {
				// Some models embed tool calls as objects in content field
				const obj = msg.content as Record<string, unknown>;
				if (obj.name && typeof obj.name === "string" && obj.arguments) {
					const toolCall = this.parseToolCall(obj);
					if (toolCall) {
						this.debug(`Tool call from content object: ${toolCall.name}`);
						emittedCalls.push(toolCall);
						yield { type: "tool_call", tool_call: toolCall };
					}
				} else {
					// Unknown object — serialize to text
					yield { type: "text", content: JSON.stringify(msg.content) };
				}
			}
		}

		// Emit structured tool calls
		const rawToolCalls = msg.tool_calls as Array<Record<string, unknown>> | undefined;
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
		let systemInjected = false;
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
			// Inject SYSTEM_PROMPT before the first system message so both
			// the base instructions and dynamic project context reach the model
			if (m.role === "system" && !systemInjected) {
				systemInjected = true;
				return {
					role: "system",
					content: `${SYSTEM_PROMPT}\n\n---\n\n${m.content || ""}`,
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
