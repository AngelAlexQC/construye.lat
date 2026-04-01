import type { Message } from "@construye/shared";
import { estimateMessagesTokens, MODEL_CONTEXT_SIZES } from "@construye/shared";
import type { AgentConfig } from "./types.ts";

/** Assemble the full context for the LLM */
export async function assembleContext(
	messages: Message[],
	config: AgentConfig,
): Promise<Message[]> {
	const context: Message[] = [];

	// 1. System prompt with project identity and tool stubs
	const systemPrompt = buildSystemPrompt(config);
	context.push({ role: "system", content: systemPrompt });

	// 2. Include conversation history
	context.push(...messages);

	return context;
}

/** Build the system prompt from project identity + tool stubs + skills */
function buildSystemPrompt(config: AgentConfig): string {
	const parts: string[] = [];

	parts.push("You are construye, an expert AI coding agent that helps developers.");
	parts.push("When the user asks to interact with files or run commands, you MUST use the provided tools. Do NOT describe what you would do — actually call the tools.");
	parts.push("Available tool categories: read_file, write_file, edit_file, list_dir, search_text, glob, exec (shell), git.");
	parts.push("Be concise. Execute first, explain after.");
	parts.push("CRITICAL RULE — Language: You MUST detect the language of each user message and respond in EXACTLY that language. User writes English → you respond in English. User writes Spanish → you respond in Spanish. User writes Portuguese → you respond in Portuguese. NEVER default to any specific language.");
	parts.push("IMPORTANT: Only use tools when the user asks for file operations, code changes, or shell commands. For conversational messages (greetings, questions about yourself, general chat), respond directly with text. NEVER use ask_user unless you genuinely need clarification about an ambiguous task.");

	// Project identity (CONSTRUYE.md)
	if (config.projectIdentity) {
		parts.push(`\n## Project Context\n${config.projectIdentity}`);
	}

	// Active skill stubs
	const stubs = config.skillLoader.getStubs();
	if (stubs.length > 0) {
		const stubList = stubs.map((s) => `- ${s.name}: ${s.description}`).join("\n");
		parts.push(`\n## Available Skills\n${stubList}`);
	}

	return parts.join("\n\n");
}

/** Calculate current context token usage */
export function getContextTokenUsage(
	messages: Message[],
	modelName: string,
): { used: number; max: number; percentage: number } {
	const used = estimateMessagesTokens(messages);
	const max = MODEL_CONTEXT_SIZES[modelName] ?? 128_000;
	return { used, max, percentage: used / max };
}
