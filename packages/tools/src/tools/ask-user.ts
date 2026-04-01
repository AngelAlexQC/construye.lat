import type { ToolHandler } from "../types.js";

export const askUser: ToolHandler = {
	name: "ask_user",
	description: "Ask the user a clarifying question before proceeding",
	parameters: {
		type: "object",
		properties: {
			question: { type: "string", description: "Question to ask the user" },
			options: {
				type: "array",
				items: { type: "string" },
				description: "Optional preset answer choices",
			},
		},
		required: ["question"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args) {
		return `[ask_user: ${args.question} — awaiting user response]`;
	},
};
