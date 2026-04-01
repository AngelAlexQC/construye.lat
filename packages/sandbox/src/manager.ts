import type { SandboxManager, SandboxResult, SandboxOptions, CodeModeApi } from "./types.js";
import type { ExecutionLayer } from "@construye/shared";

/**
 * Manages sandbox lifecycle: selects the right execution layer
 * and routes commands accordingly.
 */
export class SandboxOrchestrator implements SandboxManager {
	private dynamicWorker: DynamicWorkerExecutor;
	private container: ContainerExecutor;

	constructor(
		dynamicWorker: DynamicWorkerExecutor,
		container: ContainerExecutor,
	) {
		this.dynamicWorker = dynamicWorker;
		this.container = container;
	}

	async execute(
		command: string,
		layer: ExecutionLayer,
		options?: SandboxOptions,
	): Promise<SandboxResult> {
		switch (layer) {
			case "dynamic_worker":
				return this.dynamicWorker.run(command, options);
			case "sandbox":
				return this.container.run(command, options);
			case "browser":
				return this.container.run(command, options);
			default:
				return { output: command, exitCode: 0, duration: 0 };
		}
	}

	async executeCode(code: string, api: CodeModeApi): Promise<string> {
		return this.dynamicWorker.runCode(code, api);
	}

	async cleanup(): Promise<void> {
		await this.container.destroy();
	}
}

// Interfaces for the two execution backends
export interface DynamicWorkerExecutor {
	run(command: string, options?: SandboxOptions): Promise<SandboxResult>;
	runCode(code: string, api: CodeModeApi): Promise<string>;
}

export interface ContainerExecutor {
	run(command: string, options?: SandboxOptions): Promise<SandboxResult>;
	destroy(): Promise<void>;
}
