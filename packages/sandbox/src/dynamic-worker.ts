import type { DynamicWorkerExecutor } from "./manager.ts";
import type { SandboxResult, SandboxOptions, CodeModeApi } from "./types.ts";

/**
 * Dynamic Worker execution: fast path for file operations.
 * Uses Cloudflare Workers for Platforms / Dynamic Dispatch for <5ms
 * startup to run file reads, writes, edits, search, glob.
 *
 * When running in Node.js (CLI), falls back to local execution.
 */
export class DynamicWorker implements DynamicWorkerExecutor {
	private dispatchNamespace: string;
	private dispatchBinding: DispatchNamespace | null;

	constructor(dispatchNamespace: string, dispatchBinding?: DispatchNamespace) {
		this.dispatchNamespace = dispatchNamespace;
		this.dispatchBinding = dispatchBinding ?? null;
	}

	async run(command: string, options?: SandboxOptions): Promise<SandboxResult> {
		const startTime = Date.now();

		// If we have a dispatch binding (running on CF Workers), use it
		if (this.dispatchBinding) {
			return this.runOnWorker(command, options, startTime);
		}

		// Fallback: execute locally via child_process (for CLI mode)
		return this.runLocally(command, options, startTime);
	}

	async runCode(code: string, api: CodeModeApi): Promise<string> {
		// Execute TypeScript/JavaScript code with the CodeMode API bindings
		// This creates a sandboxed function with access to file operations
		const fn = new Function(
			"api",
			`return (async () => { ${code} })()`,
		);

		try {
			const result = await fn(api);
			return typeof result === "string" ? result : JSON.stringify(result ?? "done", null, 2);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return `Error: ${message}`;
		}
	}

	private async runOnWorker(
		command: string,
		options: SandboxOptions | undefined,
		startTime: number,
	): Promise<SandboxResult> {
		try {
			const worker = this.dispatchBinding!.get(this.dispatchNamespace);
			const res = await worker.fetch("https://internal/exec", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					command,
					workingDir: options?.workingDir,
					timeout: options?.timeout ?? 30_000,
					env: options?.env,
				}),
			});

			const data = (await res.json()) as { output: string; exitCode: number };
			return {
				output: data.output,
				exitCode: data.exitCode,
				duration: Date.now() - startTime,
			};
		} catch (err) {
			return {
				output: `Worker dispatch error: ${err instanceof Error ? err.message : String(err)}`,
				exitCode: 1,
				duration: Date.now() - startTime,
			};
		}
	}

	private async runLocally(
		command: string,
		options: SandboxOptions | undefined,
		startTime: number,
	): Promise<SandboxResult> {
		try {
			const { execSync } = await import("node:child_process");
			const output = execSync(command, {
				cwd: options?.workingDir,
				timeout: options?.timeout ?? 30_000,
				env: options?.env ? { ...process.env, ...options.env } : undefined,
				encoding: "utf-8",
				maxBuffer: 1024 * 1024, // 1MB
			});
			return {
				output: output.trim(),
				exitCode: 0,
				duration: Date.now() - startTime,
			};
		} catch (err) {
			const execErr = err as { status?: number; stdout?: string; stderr?: string; message?: string };
			return {
				output: execErr.stderr || execErr.stdout || execErr.message || String(err),
				exitCode: execErr.status ?? 1,
				duration: Date.now() - startTime,
			};
		}
	}
}

/** Cloudflare Workers for Platforms dispatch binding (minimal type) */
interface DispatchNamespace {
	get(name: string): { fetch(url: string, init?: RequestInit): Promise<Response> };
}
