import type { ToolHandler } from "../types.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

export const searchText: ToolHandler = {
	name: "search_text",
	description: "Search for text pattern across project files (grep-style)",
	parameters: {
		type: "object",
		properties: {
			pattern: { type: "string", description: "Search pattern" },
			path: { type: "string", description: "Directory to search in (optional)" },
			is_regex: { type: "boolean", description: "Treat pattern as regex" },
		},
		required: ["pattern"],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const searchDir = resolve(context.workingDir, (args.path as string) ?? ".");
		const grepArgs = ["-rn", "--include=*.ts", "--include=*.tsx", "--include=*.js", "--include=*.json", "--include=*.md", "--exclude-dir=node_modules", "--exclude-dir=.git", "--exclude-dir=dist"];
		if (args.is_regex) grepArgs.push("-E");
		grepArgs.push(args.pattern as string, searchDir);
		try {
			const { stdout } = await execFileAsync("grep", grepArgs, { maxBuffer: 512 * 1024 });
			const lines = stdout.split("\n").filter(Boolean);
			if (lines.length > 50) {
				return `${lines.length} matches found. Showing first 50:\n${lines.slice(0, 50).join("\n")}`;
			}
			return lines.join("\n") || "No matches found";
		} catch {
			return "No matches found";
		}
	},
};
