import type { Message } from "@construye/shared";
import { COMPACTION_THRESHOLD } from "@construye/shared";
import type { AgentConfig } from "./types.ts";
import { getContextTokenUsage } from "./context-engine.ts";

/** Check if compaction is needed */
export function shouldCompact(messages: Message[], config: AgentConfig): boolean {
	const { percentage } = getContextTokenUsage(messages, config.modelConfig.model);
	return percentage >= COMPACTION_THRESHOLD;
}

/** Compact conversation history by summarizing old turns */
export async function compact(
	messages: Message[],
	config: AgentConfig,
): Promise<Message[]> {
	// Preserve: system prompt (first), last 3 user/assistant turns, all recent tool results
	const systemMsg = messages[0];
	const recentMessages = getRecentTurns(messages, 3);
	const oldMessages = messages.slice(1, messages.length - recentMessages.length);

	if (oldMessages.length === 0) return messages;

	// Summarize old messages using the current provider
	const summaryPrompt = buildCompactionPrompt(oldMessages);
	let summary = "";

	for await (const chunk of config.provider.chat([
		{ role: "system", content: "Summarize this conversation history concisely. Preserve: decisions made, files changed, errors encountered, current project state. Be brief." },
		{ role: "user", content: summaryPrompt },
	])) {
		if (chunk.type === "text" && chunk.content) {
			summary += chunk.content;
		}
	}

	// Rebuild: system + summary + recent
	return [
		systemMsg,
		{ role: "system", content: `[Previous conversation summary]\n${summary}` },
		...recentMessages,
	];
}

function getRecentTurns(messages: Message[], count: number): Message[] {
	const turns: Message[][] = [];
	let currentTurn: Message[] = [];

	for (let i = messages.length - 1; i > 0; i--) {
		currentTurn.unshift(messages[i]);
		if (messages[i].role === "user") {
			turns.unshift(currentTurn);
			currentTurn = [];
			if (turns.length >= count) break;
		}
	}

	return turns.flat();
}

function buildCompactionPrompt(messages: Message[]): string {
	return messages
		.map((m) => `[${m.role}]: ${m.content.slice(0, 2000)}`)
		.join("\n\n");
}
