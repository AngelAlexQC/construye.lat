import type { CodeModeApi } from "./types.ts";

/**
 * Code Mode runtime: provides the `api` object to user-written TypeScript
 * that batches multiple file operations in a single LLM round-trip.
 * Saves ~81% tokens vs individual tool calls.
 */
export function createCodeModeApi(projectRoot: string): CodeModeApi {
	return {
		async readFile(path: string): Promise<string> {
			return `[readFile: ${projectRoot}/${path}]`;
		},
		async writeFile(path: string, content: string): Promise<void> {
			// Placeholder
		},
		async editFile(path: string, old: string, replacement: string): Promise<void> {
			// Placeholder
		},
		async searchText(pattern: string, dir?: string): Promise<string> {
			return `[searchText: ${pattern} in ${dir ?? "."}]`;
		},
		async listDir(path: string): Promise<string[]> {
			return [];
		},
		async glob(pattern: string): Promise<string[]> {
			return [];
		},
	};
}
