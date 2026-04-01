import type { ProviderAdapter } from "./types.js";
import type { ModelConfig, StreamChunk, Message } from "@construye/shared";

/** Demo provider that simulates an AI agent for testing without API keys */
export class DemoProvider implements ProviderAdapter {
	readonly name = "demo";
	private awaitingToolResult = false;

	async *stream(messages: Message[], _model: ModelConfig, _tools?: unknown[]): AsyncIterable<StreamChunk> {
		// Check if last message is a tool result — if so, present it
		const lastMsg = messages[messages.length - 1];
		if (lastMsg?.role === "tool") {
			const content = typeof lastMsg.content === "string" ? lastMsg.content : "";
			const display = content.length > 2000 ? `${content.slice(0, 2000)}\n... (truncated)` : content;
			yield { type: "text", content: `Here's what I found:\n\`\`\`\n${display}\n\`\`\`` };
			yield { type: "done", usage: { input_tokens: 50, output_tokens: display.length, cost_cents: 0 } };
			return;
		}

		const last = messages.filter((m) => m.role === "user").pop();
		const userMsg = (typeof last?.content === "string" ? last.content : "").toLowerCase();

		// Simulate tool usage based on user input
		if (userMsg.includes("read") || userMsg.includes("show") || userMsg.includes("cat")) {
			yield* this.simulateToolUse("read_file", { path: "package.json" },
				"Let me read that file for you.");
			return;
		}

		if (userMsg.includes("list") || userMsg.includes("ls") || userMsg.includes("dir")) {
			yield* this.simulateToolUse("list_dir", { path: "." },
				"Let me list the directory contents.");
			return;
		}

		if (userMsg.includes("search") || userMsg.includes("find") || userMsg.includes("grep")) {
			yield* this.simulateToolUse("search_text", { pattern: "TODO", path: "." },
				"Searching for that pattern...");
			return;
		}

		if (userMsg.includes("run") || userMsg.includes("exec") || userMsg.includes("test")) {
			yield* this.simulateToolUse("exec", { command: "echo 'Hello from construye.lat!' && node --version && date" },
				"Let me run that for you.");
			return;
		}

		// Default: just respond with text
		const response = this.generateResponse(userMsg);
		yield { type: "text", content: response };
		yield { type: "done", usage: { input_tokens: 100, output_tokens: response.length, cost_cents: 0 } };
	}

	estimateTokens(): number { return 0; }

	async countTokens(): Promise<number> { return 0; }

	private async *simulateToolUse(toolName: string, args: Record<string, unknown>, prefix: string) {
		yield { type: "text" as const, content: prefix };
		yield {
			type: "tool_call" as const,
			tool_call: { id: `tc_${Date.now()}`, name: toolName, arguments: args },
		};
	}

	private generateResponse(input: string): string {
		if (input.includes("hello") || input.includes("hola"))
			return "Hello! I'm the construye.lat agent running in demo mode. I can read files, list directories, search code, and more. Try: \"list the files\" or \"read package.json\"";
		if (input.includes("help"))
			return "Available commands in demo mode:\n- \"list files\" — shows directory contents\n- \"read <file>\" — reads a file\n- \"search <pattern>\" — searches for text\n- Start without --demo and set ANTHROPIC_API_KEY for full AI mode.";
		return `I'm running in demo mode (no API key). I understood: "${input}". Set ANTHROPIC_API_KEY for real AI responses, or try "list files", "read package.json", "search TODO".`;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
