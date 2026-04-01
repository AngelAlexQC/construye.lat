import type { ToolHandler } from "../types.ts";

export const preview: ToolHandler = {
	name: "preview",
	description: "Start a dev server and expose a preview URL",
	parameters: {
		type: "object",
		properties: {
			command: { type: "string", description: "Command to start server (e.g. npm run dev)" },
			port: { type: "number", description: "Port to expose (default 3000)" },
		},
		required: ["command", "port"],
	},
	layer: "sandbox",
	requiresApproval: false,
	async execute(args) {
		return `[preview: ${args.command} on port ${args.port} — not connected to sandbox]`;
	},
};
