/**
 * Level 1 — Atomic Tasks
 *
 * Single-capability benchmarks: 1-3 tool calls each.
 * These test whether the agent can reliably perform fundamental operations.
 */
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { BenchmarkTask, VerificationResult } from "./types.ts";

// ─── Helpers ─────────────────────────────────────────────────
function check(name: string, passed: boolean, weight = 1, expected?: string, actual?: string) {
	return { name, passed, weight, expected, actual };
}

function scored(checks: ReturnType<typeof check>[]): VerificationResult {
	const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
	const earnedWeight = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
	const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
	return {
		passed: checks.every((c) => c.passed),
		score,
		details: checks
			.filter((c) => !c.passed)
			.map((c) => `FAIL: ${c.name}${c.expected ? ` (expected: ${c.expected}, got: ${c.actual})` : ""}`)
			.join("; ") || "All checks passed",
		checks,
	};
}

// ─── L1-001: Read a file and report its line count ──────────
export const L1_FILE_READ_01: BenchmarkTask = {
	id: "L1-file-read-01",
	name: "Read file and count lines",
	level: 1,
	category: "file_read",
	prompt: "Read the file 'data.txt' and tell me how many lines it has.",
	expectedToolCalls: 1,
	maxToolCalls: 3,
	timeoutMs: 15000,
	tags: ["read", "basic"],
	async setup(workDir) {
		const lines = Array.from({ length: 42 }, (_, i) => `Line ${i + 1}: Sample data`);
		await fsp.writeFile(path.join(workDir, "data.txt"), lines.join("\n"), "utf-8");
	},
	async verify(workDir) {
		// The agent should respond with 42 lines
		// Since we verify via the response, we just check the file still exists
		const exists = await fsp.access(path.join(workDir, "data.txt")).then(() => true, () => false);
		return scored([check("file_exists", exists)]);
	},
};

// ─── L1-002: Create a file with specific content ────────────
export const L1_FILE_WRITE_01: BenchmarkTask = {
	id: "L1-file-write-01",
	name: "Create a TypeScript module",
	level: 1,
	category: "file_write",
	prompt: "Create a file called 'src/utils.ts' that exports a function named 'add' which takes two numbers and returns their sum.",
	expectedToolCalls: 1,
	maxToolCalls: 3,
	timeoutMs: 15000,
	tags: ["write", "typescript"],
	async setup(workDir) {
		await fsp.mkdir(path.join(workDir, "src"), { recursive: true });
	},
	async verify(workDir) {
		const filePath = path.join(workDir, "src", "utils.ts");
		const checks = [];

		const exists = await fsp.access(filePath).then(() => true, () => false);
		checks.push(check("file_exists", exists, 2));

		if (exists) {
			const content = await fsp.readFile(filePath, "utf-8");
			checks.push(check("exports_function", /export\s+(function|const)\s+add/.test(content), 3));
			checks.push(check("has_two_params", /add\s*\([^)]*,\s*[^)]*\)/.test(content), 2));
			checks.push(check("returns_sum", /return\s+[a-z]\s*\+\s*[a-z]/i.test(content) || content.includes("=>"), 2));
			checks.push(check("is_typescript", /:\s*number/.test(content), 1));
		}

		return scored(checks);
	},
};

// ─── L1-003: Edit a specific line in a file ─────────────────
export const L1_FILE_EDIT_01: BenchmarkTask = {
	id: "L1-file-edit-01",
	name: "Fix a typo in a config file",
	level: 1,
	category: "file_edit",
	prompt: "Fix the typo in 'config.json': the key 'databse' should be 'database'.",
	expectedToolCalls: 2,
	maxToolCalls: 5,
	timeoutMs: 15000,
	tags: ["edit", "json"],
	async setup(workDir) {
		const config = JSON.stringify(
			{ name: "myapp", version: "1.0.0", databse: { host: "localhost", port: 5432 } },
			null,
			2,
		);
		await fsp.writeFile(path.join(workDir, "config.json"), config, "utf-8");
	},
	async verify(workDir) {
		const filePath = path.join(workDir, "config.json");
		const checks = [];

		const content = await fsp.readFile(filePath, "utf-8");
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(content);
			checks.push(check("valid_json", true, 2));
		} catch {
			return scored([check("valid_json", false, 10, "valid JSON", "parse error")]);
		}

		checks.push(check("typo_fixed", "database" in parsed, 5, "database", Object.keys(parsed).join(",")));
		checks.push(check("old_key_removed", !("databse" in parsed), 3));
		checks.push(check("host_preserved", (parsed.database as Record<string, unknown>)?.host === "localhost", 2));

		return scored(checks);
	},
};

// ─── L1-004: Search for a pattern in files ──────────────────
export const L1_SEARCH_01: BenchmarkTask = {
	id: "L1-search-01",
	name: "Find all TODO comments",
	level: 1,
	category: "search",
	prompt: "Search the project for all TODO comments and list the files and line numbers where they appear.",
	expectedToolCalls: 1,
	maxToolCalls: 4,
	timeoutMs: 15000,
	tags: ["search", "grep"],
	async setup(workDir) {
		await fsp.mkdir(path.join(workDir, "src"), { recursive: true });
		await fsp.writeFile(
			path.join(workDir, "src", "main.ts"),
			[
				'import { helper } from "./helper.ts";',
				"",
				"// TODO: Add error handling here",
				"function main() {",
				"  helper();",
				"}",
			].join("\n"),
			"utf-8",
		);
		await fsp.writeFile(
			path.join(workDir, "src", "helper.ts"),
			[
				"// TODO: Optimize this function",
				"export function helper() {",
				'  console.log("hello");',
				"  // TODO: Add logging",
				"}",
			].join("\n"),
			"utf-8",
		);
		await fsp.writeFile(path.join(workDir, "src", "clean.ts"), "export const x = 1;\n", "utf-8");
	},
	async verify(workDir) {
		// We verify the setup files still exist (search is read-only)
		const mainExists = await fsp.access(path.join(workDir, "src", "main.ts")).then(() => true, () => false);
		const helperExists = await fsp.access(path.join(workDir, "src", "helper.ts")).then(() => true, () => false);
		return scored([
			check("main_exists", mainExists),
			check("helper_exists", helperExists),
		]);
	},
};

// ─── L1-005: Execute a shell command ────────────────────────
export const L1_EXEC_01: BenchmarkTask = {
	id: "L1-exec-01",
	name: "Run a command and create output file",
	level: 1,
	category: "exec",
	prompt: "Run 'echo hello > output.txt' in the project directory to create an output file.",
	expectedToolCalls: 1,
	maxToolCalls: 3,
	timeoutMs: 15000,
	tags: ["exec", "shell"],
	async setup() {
		// No setup needed
	},
	async verify(workDir) {
		const filePath = path.join(workDir, "output.txt");
		const exists = await fsp.access(filePath).then(() => true, () => false);
		const checks = [check("file_created", exists, 5)];

		if (exists) {
			const content = await fsp.readFile(filePath, "utf-8");
			checks.push(check("correct_content", content.trim() === "hello", 5, "hello", content.trim()));
		}

		return scored(checks);
	},
};

// ─── L1-006: List directory contents ────────────────────────
export const L1_LIST_DIR_01: BenchmarkTask = {
	id: "L1-list-dir-01",
	name: "List directory structure",
	level: 1,
	category: "file_read",
	prompt: "List the contents of the 'src' directory and tell me how many TypeScript files are in it.",
	expectedToolCalls: 1,
	maxToolCalls: 3,
	timeoutMs: 15000,
	tags: ["list", "directory"],
	async setup(workDir) {
		const srcDir = path.join(workDir, "src");
		await fsp.mkdir(srcDir, { recursive: true });
		await fsp.writeFile(path.join(srcDir, "index.ts"), "export {};", "utf-8");
		await fsp.writeFile(path.join(srcDir, "utils.ts"), "export {};", "utf-8");
		await fsp.writeFile(path.join(srcDir, "types.ts"), "export {};", "utf-8");
		await fsp.writeFile(path.join(srcDir, "README.md"), "# Docs", "utf-8");
		await fsp.writeFile(path.join(srcDir, ".gitignore"), "node_modules", "utf-8");
	},
	async verify(workDir) {
		// Verify setup files are intact (listing is read-only)
		const entries = await fsp.readdir(path.join(workDir, "src"));
		const tsFiles = entries.filter((e) => e.endsWith(".ts"));
		return scored([
			check("has_files", entries.length === 5, 3, "5", String(entries.length)),
			check("has_3_ts_files", tsFiles.length === 3, 7, "3", String(tsFiles.length)),
		]);
	},
};

// ─── L1-007: Create multiple files ──────────────────────────
export const L1_FILE_WRITE_02: BenchmarkTask = {
	id: "L1-file-write-02",
	name: "Create package.json",
	level: 1,
	category: "file_write",
	prompt: 'Create a package.json file with name "benchmark-test", version "1.0.0", type "module", and a main field pointing to "src/index.ts".',
	expectedToolCalls: 1,
	maxToolCalls: 3,
	timeoutMs: 15000,
	tags: ["write", "json", "package"],
	async setup() {
		// Empty project
	},
	async verify(workDir) {
		const filePath = path.join(workDir, "package.json");
		const checks = [];
		const exists = await fsp.access(filePath).then(() => true, () => false);
		checks.push(check("file_exists", exists, 1));

		if (exists) {
			const content = await fsp.readFile(filePath, "utf-8");
			let pkg: Record<string, unknown>;
			try {
				pkg = JSON.parse(content);
				checks.push(check("valid_json", true, 2));
			} catch {
				return scored([check("valid_json", false, 10)]);
			}
			checks.push(check("name_correct", pkg.name === "benchmark-test", 2, "benchmark-test", String(pkg.name)));
			checks.push(check("version_correct", pkg.version === "1.0.0", 2, "1.0.0", String(pkg.version)));
			checks.push(check("type_module", pkg.type === "module", 2, "module", String(pkg.type)));
			checks.push(check("main_field", String(pkg.main).includes("index"), 1));
		}

		return scored(checks);
	},
};

// ─── L1-008: Read and extract data from a file ─────────────
export const L1_FILE_READ_02: BenchmarkTask = {
	id: "L1-file-read-02",
	name: "Read CSV and extract values",
	level: 1,
	category: "file_read",
	prompt: "Read 'data.csv' and tell me the total sum of all values in the 'amount' column.",
	expectedToolCalls: 1,
	maxToolCalls: 3,
	timeoutMs: 15000,
	tags: ["read", "csv", "data"],
	async setup(workDir) {
		const csv = [
			"name,amount,date",
			"Alpha,100,2024-01-01",
			"Beta,250,2024-01-02",
			"Gamma,150,2024-01-03",
			"Delta,300,2024-01-04",
			"Epsilon,200,2024-01-05",
		].join("\n");
		await fsp.writeFile(path.join(workDir, "data.csv"), csv, "utf-8");
	},
	async verify(workDir) {
		// Verify data file is intact
		const content = await fsp.readFile(path.join(workDir, "data.csv"), "utf-8");
		const lines = content.trim().split("\n").slice(1);
		const sum = lines.reduce((s, l) => s + Number(l.split(",")[1]), 0);
		return scored([check("data_correct", sum === 1000, 10, "1000", String(sum))]);
	},
};

// ─── L1-009: Edit multiple strings in same file ─────────────
export const L1_FILE_EDIT_02: BenchmarkTask = {
	id: "L1-file-edit-02",
	name: "Update version in config",
	level: 1,
	category: "file_edit",
	prompt: 'In the file "package.json", update the version from "0.1.0" to "1.0.0" and change the description to "Production release".',
	expectedToolCalls: 2,
	maxToolCalls: 6,
	timeoutMs: 15000,
	tags: ["edit", "json", "multi-edit"],
	async setup(workDir) {
		const pkg = {
			name: "my-lib",
			version: "0.1.0",
			description: "Beta version",
			main: "index.js",
		};
		await fsp.writeFile(path.join(workDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");
	},
	async verify(workDir) {
		const content = await fsp.readFile(path.join(workDir, "package.json"), "utf-8");
		const checks = [];
		let pkg: Record<string, unknown>;
		try {
			pkg = JSON.parse(content);
			checks.push(check("valid_json", true, 2));
		} catch {
			return scored([check("valid_json", false, 10)]);
		}
		checks.push(check("version_updated", pkg.version === "1.0.0", 4, "1.0.0", String(pkg.version)));
		checks.push(check("description_updated", String(pkg.description).includes("Production"), 4, "Production release", String(pkg.description)));
		checks.push(check("name_preserved", pkg.name === "my-lib", 2));
		checks.push(check("main_preserved", pkg.main === "index.js", 1));
		return scored(checks);
	},
};

// ─── L1-010: Execute and capture output ─────────────────────
export const L1_EXEC_02: BenchmarkTask = {
	id: "L1-exec-02",
	name: "Get Node.js version",
	level: 1,
	category: "exec",
	prompt: "Run 'node --version' and write the output to a file called 'node-version.txt'.",
	expectedToolCalls: 2,
	maxToolCalls: 5,
	timeoutMs: 15000,
	tags: ["exec", "write", "multi-tool"],
	async setup() {},
	async verify(workDir) {
		const filePath = path.join(workDir, "node-version.txt");
		const checks = [];
		const exists = await fsp.access(filePath).then(() => true, () => false);
		checks.push(check("file_created", exists, 3));

		if (exists) {
			const content = await fsp.readFile(filePath, "utf-8");
			checks.push(check("has_version", /v\d+\.\d+\.\d+/.test(content.trim()), 7, "vX.X.X", content.trim()));
		}

		return scored(checks);
	},
};

// ─── L1-011: Create a file with error handling ──────────────
export const L1_FILE_WRITE_03: BenchmarkTask = {
	id: "L1-file-write-03",
	name: "Create a Vitest test file",
	level: 1,
	category: "file_write",
	prompt: "Create a file 'src/math.test.ts' that imports 'add' from './math.ts' and tests that add(2, 3) returns 5 using Vitest.",
	expectedToolCalls: 1,
	maxToolCalls: 3,
	timeoutMs: 15000,
	tags: ["write", "test", "vitest"],
	async setup(workDir) {
		await fsp.mkdir(path.join(workDir, "src"), { recursive: true });
		await fsp.writeFile(
			path.join(workDir, "src", "math.ts"),
			"export function add(a: number, b: number): number {\n  return a + b;\n}\n",
			"utf-8",
		);
	},
	async verify(workDir) {
		const filePath = path.join(workDir, "src", "math.test.ts");
		const checks = [];
		const exists = await fsp.access(filePath).then(() => true, () => false);
		checks.push(check("file_exists", exists, 2));

		if (exists) {
			const content = await fsp.readFile(filePath, "utf-8");
			checks.push(check("imports_vitest", /import\s*{.*(?:describe|it|expect|test).*}\s*from\s*["']vitest["']/.test(content), 2));
			checks.push(check("imports_add", /import.*add.*from.*math/.test(content), 2));
			checks.push(check("tests_add_2_3", /add\s*\(\s*2\s*,\s*3\s*\)/.test(content), 3));
			checks.push(check("expects_5", /(?:toBe|toEqual)\s*\(\s*5\s*\)/.test(content), 3));
		}

		return scored(checks);
	},
};

// ─── L1-012: Search and report ──────────────────────────────
export const L1_SEARCH_02: BenchmarkTask = {
	id: "L1-search-02",
	name: "Find function definitions",
	level: 1,
	category: "search",
	prompt: "Search the 'src' directory for all exported function definitions and list them.",
	expectedToolCalls: 1,
	maxToolCalls: 4,
	timeoutMs: 15000,
	tags: ["search", "functions"],
	async setup(workDir) {
		const srcDir = path.join(workDir, "src");
		await fsp.mkdir(srcDir, { recursive: true });
		await fsp.writeFile(
			path.join(srcDir, "math.ts"),
			"export function add(a: number, b: number) { return a + b; }\nexport function multiply(a: number, b: number) { return a * b; }\nfunction internal() { return 42; }\n",
			"utf-8",
		);
		await fsp.writeFile(
			path.join(srcDir, "strings.ts"),
			'export function capitalize(s: string) { return s[0].toUpperCase() + s.slice(1); }\nexport function reverse(s: string) { return s.split("").reverse().join(""); }\n',
			"utf-8",
		);
	},
	async verify(workDir) {
		// Verify setup is intact
		const mathExists = await fsp.access(path.join(workDir, "src", "math.ts")).then(() => true, () => false);
		const strExists = await fsp.access(path.join(workDir, "src", "strings.ts")).then(() => true, () => false);
		return scored([
			check("math_exists", mathExists),
			check("strings_exists", strExists),
		]);
	},
};

// ─── Export all L1 tasks ────────────────────────────────────
export const L1_TASKS: BenchmarkTask[] = [
	L1_FILE_READ_01,
	L1_FILE_WRITE_01,
	L1_FILE_EDIT_01,
	L1_SEARCH_01,
	L1_EXEC_01,
	L1_LIST_DIR_01,
	L1_FILE_WRITE_02,
	L1_FILE_READ_02,
	L1_FILE_EDIT_02,
	L1_EXEC_02,
	L1_FILE_WRITE_03,
	L1_SEARCH_02,
];
