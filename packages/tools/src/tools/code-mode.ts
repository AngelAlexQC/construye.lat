import type { ToolHandler } from "../types.ts";

export const codeMode: ToolHandler = {
	name: "code_mode",
	description:
		"Execute TypeScript that batches multiple file operations. Receives an `api` object with readFile, writeFile, editFile, searchText, listDir, glob. Return a string summary.",
	parameters: {
		type: "object",
		properties: {
			code: { type: "string", description: "TypeScript code to execute" },
		},
		required: ["code"],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const code = args.code as string;
		if (!code || typeof code !== "string") {
			return "Error: code parameter is required and must be a string.";
		}
		// Actual execution is handled by the SandboxOrchestrator
		// when routed through the dynamic_worker layer.
		// The tool just validates and passes through.
		return `[code_mode: ready to execute ${code.length} chars via dynamic_worker layer]`;
	},
};
