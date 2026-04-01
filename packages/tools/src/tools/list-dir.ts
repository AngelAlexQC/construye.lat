import type { ToolHandler } from "../types.ts";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export const listDir: ToolHandler = {
	name: "list_dir",
	description: "List directory contents with optional recursive listing",
	parameters: {
		type: "object",
		properties: {
			path: { type: "string", description: "Directory path (default: project root)" },
			recursive: { type: "boolean", description: "List recursively (default false)" },
		},
		required: [],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const dirPath = resolve(context.workingDir, (args.path as string) ?? ".");
		const entries = await readdir(dirPath, {
			withFileTypes: true,
			recursive: args.recursive === true,
		});
		return entries
			.map((e) => {
				const name = e.parentPath && e.parentPath !== dirPath
					? `${e.parentPath.replace(dirPath + "/", "")}/${e.name}`
					: e.name;
				return e.isDirectory() ? `${name}/` : name;
			})
			.join("\n");
	},
};
