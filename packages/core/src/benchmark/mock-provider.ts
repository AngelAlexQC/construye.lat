/**
 * Mock Provider + Tool Executor for Benchmark Tests
 *
 * These mocks let us test the benchmark harness itself without
 * calling real LLM APIs. The mock provider follows "scripts" that
 * simulate correct or intentionally incorrect agent behavior.
 */
import type { Message, StreamChunk, ToolCall, ToolResult } from "@construye/shared";
import type { Provider, ToolExecutor } from "../types.ts";
import * as nodePath from "node:path";
import * as nodeFsp from "node:fs/promises";
import * as nodeChildProcess from "node:child_process";

/** A scripted action the mock agent should take */
export interface ScriptedAction {
	/** Text response from the agent */
	text?: string;
	/** Tool calls to make */
	toolCalls?: Array<{
		name: string;
		arguments: Record<string, unknown>;
	}>;
}

/** Configuration for the mock provider */
export interface MockProviderConfig {
	/** Sequence of actions the mock agent will take */
	script: ScriptedAction[];
	/** Delay between chunks (ms) — set to 0 for speed */
	chunkDelayMs?: number;
}

/** Mock provider that follows a script instead of calling an LLM */
export class MockProvider implements Provider {
	private script: ScriptedAction[];
	private callIndex = 0;
	private chunkDelayMs: number;

	constructor(config: MockProviderConfig) {
		this.script = config.script;
		this.chunkDelayMs = config.chunkDelayMs ?? 0;
	}

	async *chat(
		_messages: Message[],
		_tools?: unknown[],
	): AsyncIterable<StreamChunk> {
		const action = this.script[this.callIndex];
		this.callIndex++;

		if (!action) {
			// Script exhausted — return done
			yield { type: "text", content: "Task completed." };
			yield { type: "done", usage: { input_tokens: 100, output_tokens: 50, cost_cents: 0 } };
			return;
		}

		// Emit text if present
		if (action.text) {
			yield { type: "text", content: action.text };
		}

		// Emit tool calls if present
		if (action.toolCalls) {
			for (let i = 0; i < action.toolCalls.length; i++) {
				const tc = action.toolCalls[i];
				yield {
					type: "tool_call",
					tool_call: {
						id: `mock-call-${this.callIndex}-${i}`,
						name: tc.name,
						arguments: tc.arguments,
					},
				};
			}
		}

		yield {
			type: "done",
			usage: { input_tokens: 100, output_tokens: 50, cost_cents: 0 },
		};
	}

	/** Reset the script index for re-use */
	reset(): void {
		this.callIndex = 0;
	}
}

/** Mock tool executor that actually performs file operations in a sandbox */
export class SandboxToolExecutor implements ToolExecutor {
	private workDir: string;
	private callLog: Array<{ name: string; args: Record<string, unknown>; result: string }> = [];

	constructor(workDir: string) {
		this.workDir = workDir;
	}

	async execute(call: ToolCall): Promise<ToolResult> {
		const args = call.arguments;
		let result: string;

		try {
			switch (call.name) {
				case "readFile": {
					const filePath = nodePath.resolve(this.workDir, args.path as string);
					this.assertInsideSandbox(filePath);
					const content = await nodeFsp.readFile(filePath, "utf-8");
					const startLine = (args.start_line as number) ?? 1;
					const endLine = (args.end_line as number) ?? undefined;
					const lines = content.split("\n");
					const slice = lines.slice(startLine - 1, endLine);
					result = slice.join("\n");
					break;
				}
				case "writeFile": {
					const filePath = nodePath.resolve(this.workDir, args.path as string);
					this.assertInsideSandbox(filePath);
					await nodeFsp.mkdir(nodePath.dirname(filePath), { recursive: true });
					await nodeFsp.writeFile(filePath, args.content as string, "utf-8");
					const lineCount = (args.content as string).split("\n").length;
					result = `Wrote ${lineCount} lines to ${args.path}`;
					break;
				}
				case "editFile": {
					const filePath = nodePath.resolve(this.workDir, args.path as string);
					this.assertInsideSandbox(filePath);
					let content = await nodeFsp.readFile(filePath, "utf-8");
					content = content.replace(args.old_string as string, args.new_string as string);
					await nodeFsp.writeFile(filePath, content, "utf-8");
					result = `Edited ${args.path}`;
					break;
				}
				case "searchText": {
					const pattern = args.pattern as string;
					const searchPath = args.path as string | undefined;
					const dir = searchPath ? nodePath.resolve(this.workDir, searchPath) : this.workDir;
					this.assertInsideSandbox(dir);
					const matches = await this.searchFiles(dir, pattern);
					result = matches.length > 0 ? matches.join("\n") : "No matches found.";
					break;
				}
				case "listDir": {
					const dirPath = nodePath.resolve(this.workDir, (args.path as string) ?? ".");
					this.assertInsideSandbox(dirPath);
					const entries = await nodeFsp.readdir(dirPath, { withFileTypes: true });
					result = entries
						.map((e) => `${e.isDirectory() ? "d" : "f"} ${e.name}`)
						.join("\n");
					break;
				}
				case "exec": {
					const cmd = args.command as string;
					// Execute in sandbox dir only
					const output = await new Promise<string>((resolve, _reject) => {
						nodeChildProcess.exec(
							cmd,
							{
								cwd: this.workDir,
								timeout: 15000,
								maxBuffer: 1024 * 1024,
							},
							(error, stdout, stderr) => {
								if (error) {
									resolve(`Error: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`);
								} else {
									resolve(stdout + (stderr ? `\nStderr: ${stderr}` : ""));
								}
							},
						);
					});
					result = output;
					break;
				}
				case "glob": {
					const pattern = args.pattern as string;
					const dir = this.workDir;
					const found = await this.globFiles(dir, pattern);
					result = found.join("\n") || "No files found";
					break;
				}
				default:
					result = `Unknown tool: ${call.name}`;
			}
		} catch (err) {
			return {
				tool_call_id: call.id,
				content: `Error: ${(err as Error).message}`,
				is_error: true,
			};
		}

		this.callLog.push({ name: call.name, args: call.arguments, result });

		return {
			tool_call_id: call.id,
			content: result,
		};
	}

	needsApproval(): boolean {
		return false;
	}

	/** Get logged calls for inspection */
	getCallLog() {
		return this.callLog;
	}

	private assertInsideSandbox(filePath: string): void {
		const resolved = nodePath.resolve(filePath);
		const sandbox = nodePath.resolve(this.workDir);
		if (!resolved.startsWith(sandbox)) {
			throw new Error(`Path escape detected: ${resolved} is outside sandbox ${sandbox}`);
		}
	}

	private async searchFiles(
		dir: string,
		pattern: string,
	): Promise<string[]> {
		const results: string[] = [];
		const regex = new RegExp(pattern, "gi");

		const entries = await nodeFsp.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = nodePath.join(dir, entry.name);
			if (entry.isDirectory()) {
				results.push(...(await this.searchFiles(full, pattern)));
			} else {
				try {
					const content = await nodeFsp.readFile(full, "utf-8");
					const lines = content.split("\n");
					for (let i = 0; i < lines.length; i++) {
						if (regex.test(lines[i])) {
							const rel = nodePath.relative(this.workDir, full);
							results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
						}
						regex.lastIndex = 0;
					}
				} catch {
					// Skip binary or unreadable files
				}
			}
		}
		return results;
	}

	private async globFiles(
		dir: string,
		pattern: string,
	): Promise<string[]> {
		// Simple glob implementation (supports * and **)
		const results: string[] = [];
		const entries = await nodeFsp.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = nodePath.join(dir, entry.name);
			const rel = nodePath.relative(this.workDir, full);
			if (entry.isDirectory()) {
				results.push(...(await this.globFiles(full, pattern)));
			} else {
				// Simple pattern matching
				const regexStr = pattern
					.replace(/\*\*/g, "DOUBLESTAR")
					.replace(/\*/g, "[^/]*")
					.replace(/DOUBLESTAR/g, ".*");
				if (new RegExp(`^${regexStr}$`).test(rel)) {
					results.push(rel);
				}
			}
		}
		return results;
	}
}

/** Create a mock provider with a simple script for a task */
export function createScriptForFileRead(filePath: string): ScriptedAction[] {
	return [
		{
			text: "Let me read that file for you.",
			toolCalls: [{ name: "readFile", arguments: { path: filePath } }],
		},
		{
			text: "Here's the content of the file.",
		},
	];
}

export function createScriptForFileWrite(
	filePath: string,
	content: string,
): ScriptedAction[] {
	return [
		{
			text: "I'll create that file now.",
			toolCalls: [{ name: "writeFile", arguments: { path: filePath, content } }],
		},
		{
			text: "File created successfully.",
		},
	];
}

export function createScriptForEdit(
	filePath: string,
	oldStr: string,
	newStr: string,
): ScriptedAction[] {
	return [
		{
			text: "Let me read the file first.",
			toolCalls: [{ name: "readFile", arguments: { path: filePath } }],
		},
		{
			text: "Now I'll make the edit.",
			toolCalls: [
				{
					name: "editFile",
					arguments: { path: filePath, old_string: oldStr, new_string: newStr },
				},
			],
		},
		{
			text: "Edit applied successfully.",
		},
	];
}

export function createScriptForExec(command: string): ScriptedAction[] {
	return [
		{
			text: "Running the command.",
			toolCalls: [{ name: "exec", arguments: { command } }],
		},
		{
			text: "Command completed.",
		},
	];
}

export function createScriptForMultiStep(
	steps: Array<{ tool: string; args: Record<string, unknown>; text?: string }>,
): ScriptedAction[] {
	const actions: ScriptedAction[] = [];
	for (const step of steps) {
		actions.push({
			text: step.text ?? `Executing ${step.tool}...`,
			toolCalls: [{ name: step.tool, arguments: step.args }],
		});
	}
	actions.push({ text: "All steps completed." });
	return actions;
}
