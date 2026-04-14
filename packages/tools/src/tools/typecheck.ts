import type { ToolHandler } from "../types.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

function detectTypechecker(workingDir: string): { cmd: string; args: string[] } | null {
	// TypeScript project
	if (existsSync(join(workingDir, "tsconfig.json"))) {
		return { cmd: "npx", args: ["tsc", "--noEmit", "--pretty"] };
	}
	// Pyright (Python)
	if (existsSync(join(workingDir, "pyrightconfig.json"))) {
		return { cmd: "npx", args: ["pyright"] };
	}
	// mypy (Python fallback)
	if (existsSync(join(workingDir, "pyproject.toml")) || existsSync(join(workingDir, "setup.cfg"))) {
		return { cmd: "python", args: ["-m", "mypy", "."] };
	}
	return null;
}

export const typecheck: ToolHandler = {
	name: "typecheck",
	description:
		"Run type checking on the project (tsc --noEmit for TypeScript, pyright/mypy for Python). Returns all type errors and warnings.",
	parameters: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Specific file or directory to check (optional, defaults to whole project)",
			},
		},
		required: [],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const checker = detectTypechecker(context.workingDir);
		if (!checker) {
			return "No se detectó configuración de typecheck (tsconfig.json, pyrightconfig.json, pyproject.toml)";
		}

		const cmdArgs = [...checker.args];
		if (args.path && typeof args.path === "string") {
			cmdArgs.push(args.path);
		}

		try {
			const { stdout, stderr } = await execFileAsync(checker.cmd, cmdArgs, {
				cwd: context.workingDir,
				timeout: 60_000,
				maxBuffer: 2 * 1024 * 1024,
			});
			const output = (stdout + stderr).trim();
			return output ? `✓ Sin errores de tipos\n${output}` : "✓ Sin errores de tipos";
		} catch (err: unknown) {
			const e = err as { stdout?: string; stderr?: string; message: string };
			const output = ((e.stdout ?? "") + (e.stderr ?? "")).trim();
			return output ? `✗ Errores de tipos encontrados:\n${output}` : `Error: ${e.message}`;
		}
	},
};
