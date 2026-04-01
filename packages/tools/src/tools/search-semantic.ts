import type { ToolHandler } from "../types.js";

export const searchSemantic: ToolHandler = {
	name: "search_semantic",
	description: "Semantic search across project codebase using vector embeddings",
	parameters: {
		type: "object",
		properties: {
			query: { type: "string", description: "Natural language search query" },
			max_results: { type: "number", description: "Max results (default 10)" },
		},
		required: ["query"],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args) {
		return `[search_semantic: ${args.query} — not connected to execution layer]`;
	},
};
