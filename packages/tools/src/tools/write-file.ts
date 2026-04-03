import type { ToolHandler } from "../types.ts";
import { writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Quick syntax check after writing — non-blocking, returns warnings */
async function checkSyntax(filePath: string, workingDir: string): Promise<string | null> {
	if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return null;
	try {
		await execFileAsync("npx", ["tsc", "--noEmit", "--pretty", filePath], {
			cwd: workingDir,
			timeout: 10_000,
			maxBuffer: 256 * 1024,
		});
		return null;
	} catch (err: unknown) {
		const msg = err instanceof Error && "stdout" in err ? (err as { stdout: string }).stdout : "";
		if (msg) {
			const lines = msg.split("\n").slice(0, 5).join("\n");
			return `⚠ Typecheck warnings:\n${lines}`;
		}
		return null; // tsc not available — skip silently
	}
}

export const writeFile: ToolHandler = {
	name: "write_file",
	description: "Create or overwrite a file with the given content. Returns typecheck warnings for TS/JS files.",
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

		const lineCount = (args.content as string).split("\n").length;
		let result = `Wrote ${lineCount} lines to ${args.path}`;

		// Post-write verification (non-blocking)
		const warning = await checkSyntax(filePath, context.workingDir);
		if (warning) result += `\n${warning}`;

		return result;
	},
};
