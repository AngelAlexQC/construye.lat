import type { Message } from "@construye/shared";
import { MAX_AGENT_TURNS } from "@construye/shared";
import type { AgentConfig, StreamCallback } from "./types.js";
import { assembleContext } from "./context-engine.js";
import { shouldCompact, compact } from "./compaction.js";

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

		// Execute each tool call
		for (const call of response.message.tool_calls) {
			const result = await executeWithApproval(call, config);
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
	}

	return {
		message: {
			role: "assistant",
			content,
			tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
		},
	};
}

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
