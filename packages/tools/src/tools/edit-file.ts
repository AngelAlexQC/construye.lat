import type { ToolHandler } from "../types.ts";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const editFile: ToolHandler = {
	name: "edit_file",
	description: "Apply a surgical edit by replacing old_string with new_string in a file",
	parameters: {
		type: "object",
		properties: {
			path: { type: "string", description: "File path relative to project root" },
			old_string: { type: "string", description: "Exact text to find and replace" },
			new_string: { type: "string", description: "Replacement text" },
		},
		required: ["path", "old_string", "new_string"],
	},
	layer: "dynamic_worker",
	requiresApproval: true,
	async execute(args, context) {
		const filePath = resolve(context.workingDir, args.path as string);
		const content = await readFile(filePath, "utf-8");
		const oldStr = args.old_string as string;
		const newStr = args.new_string as string;
		const count = content.split(oldStr).length - 1;
		if (count === 0) return `Error: old_string not found in ${args.path}`;
		if (count > 1) return `Error: old_string found ${count} times in ${args.path}, must be unique`;
		const updated = content.replace(oldStr, newStr);
		await writeFile(filePath, updated, "utf-8");
		return `Edited ${args.path}: replaced ${oldStr.split("\n").length} lines`;
	},
};
