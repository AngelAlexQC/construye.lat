import type { ToolHandler } from "../types.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

const FILE_INCLUDES = [
	"*.ts", "*.tsx", "*.js", "*.jsx", "*.json", "*.md",
	"*.css", "*.html", "*.yaml", "*.yml", "*.toml", "*.py",
	"*.go", "*.rs", "*.sql", "*.sh", "*.env", "*.graphql",
];

export const searchText: ToolHandler = {
	name: "search_text",
	description: "Search for text pattern across project files (grep-style). Supports multiple patterns separated by | for parallel search.",
	parameters: {
		type: "object",
		properties: {
			pattern: { type: "string", description: "Search pattern (supports | for multiple patterns)" },
			path: { type: "string", description: "Directory to search in (optional)" },
			include: { type: "string", description: "File glob pattern to filter (e.g. '*.ts')" },
			is_regex: { type: "boolean", description: "Treat pattern as regex" },
		},
		required: ["pattern"],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const searchDir = resolve(context.workingDir, (args.path as string) ?? ".");
		const pattern = args.pattern as string;
		const includeFilter = args.include as string | undefined;

		const includes = includeFilter
			? [`--include=${includeFilter}`]
			: FILE_INCLUDES.map((ext) => `--include=${ext}`);

		const grepArgs = [
			"-rn",
			...includes,
			"--exclude-dir=node_modules",
			"--exclude-dir=.git",
			"--exclude-dir=dist",
			"--exclude-dir=.turbo",
			"-E",
			pattern,
			searchDir,
		];

		try {
			const { stdout } = await execFileAsync("grep", grepArgs, {
				maxBuffer: 1024 * 1024,
				timeout: 15_000,
			});
			const lines = stdout.split("\n").filter(Boolean);
			if (lines.length > 80) {
				return `${lines.length} matches found. Showing first 80:\n${lines.slice(0, 80).join("\n")}`;
			}
			return lines.join("\n") || "No matches found";
		} catch {
			return "No matches found";
		}
	},
};
