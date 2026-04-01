import type { ToolHandler } from "../types.ts";

export const git: ToolHandler = {
	name: "git",
	description: "Execute git operations (clone, commit, push, branch, diff, status)",
	parameters: {
		type: "object",
		properties: {
			command: { type: "string", description: "Git subcommand and arguments" },
		},
		required: ["command"],
	},
	layer: "sandbox",
	requiresApproval: true,
	async execute(args) {
		return `[git: ${args.command} — not connected to sandbox]`;
	},
};
