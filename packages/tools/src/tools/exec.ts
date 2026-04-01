import type { ToolHandler } from "../types.ts";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execAsync = promisify(execCb);

export const exec: ToolHandler = {
	name: "exec",
	description: "Execute a shell command in the project directory",
	parameters: {
		type: "object",
		properties: {
			command: { type: "string", description: "Shell command to execute" },
			working_dir: { type: "string", description: "Working directory (optional)" },
		},
		required: ["command"],
	},
	layer: "sandbox",
	requiresApproval: true,
	async execute(args, context) {
		const cwd = resolve(context.workingDir, (args.working_dir as string) ?? ".");
		try {
			const { stdout, stderr } = await execAsync(args.command as string, {
				cwd,
				timeout: 30000,
				maxBuffer: 1024 * 1024,
			});
			let result = "";
			if (stdout) result += stdout;
			if (stderr) result += `\n[stderr]\n${stderr}`;
			return result.trim() || "(no output)";
		} catch (err: unknown) {
			const e = err as { stdout?: string; stderr?: string; message?: string };
			let result = "";
			if (e.stdout) result += e.stdout;
			if (e.stderr) result += `\n[stderr]\n${e.stderr}`;
			if (!result) result = e.message ?? "Command failed";
			return `[exit non-zero]\n${result.trim()}`;
		}
	},
};
