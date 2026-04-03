import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCodeModeApi } from "./code-mode-runtime.ts";
import type { CodeModeApi } from "./types.ts";

let testDir: string;
let api: CodeModeApi;

beforeEach(async () => {
	testDir = await mkdtemp(join(tmpdir(), "construye-codemode-"));
	api = createCodeModeApi(testDir);
});

afterEach(async () => {
	await rm(testDir, { recursive: true, force: true });
});

describe("createCodeModeApi", () => {
	describe("readFile", () => {
		it("reads an existing file", async () => {
			await writeFile(join(testDir, "hello.txt"), "Hello World", "utf-8");
			const content = await api.readFile("hello.txt");
			expect(content).toBe("Hello World");
		});

		it("throws for non-existent file", async () => {
			await expect(api.readFile("nope.txt")).rejects.toThrow();
		});
	});

	describe("writeFile", () => {
		it("creates a new file", async () => {
			await api.writeFile("new.txt", "new content");
			const content = await readFile(join(testDir, "new.txt"), "utf-8");
			expect(content).toBe("new content");
		});

		it("creates nested directories", async () => {
			await api.writeFile("deep/nested/dir/file.ts", "export const x = 1;");
			const content = await readFile(
				join(testDir, "deep/nested/dir/file.ts"),
				"utf-8",
			);
			expect(content).toBe("export const x = 1;");
		});

		it("overwrites existing file", async () => {
			await writeFile(join(testDir, "overwrite.txt"), "old", "utf-8");
			await api.writeFile("overwrite.txt", "new");
			const content = await readFile(join(testDir, "overwrite.txt"), "utf-8");
			expect(content).toBe("new");
		});
	});

	describe("editFile", () => {
		it("replaces exact string match", async () => {
			await writeFile(
				join(testDir, "edit.ts"),
				'const x = "old";\nconst y = 2;',
				"utf-8",
			);
			await api.editFile("edit.ts", '"old"', '"new"');
			const content = await readFile(join(testDir, "edit.ts"), "utf-8");
			expect(content).toBe('const x = "new";\nconst y = 2;');
		});

		it("throws when string not found", async () => {
			await writeFile(join(testDir, "miss.ts"), "const x = 1;", "utf-8");
			await expect(
				api.editFile("miss.ts", "not here", "replacement"),
			).rejects.toThrow("String not found");
		});

		it("throws when string is ambiguous (multiple matches)", async () => {
			await writeFile(
				join(testDir, "ambig.ts"),
				"const x = 1;\nconst x = 1;",
				"utf-8",
			);
			await expect(
				api.editFile("ambig.ts", "const x = 1;", "const x = 2;"),
			).rejects.toThrow("Ambiguous");
		});
	});

	describe("searchText", () => {
		it("finds matches across files", async () => {
			await mkdir(join(testDir, "src"), { recursive: true });
			await writeFile(join(testDir, "src/a.ts"), "export function hello() {}", "utf-8");
			await writeFile(join(testDir, "src/b.ts"), "import { hello } from './a';", "utf-8");

			const results = await api.searchText("hello");
			expect(results).toContain("src/a.ts");
			expect(results).toContain("src/b.ts");
		});

		it("returns 'No matches found.' when nothing matches", async () => {
			await writeFile(join(testDir, "empty.ts"), "const x = 1;", "utf-8");
			const results = await api.searchText("nonexistent_string_xyz");
			expect(results).toBe("No matches found.");
		});

		it("skips node_modules", async () => {
			await mkdir(join(testDir, "node_modules/pkg"), { recursive: true });
			await writeFile(join(testDir, "node_modules/pkg/index.js"), "FINDME", "utf-8");
			const results = await api.searchText("FINDME");
			expect(results).toBe("No matches found.");
		});
	});

	describe("listDir", () => {
		it("lists directory contents with trailing slash for dirs", async () => {
			await mkdir(join(testDir, "src"), { recursive: true });
			await writeFile(join(testDir, "index.ts"), "", "utf-8");
			await writeFile(join(testDir, "package.json"), "{}", "utf-8");

			const entries = await api.listDir(".");
			expect(entries).toContain("src/");
			expect(entries).toContain("index.ts");
			expect(entries).toContain("package.json");
		});
	});

	describe("glob", () => {
		it("matches TypeScript files", async () => {
			await mkdir(join(testDir, "src/utils"), { recursive: true });
			await writeFile(join(testDir, "src/index.ts"), "", "utf-8");
			await writeFile(join(testDir, "src/utils/helpers.ts"), "", "utf-8");
			await writeFile(join(testDir, "readme.md"), "", "utf-8");

			const matches = await api.glob("**/*.ts");
			expect(matches).toContain("src/index.ts");
			expect(matches).toContain("src/utils/helpers.ts");
			expect(matches).not.toContain("readme.md");
		});
	});

	describe("path security", () => {
		it("blocks path traversal attempts", async () => {
			await expect(api.readFile("../../../etc/passwd")).rejects.toThrow(
				"Path escape",
			);
		});

		it("blocks absolute path outside project", async () => {
			await expect(api.readFile("/etc/passwd")).rejects.toThrow(
				"Path escape",
			);
		});
	});
});
