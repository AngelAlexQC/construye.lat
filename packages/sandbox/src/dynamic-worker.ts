import type { DynamicWorkerExecutor } from "./manager.ts";
import type { SandboxResult, SandboxOptions, CodeModeApi } from "./types.ts";

/**
 * Dynamic Worker execution: fast path for file operations.
 * Uses Cloudflare Dynamic Workers (formerly "Code Mode") for <5ms
 * startup to run file reads, writes, edits, search, glob.
 */
export class DynamicWorker implements DynamicWorkerExecutor {
	private dispatchNamespace: string;

	constructor(dispatchNamespace: string) {
		this.dispatchNamespace = dispatchNamespace;
	}

	async run(command: string, options?: SandboxOptions): Promise<SandboxResult> {
		// Placeholder: will dispatch to Workers for Platforms
		return {
			output: `[DynamicWorker: ${command}]`,
			exitCode: 0,
			duration: 0,
		};
	}

	/**
	 * Execute user-written TypeScript code with the `api` object bound.
	 * The code receives a CodeModeApi and must return a string summary.
	 *
	 * Example user code:
	 * ```ts
	 * const content = await api.readFile("src/index.ts");
	 * await api.editFile("src/index.ts", "old", "new");
	 * return "Edited src/index.ts";
	 * ```
	 */
	async runCode(code: string, api: CodeModeApi): Promise<string> {
		const start = performance.now();

		try {
			// Build an async function from user code that has `api` in scope
			const fn = new Function("api", `return (async () => {\n${code}\n})()`) as (
				api: CodeModeApi,
			) => Promise<string>;

			const result = await fn(api);
			const duration = Math.round(performance.now() - start);

			return typeof result === "string"
				? result
				: `Code Mode completed in ${duration}ms (no return value)`;
		} catch (err) {
			const duration = Math.round(performance.now() - start);
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Code Mode execution failed after ${duration}ms: ${message}`);
		}
	}
}
