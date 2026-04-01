import type { Message } from "@construye/shared";
import { MAX_AGENT_TURNS, MAX_ERROR_RETRIES } from "@construye/shared";
import type { AgentConfig } from "./types.ts";
import { assembleContext } from "./context-engine.ts";
import { shouldCompact, compact } from "./compaction.ts";

/** Run the agent loop: LLM → tool calls → results → repeat */
export async function runAgentLoop(
	userMessage: string,
	history: Message[],
	config: AgentConfig,
): Promise<Message[]> {
	const messages = [...history];
	const maxTurns = config.maxTurns ?? MAX_AGENT_TURNS;

	// Add user message
	messages.push({ role: "user", content: userMessage });

	for (let turn = 0; turn < maxTurns; turn++) {
		// Assemble context with compaction check
		const context = await assembleContext(messages, config);

		// Stream LLM response
		const response = await collectResponse(context, config);

		// Add assistant message to history
		messages.push(response.message);

		// No tool calls = conversation turn complete
		if (!response.message.tool_calls?.length) break;

		// Execute each tool call with error recovery
		for (const call of response.message.tool_calls) {
			const result = await executeWithRetry(call, config, messages);
			messages.push({
				role: "tool",
				content: result.content,
				tool_call_id: result.tool_call_id,
			});
		}

		// Compact if needed
		if (shouldCompact(messages, config)) {
			const compacted = await compact(messages, config);
			messages.length = 0;
			messages.push(...compacted);
		}
	}

	return messages;
}

async function collectResponse(
	context: Message[],
	config: AgentConfig,
): Promise<{ message: Message }> {
	let content = "";
	const toolCalls: import("@construye/shared").ToolCall[] = [];

	for await (const chunk of config.provider.chat(context, config.tools)) {
		if (chunk.type === "text" && chunk.content) {
			content += chunk.content;
			config.onStream(chunk);
		}
		if (chunk.type === "tool_call" && chunk.tool_call) {
			toolCalls.push(chunk.tool_call);
			config.onStream(chunk);
		}
		if (chunk.type === "done") {
			config.onStream(chunk);
		}
		if (chunk.type === "error" && chunk.error) {
			config.onStream(chunk);
			content += `\n[Error from model: ${chunk.error}]`;
		}
	}

	return {
		message: {
			role: "assistant",
			content,
			tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
		},
	};
}

/** Execute a tool call with approval check */
async function executeWithApproval(
	call: import("@construye/shared").ToolCall,
	config: AgentConfig,
): Promise<import("@construye/shared").ToolResult> {
	if (config.toolExecutor.needsApproval(call) && config.onApproval) {
		const approved = await config.onApproval(call);
		if (!approved) {
			return { tool_call_id: call.id, content: "[User denied this action]", is_error: true };
		}
	}
	return config.toolExecutor.execute(call);
}

/** Execute with retry — if tool fails, retry with exponential backoff */
async function executeWithRetry(
	call: import("@construye/shared").ToolCall,
	config: AgentConfig,
	_messages: Message[],
): Promise<import("@construye/shared").ToolResult> {
	let lastResult: import("@construye/shared").ToolResult | null = null;

	for (let attempt = 0; attempt < MAX_ERROR_RETRIES; attempt++) {
		const result = await executeWithApproval(call, config);
		if (!result.is_error) return result;

		lastResult = result;

		// Only retry transient errors (timeouts, network), not logical errors
		const isTransient = result.content.includes("ETIMEDOUT") ||
			result.content.includes("ECONNREFUSED") ||
			result.content.includes("timeout");

		if (!isTransient) return result;

		// Exponential backoff: 500ms, 1s, 2s
		await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
	}

	return lastResult ?? { tool_call_id: call.id, content: "All retries exhausted", is_error: true };
}
