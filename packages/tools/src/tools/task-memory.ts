import type { ToolHandler } from "../types.ts";

/**
 * In-memory scratchpad for the agent to store notes during long tasks.
 * Persists within a single session. Reduces re-reading files.
 */

const scratchpads = new Map<string, Map<string, string>>();

function getpad(sessionId: string): Map<string, string> {
	if (!scratchpads.has(sessionId)) {
		scratchpads.set(sessionId, new Map());
	}
	return scratchpads.get(sessionId)!;
}

export const taskMemory: ToolHandler = {
	name: "task_memory",
	description:
		"Read/write notes during a task. Persists within this session. Use to save plans, findings, and intermediate results.",
	parameters: {
		type: "object",
		properties: {
			action: {
				type: "string",
				enum: ["write", "read", "list", "delete"],
				description: "Action to perform",
			},
			key: {
				type: "string",
				description: "Note key/name",
			},
			content: {
				type: "string",
				description: "Note content (for write action)",
			},
		},
		required: ["action"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args, context) {
		const action = args.action as string;
		const key = args.key as string | undefined;
		const content = args.content as string | undefined;
		const pad = getpad(context.sessionId);

		switch (action) {
			case "write": {
				if (!key || !content) return "[task_memory] write requires key and content";
				pad.set(key, content);
				return `Saved note "${key}" (${content.length} chars)`;
			}
			case "read": {
				if (!key) return "[task_memory] read requires key";
				const note = pad.get(key);
				if (!note) return `Note "${key}" not found. Available: ${[...pad.keys()].join(", ") || "(none)"}`;
				return note;
			}
			case "list": {
				const keys = [...pad.keys()];
				if (keys.length === 0) return "No notes saved yet.";
				return keys.map((k) => `- ${k} (${pad.get(k)!.length} chars)`).join("\n");
			}
			case "delete": {
				if (!key) return "[task_memory] delete requires key";
				if (pad.delete(key)) return `Deleted note "${key}"`;
				return `Note "${key}" not found`;
			}
			default:
				return `[task_memory] Unknown action: ${action}. Use write, read, list, or delete.`;
		}
	},
};
