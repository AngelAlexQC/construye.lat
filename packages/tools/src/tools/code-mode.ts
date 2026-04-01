import type { ToolHandler } from "../types.ts";

export const codeMode: ToolHandler = {
	name: "code_mode",
	description: "Execute TypeScript that batches multiple file operations. Receives an `api` object with readFile, writeFile, editFile, searchText, listDir, glob. Return a string summary.",
	parameters: {
		type: "object",
		properties: {
			code: { type: "string", description: "TypeScript code to execute" },
		},
		required: ["code"],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(_args) {
		return `[code_mode: batch execution — not connected to execution layer]`;
	},
};
