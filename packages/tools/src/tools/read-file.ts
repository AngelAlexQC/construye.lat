import type { ToolHandler } from "../types.ts";
import { readFile as fsReadFile } from "node:fs/promises";
import { resolve } from "node:path";

export const readFile: ToolHandler = {
	name: "read_file",
	description: "Read file contents with optional line range",
	parameters: {
		type: "object",
		properties: {
			path: { type: "string", description: "File path relative to project root" },
			start_line: { type: "number", description: "Start line (1-based, optional)" },
			end_line: { type: "number", description: "End line (1-based, optional)" },
		},
		required: ["path"],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const filePath = resolve(context.workingDir, args.path as string);
		const content = await fsReadFile(filePath, "utf-8");
		const lines = content.split("\n");
		const start = (args.start_line as number | undefined) ?? 1;
		const end = (args.end_line as number | undefined) ?? lines.length;
		const slice = lines.slice(start - 1, end);
		return slice.map((l, i) => `${start + i}: ${l}`).join("\n");
	},
};
