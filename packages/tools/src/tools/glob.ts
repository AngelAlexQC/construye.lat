import type { ToolHandler } from "../types.js";
import { readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

export const glob: ToolHandler = {
	name: "glob",
	description: "Find files matching a glob pattern",
	parameters: {
		type: "object",
		properties: {
			pattern: { type: "string", description: "Glob pattern (e.g. **/*.ts)" },
		},
		required: ["pattern"],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const pattern = args.pattern as string;
		// Simple glob: convert to regex for basic patterns
		const regexStr = pattern
			.replace(/\./g, "\\.")
			.replace(/\*\*/g, "__DOUBLESTAR__")
			.replace(/\*/g, "[^/]*")
			.replace(/__DOUBLESTAR__/g, ".*");
		const regex = new RegExp(`^${regexStr}$`);
		const entries = await readdir(context.workingDir, { recursive: true, withFileTypes: true });
		const matches = entries
			.filter((e) => !e.isDirectory())
			.map((e) => {
				const parent = e.parentPath ?? e.path ?? context.workingDir;
				return relative(context.workingDir, resolve(parent, e.name));
			})
			.filter((p) => regex.test(p) && !p.includes("node_modules") && !p.includes("dist"));
		return matches.join("\n") || "No matches";
	},
};
