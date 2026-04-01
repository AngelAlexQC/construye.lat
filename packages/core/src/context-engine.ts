import type { Message } from "@construye/shared";
import { estimateMessagesTokens, MODEL_CONTEXT_SIZES } from "@construye/shared";
import type { AgentConfig } from "./types.ts";

/** Assemble the full context for the LLM */
export async function assembleContext(
	messages: Message[],
	config: AgentConfig,
): Promise<Message[]> {
	const context: Message[] = [];

	// 1. System prompt with project identity, tools, and active skills
	const systemPrompt = buildSystemPrompt(config);
	context.push({ role: "system", content: systemPrompt });

	// 2. Include conversation history (skip the first system message if already present)
	for (const msg of messages) {
		if (msg.role === "system") continue;
		context.push(msg);
	}

	return context;
}

/** Build the system prompt from project identity + tool stubs + skills */
function buildSystemPrompt(config: AgentConfig): string {
	const parts: string[] = [];

	// Core identity
	parts.push(`You are construye.lat, an expert AI coding agent that helps developers build, debug, and ship software.
When the user asks to interact with files or run commands, you MUST use the provided tools. Do NOT describe what you would do — actually call the tools.
Be concise. Execute first, explain after. Show results, not intentions.
When you encounter errors after using a tool, analyze the error and try a different approach.

LANGUAGE RULE: Detect the language of each user message and respond in EXACTLY that language. Never default to any specific language.

TOOL USAGE GUIDELINES:
- For reading code: use read_file with line ranges for large files
- For finding code: use search_text with specific patterns, or glob to find files
- For editing: use edit_file with exact old_string/new_string (prefer small, surgical edits)
- For shell commands: use exec (builds, tests, installs)
- For git: use git tool (status, diff, log, commit, branch)
- For research: use browse to fetch web pages
- For conversations (greetings, questions about yourself): respond directly with text, NO tools
- NEVER use ask_user unless you genuinely need clarification about an ambiguous task`);

	// Project identity (CONSTRUYE.md)
	if (config.projectIdentity) {
		parts.push(`\n## Project Context\n${config.projectIdentity}`);
	}

	// Tool descriptions — compact stubs (~30 tokens each)
	if (config.tools?.length) {
		const toolDescs = (config.tools as Array<{ name: string; description: string }>)
			.map(t => `- ${t.name}: ${t.description}`)
			.join("\n");
		parts.push(`\n## Available Tools\n${toolDescs}`);
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
