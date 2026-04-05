import type { Message, ToolCall } from "@construye/shared";
import { MAX_AGENT_TURNS, MAX_ERROR_RETRIES } from "@construye/shared";
import type { AgentConfig } from "./types.ts";
import { assembleContext } from "./context-engine.ts";
import { shouldCompact, compact } from "./compaction.ts";

/** Tools that modify code — their errors should be fed back to the LLM */
const CODE_MUTATING_TOOLS = new Set(["edit_file", "write_file", "exec", "git"]);

/** Max repeated calls before considering it an infinite loop */
const MAX_REPEATED_CALLS = 3;

interface ToolCallRecord {
	name: string;
	args: string;
	count: number;
}

/** Check if we're stuck in a tool loop (same tool + args called repeatedly) */
function detectToolLoop(
	call: ToolCall,
	recentCalls: ToolCallRecord[],
): { isLoop: boolean; record: ToolCallRecord } {
	const argsKey = JSON.stringify(call.arguments);
	const existing = recentCalls.find(r => r.name === call.name && r.args === argsKey);

	if (existing) {
		existing.count++;
		return { isLoop: existing.count >= MAX_REPEATED_CALLS, record: existing };
	}

	const record: ToolCallRecord = { name: call.name, args: argsKey, count: 1 };
	recentCalls.push(record);
	// Keep only last 10 calls to limit memory
	if (recentCalls.length > 10) recentCalls.shift();

	return { isLoop: false, record };
}

/**
 * After any of these tools succeed, offer the model a verification nudge.
 * We don't auto-run tests blindly — we inject a reminder so the model decides.
 */
const CODE_VERIFY_NUDGE = `[Agent] Código modificado. Si el proyecto tiene tests, considera correr run_tests para verificar que nada se rompió. Si hay errores de tipos, usa typecheck.`;

/** Run the agent loop: LLM → tool calls → results → observe → self-heal → repeat */
export async function runAgentLoop(
	userMessage: string,
	history: Message[],
	config: AgentConfig,
): Promise<Message[]> {
	const messages = [...history];
	const maxTurns = config.maxTurns ?? MAX_AGENT_TURNS;
	const recentToolCalls: ToolCallRecord[] = [];

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

		// Execute each tool call — errors become LLM-visible context, not blind retries
		let hasErrors = false;
		for (const call of response.message.tool_calls) {
			// Detect infinite tool loops
			const { isLoop, record } = detectToolLoop(call, recentToolCalls);
			if (isLoop) {
				messages.push({
					role: "system",
					content: `[Agent] Tool "${call.name}" was called ${record.count} times with the same arguments. You are stuck in a loop. Try a completely different approach — examine the conversation history and the actual error/content before repeating.`,
				});
			}

			const result = await executeToolSmart(call, config);
			messages.push({
				role: "tool",
				content: result.content,
				tool_call_id: result.tool_call_id,
			});

			if (result.is_error && CODE_MUTATING_TOOLS.has(call.name)) {
				hasErrors = true;
			}
		}

		// Self-healing: if code-mutating tools failed, inject a reflection nudge
		if (hasErrors) {
			messages.push({
				role: "system",
				content: "[Agent] Una o más herramientas fallaron. Lee los errores anteriores, diagnostica la causa raíz, y prueba un enfoque diferente — no repitas la misma llamada.",
			});
		}

		// Verification nudge: if code was successfully modified, remind the model to verify
		const didMutate = response.message.tool_calls?.some(
			(c) => CODE_MUTATING_TOOLS.has(c.name) && !hasErrors,
		);
		if (didMutate && !hasErrors) {
			messages.push({
				role: "system",
				content: CODE_VERIFY_NUDGE,
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
	call: ToolCall,
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

/**
 * Smart tool execution: retry only transient errors (network/timeout).
 * Logical errors flow back to the LLM for self-healing — not blind retry.
 */
async function executeToolSmart(
	call: ToolCall,
	config: AgentConfig,
): Promise<import("@construye/shared").ToolResult> {
	let lastResult: import("@construye/shared").ToolResult | null = null;

	for (let attempt = 0; attempt < MAX_ERROR_RETRIES; attempt++) {
		const result = await executeWithApproval(call, config);
		if (!result.is_error) return result;

		lastResult = result;

		// Only retry transient errors (timeouts, network), not logical errors
		const isTransient = result.content.includes("ETIMEDOUT") ||
			result.content.includes("ECONNREFUSED") ||
			result.content.includes("timeout") ||
			result.content.includes("ENOTFOUND");

		if (!isTransient) {
			// Logical error — return immediately so the LLM sees it and self-heals
			return result;
		}

		// Exponential backoff: 500ms, 1s, 2s
		await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
	}

	return lastResult ?? { tool_call_id: call.id, content: "All retries exhausted", is_error: true };
}
