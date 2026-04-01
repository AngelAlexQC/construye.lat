import type { ToolHandler } from "../types.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Allowed git subcommands — safe operations only */
const SAFE_COMMANDS = new Set([
	"status", "diff", "log", "show", "branch", "stash",
	"add", "commit", "checkout", "switch", "restore",
	"merge", "rebase", "cherry-pick", "tag",
	"remote", "fetch", "pull",
	"blame", "shortlog", "rev-parse",
]);

/** Dangerous commands that need explicit approval */
const DANGEROUS_COMMANDS = new Set([
	"push", "reset", "revert", "clean",
]);

export const git: ToolHandler = {
	name: "git",
	description: "Execute git operations (status, diff, log, commit, branch, add, checkout, etc.)",
	parameters: {
		type: "object",
		properties: {
			command: { type: "string", description: "Git subcommand and arguments (e.g. 'status', 'diff --staged', 'log --oneline -10')" },
		},
		required: ["command"],
	},
	layer: "sandbox",
	requiresApproval: true,
	async execute(args, context) {
		const fullCommand = (args.command as string).trim();
		const parts = fullCommand.split(/\s+/);
		const subcommand = parts[0];

		if (!subcommand) return "Error: no git subcommand provided";

		// Block destructive operations
		if (!SAFE_COMMANDS.has(subcommand) && !DANGEROUS_COMMANDS.has(subcommand)) {
			return `Error: git ${subcommand} is not allowed. Safe commands: ${[...SAFE_COMMANDS].join(", ")}`;
		}

		try {
			const { stdout, stderr } = await execFileAsync("git", parts, {
				cwd: context.workingDir,
				timeout: 30000,
				maxBuffer: 1024 * 1024,
			});
			let result = "";
			if (stdout) result += stdout;
			if (stderr) result += stderr;
			return result.trim() || "(no output)";
		} catch (err: unknown) {
			const e = err as { stdout?: string; stderr?: string; message?: string };
			let result = "";
			if (e.stdout) result += e.stdout;
			if (e.stderr) result += `\n${e.stderr}`;
			if (!result) result = e.message ?? "git command failed";
			return `[git error]\n${result.trim()}`;
		}
	},
};
