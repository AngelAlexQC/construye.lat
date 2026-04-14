/**
 * Level 3 — End-to-End Tasks
 *
 * Full project-level tasks requiring 15+ tool calls.
 * Tests the agent's ability to build complete, working solutions.
 */
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { BenchmarkTask, VerificationResult, VerificationCheck } from "./types.ts";

// ─── Helpers ─────────────────────────────────────────────────
function check(name: string, passed: boolean, weight = 1, expected?: string, actual?: string): VerificationCheck {
	return { name, passed, weight, expected, actual };
}

function scored(checks: VerificationCheck[]): VerificationResult {
	const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
	const earnedWeight = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
	const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
	return {
		passed: checks.filter((c) => c.weight >= 3).every((c) => c.passed), // Heavy checks must pass
		score,
		details: checks
			.filter((c) => !c.passed)
			.map((c) => `FAIL: ${c.name}${c.expected ? ` (expected: ${c.expected}, got: ${c.actual})` : ""}`)
			.join("; ") || "All checks passed",
		checks,
	};
}

async function fileExists(fp: string): Promise<boolean> {
	return fsp.access(fp).then(() => true, () => false);
}

// ─── L3-001: Build a CLI tool from spec ─────────────────────
export const L3_PROJECT_01: BenchmarkTask = {
	id: "L3-project-01",
	name: "Build a todo CLI tool",
	level: 3,
	category: "project_setup",
	prompt: `Build a command-line todo list tool in TypeScript. Requirements:
1. Create 'src/todo.ts' with a TodoList class that supports: add, remove, toggle (complete/incomplete), and list
2. Create 'src/types.ts' with a Todo interface (id: string, text: string, completed: boolean, createdAt: string)
3. Create 'src/storage.ts' that reads/writes todos to a JSON file
4. Create 'src/todo.test.ts' with Vitest tests for the TodoList class
5. Create a 'package.json' with name "todo-cli", type "module", and vitest as a dev dependency

The TodoList should use the Storage module to persist data.`,
	expectedToolCalls: 8,
	maxToolCalls: 25,
	timeoutMs: 60000,
	tags: ["project", "cli", "full-stack"],
	async setup(workDir) {
		await fsp.mkdir(path.join(workDir, "src"), { recursive: true });
	},
	async verify(workDir) {
		const checks: VerificationCheck[] = [];
		const srcDir = path.join(workDir, "src");

		// Core files exist
		for (const file of ["todo.ts", "types.ts", "storage.ts", "todo.test.ts"]) {
			const exists = await fileExists(path.join(srcDir, file));
			checks.push(check(`${file}_exists`, exists, 3));
		}
		const pkgExists = await fileExists(path.join(workDir, "package.json"));
		checks.push(check("package_json_exists", pkgExists, 3));

		// types.ts checks
		if (await fileExists(path.join(srcDir, "types.ts"))) {
			const types = await fsp.readFile(path.join(srcDir, "types.ts"), "utf-8");
			checks.push(check("todo_interface", /interface\s+Todo/.test(types), 3));
			checks.push(check("has_id_field", /id\s*:/.test(types), 1));
			checks.push(check("has_text_field", /text\s*:/.test(types), 1));
			checks.push(check("has_completed", /completed\s*:/.test(types), 1));
		}

		// todo.ts checks
		if (await fileExists(path.join(srcDir, "todo.ts"))) {
			const todo = await fsp.readFile(path.join(srcDir, "todo.ts"), "utf-8");
			checks.push(check("has_add", /add\s*\(/.test(todo), 2));
			checks.push(check("has_remove", /remove\s*\(/.test(todo) || /delete\s*\(/.test(todo), 2));
			checks.push(check("has_toggle", /toggle\s*\(/.test(todo) || /complete\s*\(/.test(todo), 2));
			checks.push(check("has_list", /list\s*\(/.test(todo) || /getAll\s*\(/.test(todo) || /get\s+todos/.test(todo), 2));
			checks.push(check("exports_class", /export\s+(class|function)/.test(todo), 1));
		}

		// storage.ts checks
		if (await fileExists(path.join(srcDir, "storage.ts"))) {
			const storage = await fsp.readFile(path.join(srcDir, "storage.ts"), "utf-8");
			checks.push(check("reads_file", /readFile/.test(storage), 2));
			checks.push(check("writes_file", /writeFile/.test(storage), 2));
			checks.push(check("uses_json", /JSON\.parse|JSON\.stringify/.test(storage), 1));
		}

		// test checks
		if (await fileExists(path.join(srcDir, "todo.test.ts"))) {
			const test = await fsp.readFile(path.join(srcDir, "todo.test.ts"), "utf-8");
			const testCount = (test.match(/it\s*\(|test\s*\(/g) || []).length;
			checks.push(check("has_tests", testCount >= 3, 3, ">=3", String(testCount)));
			checks.push(check("imports_vitest", /from\s*["']vitest["']/.test(test), 1));
		}

		// package.json checks
		if (pkgExists) {
			const pkg = JSON.parse(await fsp.readFile(path.join(workDir, "package.json"), "utf-8"));
			checks.push(check("pkg_name", pkg.name === "todo-cli", 1));
			checks.push(check("pkg_type_module", pkg.type === "module", 1));
		}

		return scored(checks);
	},
};

// ─── L3-002: Build a REST API module ────────────────────────
export const L3_PROJECT_02: BenchmarkTask = {
	id: "L3-project-02",
	name: "Build a REST API with CRUD",
	level: 3,
	category: "integration",
	prompt: `Create a clean REST API module for a "notes" resource:
1. 'src/types.ts' — Note interface (id, title, content, tags: string[], createdAt, updatedAt)
2. 'src/store.ts' — In-memory store with CRUD operations: create, getById, getAll, update, delete, searchByTag
3. 'src/handlers.ts' — Request handler functions for each endpoint (return objects, not HTTP responses)
4. 'src/routes.ts' — Route definitions mapping method+path to handlers
5. 'src/store.test.ts' — Tests for all store CRUD operations
6. 'README.md' — API documentation with endpoint descriptions`,
	expectedToolCalls: 10,
	maxToolCalls: 30,
	timeoutMs: 60000,
	tags: ["project", "api", "crud", "rest"],
	async setup(workDir) {
		await fsp.mkdir(path.join(workDir, "src"), { recursive: true });
	},
	async verify(workDir) {
		const checks: VerificationCheck[] = [];
		const srcDir = path.join(workDir, "src");

		// All files exist
		for (const file of ["types.ts", "store.ts", "handlers.ts", "routes.ts", "store.test.ts"]) {
			const exists = await fileExists(path.join(srcDir, file));
			checks.push(check(`${file}_exists`, exists, 3));
		}
		checks.push(check("readme_exists", await fileExists(path.join(workDir, "README.md")), 2));

		// types.ts
		if (await fileExists(path.join(srcDir, "types.ts"))) {
			const types = await fsp.readFile(path.join(srcDir, "types.ts"), "utf-8");
			checks.push(check("note_interface", /interface\s+Note/.test(types), 3));
			checks.push(check("has_title", /title\s*:/.test(types), 1));
			checks.push(check("has_content", /content\s*:/.test(types), 1));
			checks.push(check("has_tags", /tags\s*:/.test(types), 1));
		}

		// store.ts — CRUD
		if (await fileExists(path.join(srcDir, "store.ts"))) {
			const store = await fsp.readFile(path.join(srcDir, "store.ts"), "utf-8");
			checks.push(check("has_create", /create\s*\(/.test(store), 2));
			checks.push(check("has_getById", /getById\s*\(|get\s*\(/.test(store), 2));
			checks.push(check("has_getAll", /getAll\s*\(|list\s*\(/.test(store), 2));
			checks.push(check("has_update", /update\s*\(/.test(store), 2));
			checks.push(check("has_delete", /delete\s*\(|remove\s*\(/.test(store), 2));
			checks.push(check("has_searchByTag", /search.*Tag|byTag|filterByTag/i.test(store), 2));
		}

		// handlers.ts
		if (await fileExists(path.join(srcDir, "handlers.ts"))) {
			const handlers = await fsp.readFile(path.join(srcDir, "handlers.ts"), "utf-8");
			checks.push(check("has_handler_functions", (handlers.match(/export\s+(async\s+)?function/g) || []).length >= 3, 2));
			checks.push(check("imports_store", /import.*store/i.test(handlers), 1));
		}

		// routes.ts
		if (await fileExists(path.join(srcDir, "routes.ts"))) {
			const routes = await fsp.readFile(path.join(srcDir, "routes.ts"), "utf-8");
			checks.push(check("has_get_route", /GET/i.test(routes), 1));
			checks.push(check("has_post_route", /POST/i.test(routes), 1));
			checks.push(check("has_delete_route", /DELETE/i.test(routes), 1));
		}

		// tests
		if (await fileExists(path.join(srcDir, "store.test.ts"))) {
			const test = await fsp.readFile(path.join(srcDir, "store.test.ts"), "utf-8");
			const testCount = (test.match(/it\s*\(|test\s*\(/g) || []).length;
			checks.push(check("has_enough_tests", testCount >= 4, 3, ">=4", String(testCount)));
		}

		// README
		if (await fileExists(path.join(workDir, "README.md"))) {
			const readme = await fsp.readFile(path.join(workDir, "README.md"), "utf-8");
			checks.push(check("documents_endpoints", /endpoint|route|api/i.test(readme), 1));
		}

		return scored(checks);
	},
};

// ─── L3-003: Set up a TypeScript project structure ──────────
export const L3_PROJECT_03: BenchmarkTask = {
	id: "L3-project-03",
	name: "Scaffold a TypeScript library project",
	level: 3,
	category: "project_setup",
	prompt: `Set up a professional TypeScript library project with all the standard tooling:
1. package.json with name "@bench/mathlib", version "0.1.0", type "module", exports map pointing to dist/index.js
2. tsconfig.json with strict mode, ESM target, declaration generation
3. src/index.ts that re-exports everything from src/add.ts and src/multiply.ts
4. src/add.ts with an 'add' function
5. src/multiply.ts with a 'multiply' function
6. src/index.test.ts with tests for both functions
7. README.md with usage examples`,
	expectedToolCalls: 10,
	maxToolCalls: 25,
	timeoutMs: 60000,
	tags: ["project", "setup", "typescript", "library"],
	async setup(workDir) {
		// Empty project
	},
	async verify(workDir) {
		const checks: VerificationCheck[] = [];
		const srcDir = path.join(workDir, "src");

		// File existence
		checks.push(check("pkg_exists", await fileExists(path.join(workDir, "package.json")), 3));
		checks.push(check("tsconfig_exists", await fileExists(path.join(workDir, "tsconfig.json")), 3));
		checks.push(check("readme_exists", await fileExists(path.join(workDir, "README.md")), 2));

		for (const file of ["index.ts", "add.ts", "multiply.ts", "index.test.ts"]) {
			checks.push(check(`${file}_exists`, await fileExists(path.join(srcDir, file)), 3));
		}

		// package.json quality
		if (await fileExists(path.join(workDir, "package.json"))) {
			const pkg = JSON.parse(await fsp.readFile(path.join(workDir, "package.json"), "utf-8"));
			checks.push(check("pkg_name", pkg.name === "@bench/mathlib", 1));
			checks.push(check("pkg_type_module", pkg.type === "module", 2));
			checks.push(check("pkg_has_exports", !!pkg.exports, 2));
		}

		// tsconfig.json quality
		if (await fileExists(path.join(workDir, "tsconfig.json"))) {
			const tsconfig = JSON.parse(await fsp.readFile(path.join(workDir, "tsconfig.json"), "utf-8"));
			const co = tsconfig.compilerOptions ?? {};
			checks.push(check("strict_mode", co.strict === true, 2));
			checks.push(check("declaration", co.declaration === true, 1));
			checks.push(check("esm_target", /esnext|es20[2-9]/i.test(co.module ?? ""), 1));
		}

		// index.ts re-exports
		if (await fileExists(path.join(srcDir, "index.ts"))) {
			const idx = await fsp.readFile(path.join(srcDir, "index.ts"), "utf-8");
			checks.push(check("reexports_add", /export.*from.*add/i.test(idx), 2));
			checks.push(check("reexports_multiply", /export.*from.*multiply/i.test(idx), 2));
		}

		// Functions exist
		if (await fileExists(path.join(srcDir, "add.ts"))) {
			const add = await fsp.readFile(path.join(srcDir, "add.ts"), "utf-8");
			checks.push(check("add_fn", /export.*function\s+add/.test(add), 2));
		}
		if (await fileExists(path.join(srcDir, "multiply.ts"))) {
			const mul = await fsp.readFile(path.join(srcDir, "multiply.ts"), "utf-8");
			checks.push(check("multiply_fn", /export.*function\s+multiply/.test(mul), 2));
		}

		// Tests
		if (await fileExists(path.join(srcDir, "index.test.ts"))) {
			const test = await fsp.readFile(path.join(srcDir, "index.test.ts"), "utf-8");
			checks.push(check("tests_add", /add/.test(test), 1));
			checks.push(check("tests_multiply", /multiply/.test(test), 1));
			checks.push(check("imports_vitest", /vitest/.test(test), 1));
		}

		return scored(checks);
	},
};

// ─── Export all L3 tasks ────────────────────────────────────
export const L3_TASKS: BenchmarkTask[] = [
	L3_PROJECT_01,
	L3_PROJECT_02,
	L3_PROJECT_03,
];
