import type { ToolHandler } from "../types.js";
import { writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

export const writeFile: ToolHandler = {
	name: "write_file",
	description: "Create or overwrite a file with the given content",
	parameters: {
		type: "object",
		properties: {
			path: { type: "string", description: "File path relative to project root" },
			content: { type: "string", description: "File content to write" },
		},
		required: ["path", "content"],
	},
	layer: "dynamic_worker",
	requiresApproval: true,
	async execute(args, context) {
		const filePath = resolve(context.workingDir, args.path as string);
		await mkdir(dirname(filePath), { recursive: true });
		await fsWriteFile(filePath, args.content as string, "utf-8");
		return `Wrote ${(args.content as string).split("\n").length} lines to ${args.path}`;
	},
};
