import type { CodeModeApi } from "./types.ts";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

/**
 * Code Mode runtime: provides the `api` object to user-written TypeScript
 * that batches multiple file operations in a single LLM round-trip.
 * Saves ~81% tokens vs individual tool calls.
 */
export function createCodeModeApi(projectRoot: string): CodeModeApi {
	// Resolve paths relative to project root, prevent path traversal
	function safePath(path: string): string {
		const resolved = join(projectRoot, path);
		const rel = relative(projectRoot, resolved);
		if (rel.startsWith("..") || rel.startsWith("/")) {
			throw new Error(`Path traversal not allowed: ${path}`);
		}
		return resolved;
	}

	return {
		async readFile(path: string): Promise<string> {
			return readFile(safePath(path), "utf-8");
		},

		async writeFile(path: string, content: string): Promise<void> {
			const fullPath = safePath(path);
			// Ensure parent directory exists
			const { mkdir } = await import("node:fs/promises");
			await mkdir(join(fullPath, ".."), { recursive: true });
			await writeFile(fullPath, content, "utf-8");
		},

		async editFile(path: string, old: string, replacement: string): Promise<void> {
			const fullPath = safePath(path);
			const content = await readFile(fullPath, "utf-8");
			if (!content.includes(old)) {
				throw new Error(`String not found in ${path}`);
			}
			const updated = content.replace(old, replacement);
			await writeFile(fullPath, updated, "utf-8");
		},

		async searchText(pattern: string, dir?: string): Promise<string> {
			const searchDir = dir ? safePath(dir) : projectRoot;
			const results: string[] = [];
			const regex = new RegExp(pattern, "gi");

			async function walk(d: string): Promise<void> {
				const entries = await readdir(d, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = join(d, entry.name);
					if (entry.isDirectory()) {
						// Skip common non-relevant directories
						if (["node_modules", ".git", "dist", ".turbo"].includes(entry.name)) continue;
						await walk(fullPath);
					} else if (entry.isFile()) {
						try {
							const content = await readFile(fullPath, "utf-8");
							const lines = content.split("\n");
							for (let i = 0; i < lines.length; i++) {
								if (regex.test(lines[i])) {
									const relPath = relative(projectRoot, fullPath);
									results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
								}
								regex.lastIndex = 0;
							}
						} catch {
							// Skip binary files or unreadable files
						}
					}
				}
			}

			await walk(searchDir);
			return results.join("\n");
		},

		async listDir(path: string): Promise<string[]> {
			const fullPath = safePath(path);
			const entries = await readdir(fullPath, { withFileTypes: true });
			return entries.map((e) => e.isDirectory() ? `${e.name}/` : e.name);
		},

		async glob(pattern: string): Promise<string[]> {
			// Simple glob implementation using readdir + pattern matching
			const results: string[] = [];

			async function walk(dir: string): Promise<void> {
				const entries = await readdir(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = join(dir, entry.name);
					const relPath = relative(projectRoot, fullPath);

					if (entry.isDirectory()) {
						if (["node_modules", ".git", "dist", ".turbo"].includes(entry.name)) continue;
						await walk(fullPath);
					} else {
						if (matchGlob(relPath, pattern)) {
							results.push(relPath);
						}
					}
				}
			}

			await walk(projectRoot);
			return results;
		},
	};
}

/** Simple glob matching (supports * and **) */
function matchGlob(path: string, pattern: string): boolean {
	const regexStr = pattern
		.replace(/\./g, "\\.")
		.replace(/\*\*/g, "⧫") // temp placeholder
		.replace(/\*/g, "[^/]*")
		.replace(/⧫/g, ".*");
	return new RegExp(`^${regexStr}$`).test(path);
}
