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

LANGUAGE RULE: Detect the language of each user message and respond in EXACTLY that language. Never default to any specific language.

SELF-CORRECTION PROTOCOL:
When a tool call returns an error, you MUST:
1. Read the error message carefully — identify the root cause, not the symptom.
2. Analyze what went wrong — was it a wrong file path, bad search string, syntax error, logic error?
3. Try a DIFFERENT approach — do not repeat the same call with the same arguments.
4. If an edit_file fails because old_string wasn't found, re-read the file first to get the exact current content.
5. If exec fails, check the error output and fix the underlying issue before retrying.

VERIFICATION PROTOCOL:
After making code changes (edit_file, write_file), verify your work:
1. If the project has tests: run them with exec to confirm nothing broke.
2. If you wrote new code: read it back to confirm the edit applied correctly.
3. If tests fail after your edit: fix the issue immediately, don't leave broken code.
4. For multi-step tasks: verify each step before moving to the next.

PLANNING PROTOCOL:
For complex tasks (multiple files, architectural changes, new features):
1. First, explore the codebase — read relevant files to understand the current state.
2. Plan your approach — describe the steps you'll take before starting.
3. Execute one step at a time, verifying each before proceeding.
4. If a step fails, re-plan from the current state rather than pushing through.

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
