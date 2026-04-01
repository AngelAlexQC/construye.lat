import type { ToolHandler } from "../types.ts";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Quick syntax check after editing — non-blocking, returns warnings */
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

export const editFile: ToolHandler = {
	name: "edit_file",
	description: "Apply a surgical edit by replacing old_string with new_string in a file. Returns typecheck warnings if any.",
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

		const lineCount = oldStr.split("\n").length;
		let result = `Edited ${args.path}: replaced ${lineCount} lines`;

		// Post-edit verification (non-blocking)
		const warning = await checkSyntax(filePath, context.workingDir);
		if (warning) result += `\n${warning}`;

		return result;
	},
};
