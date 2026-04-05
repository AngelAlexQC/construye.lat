import type { ToolHandler } from "../types.ts";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const MAX_OUTPUT_CHARS = 40_000;
const DEFAULT_TIMEOUT_MS = 120_000; // 2 min — enough for builds, installs
const LONG_TIMEOUT_MS = 300_000;    // 5 min — for slow ops like full test suites

/** Commands that need a longer timeout */
const LONG_RUNNING_PREFIXES = ["npm install", "pnpm install", "yarn install", "bun install", "cargo build", "go mod download", "pip install"];

function needsLongTimeout(command: string): boolean {
	const lower = command.toLowerCase().trimStart();
	return LONG_RUNNING_PREFIXES.some((p) => lower.startsWith(p));
}

/** Run a shell command and stream stdout+stderr into a buffer */
async function runCommand(
	command: string,
	cwd: string,
	timeoutMs: number,
): Promise<{ output: string; exitCode: number }> {
	return new Promise((resolve: (v: { output: string; exitCode: number }) => void) => {
		const chunks: string[] = [];
		let timedOut = false;

		const child = spawn("sh", ["-c", command], {
			cwd,
			env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
		});

		const onData = (data: Buffer) => chunks.push(data.toString());
		child.stdout?.on("data", onData);
		child.stderr?.on("data", onData);

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGKILL");
		}, timeoutMs);

		child.on("close", (code) => {
			clearTimeout(timer);
			const raw = chunks.join("");
			const output = timedOut
				? `[timeout after ${timeoutMs / 1000}s]\n${truncate(raw)}`
				: truncate(raw);
			resolve({ output, exitCode: code ?? 1 });
		});

		child.on("error", (err) => {
			clearTimeout(timer);
			resolve({ output: `[spawn error] ${err.message}`, exitCode: 1 });
		});
	});
}

function truncate(text: string): string {
	if (text.length <= MAX_OUTPUT_CHARS) return text;
	const head = text.slice(0, MAX_OUTPUT_CHARS * 0.6);
	const tail = text.slice(-MAX_OUTPUT_CHARS * 0.4);
	return `${head}\n\n[... ${text.length - MAX_OUTPUT_CHARS} chars omitted ...]\n\n${tail}`;
}

export const exec: ToolHandler = {
	name: "exec",
	description:
		"Execute a shell command in the project directory. Use for builds, installs, linting, formatting, and other dev tasks. Returns combined stdout+stderr. Timeout: 2min (5min for installs).",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "Shell command to run (e.g. 'npm run build', 'git status', 'ls -la')",
			},
			working_dir: {
				type: "string",
				description: "Subdirectory to run in (relative to project root). Omit to use project root.",
			},
		},
		required: ["command"],
	},
	layer: "sandbox",
	requiresApproval: true,
	async execute(args, context) {
		const command = args.command as string;
		const cwd = resolve(context.workingDir, (args.working_dir as string) ?? ".");
		const timeoutMs = needsLongTimeout(command) ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

		const { output, exitCode } = await runCommand(command, cwd, timeoutMs);
		const trimmed = output.trim() || "(no output)";

		if (exitCode !== 0) {
			return `[exit ${exitCode}]\n${trimmed}`;
		}
		return trimmed;
	},
};
