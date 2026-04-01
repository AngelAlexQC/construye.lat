import type { ToolStub, ToolDefinition } from "@construye/shared";
import type { ToolHandler } from "./types.js";

/** Registry for lazy-loaded tool definitions */
export class ToolRegistry {
	private tools = new Map<string, ToolHandler>();

	register(handler: ToolHandler): void {
		this.tools.set(handler.name, handler);
	}

	get(name: string): ToolHandler | undefined {
		return this.tools.get(name);
	}

	/** Stubs for context — only name + description (~30 tokens each) */
	getStubs(): ToolStub[] {
		return Array.from(this.tools.values()).map((t) => ({
			name: t.name,
			description: t.description,
		}));
	}

	/** Full definition when LLM selects a tool */
	getDefinition(name: string): ToolDefinition | undefined {
		const tool = this.tools.get(name);
		if (!tool) return undefined;
		return {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
			layer: tool.layer,
			requires_approval: tool.requiresApproval,
		};
	}

	list(): string[] {
		return Array.from(this.tools.keys());
	}
}
