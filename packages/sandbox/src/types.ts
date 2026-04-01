import type { ExecutionLayer } from "@construye/shared";

export interface SandboxResult {
	output: string;
	exitCode: number;
	duration: number;
}

export interface CodeModeApi {
	readFile(path: string): Promise<string>;
	writeFile(path: string, content: string): Promise<void>;
	editFile(path: string, old: string, replacement: string): Promise<void>;
	searchText(pattern: string, dir?: string): Promise<string>;
	listDir(path: string): Promise<string[]>;
	glob(pattern: string): Promise<string[]>;
}

export interface SandboxManager {
	execute(
		command: string,
		layer: ExecutionLayer,
		options?: SandboxOptions,
	): Promise<SandboxResult>;
	executeCode(code: string, api: CodeModeApi): Promise<string>;
	cleanup(): Promise<void>;
}

export interface SandboxOptions {
	workingDir?: string;
	timeout?: number;
	env?: Record<string, string>;
}
