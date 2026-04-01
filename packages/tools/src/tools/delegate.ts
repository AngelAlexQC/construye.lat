import type { ToolHandler } from "../types.ts";

export const delegate: ToolHandler = {
	name: "delegate",
	description: "Spawn a sub-agent to handle a parallel sub-task independently",
	parameters: {
		type: "object",
		properties: {
			task: { type: "string", description: "Task description for the sub-agent" },
			context: { type: "string", description: "Additional context (optional)" },
		},
		required: ["task"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args) {
		return `[delegate: ${args.task} — sub-agents not yet implemented]`;
	},
};
