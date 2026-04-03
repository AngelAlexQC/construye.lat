import { readFile as fsReadFile, writeFile as fsWriteFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";
import { existsSync } from "node:fs";
import type { CodeModeApi } from "./types.ts";

/**
 * Code Mode runtime: provides the `api` object to user-written TypeScript
 * that batches multiple file operations in a single LLM round-trip.
 * Saves ~81% tokens vs individual tool calls.
 *
 * All paths are resolved relative to projectRoot and sandboxed
 * to prevent escaping the project directory.
 */
export function createCodeModeApi(projectRoot: string): CodeModeApi {
	const root = resolve(projectRoot);

	/** Resolve and validate a path stays within the project root. */
	function safePath(path: string): string {
		const resolved = resolve(root, path);
		if (!resolved.startsWith(root)) {
			throw new Error(`Path escape attempt blocked: ${path}`);
		}
		return resolved;
	}

	return {
		async readFile(path: string): Promise<string> {
			const abs = safePath(path);
			return fsReadFile(abs, "utf-8");
		},

		async writeFile(path: string, content: string): Promise<void> {
			const abs = safePath(path);
			const dir = dirname(abs);
			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true });
			}
			await fsWriteFile(abs, content, "utf-8");
		},

		async editFile(path: string, old: string, replacement: string): Promise<void> {
			const abs = safePath(path);
			const content = await fsReadFile(abs, "utf-8");
			if (!content.includes(old)) {
				throw new Error(`String not found in ${path}: "${old.slice(0, 80)}..."`);
			}
			const occurrences = content.split(old).length - 1;
			if (occurrences > 1) {
				throw new Error(`Ambiguous edit: "${old.slice(0, 80)}..." found ${occurrences} times in ${path}`);
			}
			await fsWriteFile(abs, content.replace(old, replacement), "utf-8");
		},

		async searchText(pattern: string, dir?: string): Promise<string> {
			const searchDir = dir ? safePath(dir) : root;
			const results: string[] = [];
			const regex = new RegExp(pattern, "gi");

			async function walk(dirPath: string): Promise<void> {
				const entries = await readdir(dirPath, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = join(dirPath, entry.name);
					// Skip hidden dirs, node_modules, .git, build outputs
					if (entry.isDirectory()) {
						if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
						await walk(fullPath);
					} else if (entry.isFile()) {
						try {
							const content = await fsReadFile(fullPath, "utf-8");
							const lines = content.split("\n");
							for (let i = 0; i < lines.length; i++) {
								if (regex.test(lines[i])) {
									const relPath = relative(root, fullPath);
									results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
									if (results.length >= 100) return;
								}
								regex.lastIndex = 0;
							}
						} catch {
							// Skip binary files / permission errors
						}
					}
				}
			}

			await walk(searchDir);
			return results.join("\n") || "No matches found.";
		},

		async listDir(path: string): Promise<string[]> {
			const abs = safePath(path);
			const entries = await readdir(abs, { withFileTypes: true });
			return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
		},

		async glob(pattern: string): Promise<string[]> {
			// Simple glob implementation using recursive walk + pattern matching
			const results: string[] = [];
			const globRegex = globToRegex(pattern);

			async function walk(dirPath: string): Promise<void> {
				const entries = await readdir(dirPath, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = join(dirPath, entry.name);
					const relPath = relative(root, fullPath);
					if (entry.isDirectory()) {
						if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
						await walk(fullPath);
					} else {
						if (globRegex.test(relPath)) {
							results.push(relPath);
						}
					}
				}
			}

			await walk(root);
			return results;
		},
	};
}

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports: * (any non-slash), ** (any path), ? (single char)
 */
function globToRegex(pattern: string): RegExp {
	let regex = "^";
	let i = 0;
	while (i < pattern.length) {
		const c = pattern[i];
		if (c === "*" && pattern[i + 1] === "*") {
			regex += ".*";
			i += 2;
			if (pattern[i] === "/") i++; // skip trailing slash after **
		} else if (c === "*") {
			regex += "[^/]*";
			i++;
		} else if (c === "?") {
			regex += "[^/]";
			i++;
		} else if (c === ".") {
			regex += "\\.";
			i++;
		} else {
			regex += c;
			i++;
		}
	}
	regex += "$";
	return new RegExp(regex);
}
