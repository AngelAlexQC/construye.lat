import type { ToolHandler } from "../types.ts";

export const browse: ToolHandler = {
	name: "browse",
	description: "Fetch and read a web page or take a screenshot via headless browser",
	parameters: {
		type: "object",
		properties: {
			url: { type: "string", description: "URL to visit" },
			action: { type: "string", enum: ["read", "screenshot"], description: "Action to perform" },
		},
		required: ["url", "action"],
	},
	layer: "browser",
	requiresApproval: false,
	async execute(args) {
		return `[browse: ${args.action} ${args.url} — not connected to browser rendering]`;
	},
};
