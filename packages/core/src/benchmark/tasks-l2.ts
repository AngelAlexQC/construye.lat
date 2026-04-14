/**
 * Level 2 — Multi-Step Tasks
 *
 * Tasks requiring 5-15 tool calls across multiple files.
 * Tests the agent's ability to reason, plan, and coordinate.
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
		passed: checks.every((c) => c.passed),
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

// ─── L2-001: Find and fix a bug ─────────────────────────────
export const L2_DEBUGGING_01: BenchmarkTask = {
	id: "L2-debug-01",
	name: "Find and fix off-by-one bug",
	level: 2,
	category: "debugging",
	prompt: "There's a bug in 'src/pagination.ts' — the getPage function returns wrong results. The test in 'src/pagination.test.ts' fails. Find and fix the bug so the test passes.",
	expectedToolCalls: 4,
	maxToolCalls: 12,
	timeoutMs: 30000,
	tags: ["debug", "off-by-one", "test"],
	async setup(workDir) {
		const srcDir = path.join(workDir, "src");
		await fsp.mkdir(srcDir, { recursive: true });

		// Buggy implementation: off-by-one in slice
		await fsp.writeFile(
			path.join(srcDir, "pagination.ts"),
			[
				"export function getPage<T>(items: T[], page: number, pageSize: number): T[] {",
				"  const start = page * pageSize; // BUG: should be (page - 1) * pageSize",
				"  const end = start + pageSize;",
				"  return items.slice(start, end);",
				"}",
				"",
				"export function getTotalPages(total: number, pageSize: number): number {",
				"  return Math.ceil(total / pageSize);",
				"}",
			].join("\n"),
			"utf-8",
		);

		await fsp.writeFile(
			path.join(srcDir, "pagination.test.ts"),
			[
				'import { describe, it, expect } from "vitest";',
				'import { getPage, getTotalPages } from "./pagination.ts";',
				"",
				'describe("pagination", () => {',
				'  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];',
				"",
				'  it("should return first page correctly", () => {',
				"    expect(getPage(items, 1, 3)).toEqual([1, 2, 3]);",
				"  });",
				"",
				'  it("should return second page", () => {',
				"    expect(getPage(items, 2, 3)).toEqual([4, 5, 6]);",
				"  });",
				"",
				'  it("should return last page with remaining items", () => {',
				"    expect(getPage(items, 4, 3)).toEqual([10]);",
				"  });",
				"",
				'  it("should calculate total pages", () => {',
				"    expect(getTotalPages(10, 3)).toBe(4);",
				"  });",
				"});",
			].join("\n"),
			"utf-8",
		);
	},
	async verify(workDir) {
		const content = await fsp.readFile(path.join(workDir, "src", "pagination.ts"), "utf-8");
		const checks: VerificationCheck[] = [];

		// Check the fix: should use (page - 1) * pageSize
		checks.push(check(
			"fix_applied",
			content.includes("(page - 1)") || content.includes("page - 1"),
			5,
			"(page - 1) * pageSize",
			content.match(/const start = (.+);/)?.[1] ?? "unknown",
		));

		// Check getTotalPages is not broken
		checks.push(check("getTotalPages_intact", content.includes("Math.ceil"), 2));

		// Verify the function still exports
		checks.push(check("still_exports", content.includes("export function getPage"), 3));

		return scored(checks);
	},
};

// ─── L2-002: Create a module with tests ─────────────────────
export const L2_GENERATION_01: BenchmarkTask = {
	id: "L2-gen-01",
	name: "Create a stack data structure with tests",
	level: 2,
	category: "generation",
	prompt: "Create a TypeScript stack data structure in 'src/stack.ts' with push, pop, peek, isEmpty, and size methods. Also create 'src/stack.test.ts' with comprehensive Vitest tests for all methods.",
	expectedToolCalls: 2,
	maxToolCalls: 8,
	timeoutMs: 30000,
	tags: ["generation", "data-structure", "test"],
	async setup(workDir) {
		await fsp.mkdir(path.join(workDir, "src"), { recursive: true });
	},
	async verify(workDir) {
		const implPath = path.join(workDir, "src", "stack.ts");
		const testPath = path.join(workDir, "src", "stack.test.ts");
		const checks: VerificationCheck[] = [];

		// Implementation checks
		const implExists = await fileExists(implPath);
		checks.push(check("impl_exists", implExists, 2));

		if (implExists) {
			const impl = await fsp.readFile(implPath, "utf-8");
			checks.push(check("has_push", /push\s*\(/.test(impl), 2));
			checks.push(check("has_pop", /pop\s*\(/.test(impl), 2));
			checks.push(check("has_peek", /peek\s*\(/.test(impl), 2));
			checks.push(check("has_isEmpty", /isEmpty\s*\(/.test(impl), 1));
			checks.push(check("has_size", /size\s*[(\[]/.test(impl) || /get\s+size/.test(impl), 1));
			checks.push(check("exports", /export/.test(impl), 2));
			checks.push(check("uses_generics", /<\s*T\s*>/.test(impl), 1));
		}

		// Test checks
		const testExists = await fileExists(testPath);
		checks.push(check("test_exists", testExists, 2));

		if (testExists) {
			const test = await fsp.readFile(testPath, "utf-8");
			checks.push(check("imports_vitest", /from\s*["']vitest["']/.test(test), 1));
			checks.push(check("imports_stack", /from.*stack/.test(test), 1));
			checks.push(check("tests_push", /push/.test(test), 1));
			checks.push(check("tests_pop", /pop/.test(test), 1));
			checks.push(check("has_assertions", /expect/.test(test), 2));
		}

		return scored(checks);
	},
};

// ─── L2-003: Refactor across files ──────────────────────────
export const L2_REFACTORING_01: BenchmarkTask = {
	id: "L2-refactor-01",
	name: "Extract constants into shared module",
	level: 2,
	category: "refactoring",
	prompt: "The files 'src/api.ts' and 'src/client.ts' both hardcode the same API URL 'https://api.example.com/v1'. Extract this into a 'src/constants.ts' file as a named export and update both files to import from there.",
	expectedToolCalls: 5,
	maxToolCalls: 12,
	timeoutMs: 30000,
	tags: ["refactor", "extract", "multi-file"],
	async setup(workDir) {
		const srcDir = path.join(workDir, "src");
		await fsp.mkdir(srcDir, { recursive: true });

		await fsp.writeFile(
			path.join(srcDir, "api.ts"),
			[
				'const BASE_URL = "https://api.example.com/v1";',
				"",
				"export async function fetchUsers() {",
				"  const response = await fetch(`${BASE_URL}/users`);",
				"  return response.json();",
				"}",
				"",
				"export async function fetchPosts() {",
				"  const response = await fetch(`${BASE_URL}/posts`);",
				"  return response.json();",
				"}",
			].join("\n"),
			"utf-8",
		);

		await fsp.writeFile(
			path.join(srcDir, "client.ts"),
			[
				'const API_URL = "https://api.example.com/v1";',
				"",
				"export class Client {",
				"  async get(path: string) {",
				"    return fetch(`${API_URL}${path}`);",
				"  }",
				"",
				"  async post(path: string, data: unknown) {",
				"    return fetch(`${API_URL}${path}`, {",
				'      method: "POST",',
				"      body: JSON.stringify(data),",
				"    });",
				"  }",
				"}",
			].join("\n"),
			"utf-8",
		);
	},
	async verify(workDir) {
		const checks: VerificationCheck[] = [];
		const srcDir = path.join(workDir, "src");

		// constants.ts should exist with the URL
		const constPath = path.join(srcDir, "constants.ts");
		const constExists = await fileExists(constPath);
		checks.push(check("constants_file_created", constExists, 3));

		if (constExists) {
			const constContent = await fsp.readFile(constPath, "utf-8");
			checks.push(check("exports_url", /export\s+(const|let|var)\s+\w+.*=.*["']https:\/\/api\.example\.com\/v1["']/.test(constContent), 3));
		}

		// api.ts should import from constants
		const apiContent = await fsp.readFile(path.join(srcDir, "api.ts"), "utf-8");
		checks.push(check("api_imports_constants", /import.*from\s*["']\.\/constants/.test(apiContent), 3));
		checks.push(check("api_no_hardcoded_url", !apiContent.includes('"https://api.example.com/v1"'), 2));
		checks.push(check("api_still_has_functions", /export\s+async\s+function\s+fetchUsers/.test(apiContent), 1));

		// client.ts should import from constants
		const clientContent = await fsp.readFile(path.join(srcDir, "client.ts"), "utf-8");
		checks.push(check("client_imports_constants", /import.*from\s*["']\.\/constants/.test(clientContent), 3));
		checks.push(check("client_no_hardcoded_url", !clientContent.includes('"https://api.example.com/v1"'), 2));
		checks.push(check("client_still_has_class", /export\s+class\s+Client/.test(clientContent), 1));

		return scored(checks);
	},
};

// ─── L2-004: Add error handling to existing code ────────────
export const L2_DEBUGGING_02: BenchmarkTask = {
	id: "L2-debug-02",
	name: "Add error handling to file reader",
	level: 2,
	category: "debugging",
	prompt: "The file 'src/reader.ts' reads files but has no error handling. Add proper try/catch blocks that handle: file not found, permission denied, and invalid JSON. Each error should return a descriptive error message. Don't change the function signatures.",
	expectedToolCalls: 3,
	maxToolCalls: 10,
	timeoutMs: 30000,
	tags: ["error-handling", "robustness"],
	async setup(workDir) {
		const srcDir = path.join(workDir, "src");
		await fsp.mkdir(srcDir, { recursive: true });

		await fsp.writeFile(
			path.join(srcDir, "reader.ts"),
			[
				'import * as fs from "node:fs/promises";',
				"",
				"export async function readTextFile(path: string): Promise<string> {",
				'  const content = await fs.readFile(path, "utf-8");',
				"  return content;",
				"}",
				"",
				"export async function readJsonFile<T>(path: string): Promise<T> {",
				'  const content = await fs.readFile(path, "utf-8");',
				"  return JSON.parse(content);",
				"}",
				"",
				"export async function readLines(path: string): Promise<string[]> {",
				'  const content = await fs.readFile(path, "utf-8");',
				'  return content.split("\\n");',
				"}",
			].join("\n"),
			"utf-8",
		);
	},
	async verify(workDir) {
		const content = await fsp.readFile(path.join(workDir, "src", "reader.ts"), "utf-8");
		const checks: VerificationCheck[] = [];

		// Should have try/catch in all three functions
		const tryCatches = (content.match(/try\s*{/g) || []).length;
		checks.push(check("has_try_catch", tryCatches >= 2, 4, ">=2", String(tryCatches)));

		// Should handle specific error types or codes
		checks.push(check("handles_not_found", /ENOENT|not found|no such file/i.test(content), 3));

		// Should still export all three functions
		checks.push(check("exports_readTextFile", /export.*function\s+readTextFile/.test(content), 2));
		checks.push(check("exports_readJsonFile", /export.*function\s+readJsonFile/.test(content), 2));
		checks.push(check("exports_readLines", /export.*function\s+readLines/.test(content), 2));

		// Should handle JSON parse errors
		checks.push(check("handles_json_error", /JSON|parse|SyntaxError/i.test(content), 2));

		return scored(checks);
	},
};

// ─── L2-005: Generate a module from spec ────────────────────
export const L2_GENERATION_02: BenchmarkTask = {
	id: "L2-gen-02",
	name: "Create a simple HTTP router",
	level: 2,
	category: "generation",
	prompt: "Create a simple HTTP router in 'src/router.ts'. It should:\n1. Support GET and POST methods\n2. Allow registering routes with handlers\n3. Match routes and call the handler\n4. Return 404 for unmatched routes\n\nAlso create 'src/router.test.ts' with tests.",
	expectedToolCalls: 2,
	maxToolCalls: 10,
	timeoutMs: 30000,
	tags: ["generation", "http", "router"],
	async setup(workDir) {
		await fsp.mkdir(path.join(workDir, "src"), { recursive: true });
	},
	async verify(workDir) {
		const implPath = path.join(workDir, "src", "router.ts");
		const testPath = path.join(workDir, "src", "router.test.ts");
		const checks: VerificationCheck[] = [];

		const implExists = await fileExists(implPath);
		checks.push(check("impl_exists", implExists, 2));

		if (implExists) {
			const impl = await fsp.readFile(implPath, "utf-8");
			checks.push(check("has_get", /get\s*\(|GET/i.test(impl), 2));
			checks.push(check("has_post", /post\s*\(|POST/i.test(impl), 2));
			checks.push(check("has_register_or_add", /(?:register|add|route|get|post)\s*\(/i.test(impl), 2));
			checks.push(check("handles_404", /404|not\s*found/i.test(impl), 2));
			checks.push(check("exports_router", /export/.test(impl), 1));
		}

		const testExists = await fileExists(testPath);
		checks.push(check("test_exists", testExists, 2));

		if (testExists) {
			const test = await fsp.readFile(testPath, "utf-8");
			checks.push(check("has_test_cases", (test.match(/it\s*\(|test\s*\(/g) || []).length >= 2, 2));
			checks.push(check("tests_404", /404|not\s*found/i.test(test), 1));
		}

		return scored(checks);
	},
};

// ─── L2-006: Write tests for existing code ──────────────────
export const L2_TESTING_01: BenchmarkTask = {
	id: "L2-test-01",
	name: "Write tests for existing validators",
	level: 2,
	category: "testing",
	prompt: "Read the validators in 'src/validators.ts' and create comprehensive tests in 'src/validators.test.ts' using Vitest. Cover edge cases, invalid inputs, and boundary conditions.",
	expectedToolCalls: 3,
	maxToolCalls: 10,
	timeoutMs: 30000,
	tags: ["testing", "vitest", "validators"],
	async setup(workDir) {
		const srcDir = path.join(workDir, "src");
		await fsp.mkdir(srcDir, { recursive: true });

		await fsp.writeFile(
			path.join(srcDir, "validators.ts"),
			[
				"export function isEmail(value: string): boolean {",
				"  return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value);",
				"}",
				"",
				"export function isPositiveInt(value: unknown): value is number {",
				'  return typeof value === "number" && Number.isInteger(value) && value > 0;',
				"}",
				"",
				"export function isInRange(value: number, min: number, max: number): boolean {",
				"  return value >= min && value <= max;",
				"}",
				"",
				"export function sanitizeString(value: string): string {",
				'  return value.trim().replace(/[<>]/g, "");',
				"}",
			].join("\n"),
			"utf-8",
		);
	},
	async verify(workDir) {
		const testPath = path.join(workDir, "src", "validators.test.ts");
		const checks: VerificationCheck[] = [];

		const exists = await fileExists(testPath);
		checks.push(check("test_file_exists", exists, 2));

		if (exists) {
			const content = await fsp.readFile(testPath, "utf-8");
			checks.push(check("imports_vitest", /from\s*["']vitest["']/.test(content), 1));
			checks.push(check("imports_validators", /from.*validators/.test(content), 1));
			checks.push(check("tests_isEmail", /isEmail/.test(content), 2));
			checks.push(check("tests_isPositiveInt", /isPositiveInt/.test(content), 2));
			checks.push(check("tests_isInRange", /isInRange/.test(content), 2));
			checks.push(check("tests_sanitizeString", /sanitizeString/.test(content), 2));

			const testCount = (content.match(/it\s*\(|test\s*\(/g) || []).length;
			checks.push(check("enough_tests", testCount >= 8, 3, ">=8", String(testCount)));
			checks.push(check("has_edge_cases", /empty|null|undefined|NaN|negative|boundary|edge/i.test(content), 1));
		}

		return scored(checks);
	},
};

// ─── L2-007: Multi-file coordination ────────────────────────
export const L2_MULTI_FILE_01: BenchmarkTask = {
	id: "L2-multi-file-01",
	name: "Add a new feature across files",
	level: 2,
	category: "multi_file",
	prompt: "Add a 'delete' method to the UserService in 'src/service.ts' that deletes a user by ID. Update the interface in 'src/types.ts' and add a test in 'src/service.test.ts'.",
	expectedToolCalls: 6,
	maxToolCalls: 15,
	timeoutMs: 30000,
	tags: ["multi-file", "feature", "crud"],
	async setup(workDir) {
		const srcDir = path.join(workDir, "src");
		await fsp.mkdir(srcDir, { recursive: true });

		await fsp.writeFile(
			path.join(srcDir, "types.ts"),
			[
				"export interface User {",
				"  id: string;",
				"  name: string;",
				"  email: string;",
				"}",
				"",
				"export interface UserService {",
				"  getAll(): User[];",
				"  getById(id: string): User | undefined;",
				"  create(user: Omit<User, 'id'>): User;",
				"}",
			].join("\n"),
			"utf-8",
		);

		await fsp.writeFile(
			path.join(srcDir, "service.ts"),
			[
				'import { User, UserService } from "./types.ts";',
				"",
				"export class InMemoryUserService implements UserService {",
				"  private users: User[] = [];",
				"",
				"  getAll(): User[] {",
				"    return [...this.users];",
				"  }",
				"",
				"  getById(id: string): User | undefined {",
				"    return this.users.find(u => u.id === id);",
				"  }",
				"",
				"  create(data: Omit<User, 'id'>): User {",
				"    const user = { ...data, id: crypto.randomUUID() };",
				"    this.users.push(user);",
				"    return user;",
				"  }",
				"}",
			].join("\n"),
			"utf-8",
		);

		await fsp.writeFile(
			path.join(srcDir, "service.test.ts"),
			[
				'import { describe, it, expect, beforeEach } from "vitest";',
				'import { InMemoryUserService } from "./service.ts";',
				"",
				"describe('UserService', () => {",
				"  let service: InMemoryUserService;",
				"",
				"  beforeEach(() => {",
				"    service = new InMemoryUserService();",
				"  });",
				"",
				"  it('should create a user', () => {",
				"    const user = service.create({ name: 'Test', email: 'test@test.com' });",
				"    expect(user.id).toBeDefined();",
				"    expect(user.name).toBe('Test');",
				"  });",
				"",
				"  it('should get all users', () => {",
				"    service.create({ name: 'A', email: 'a@a.com' });",
				"    service.create({ name: 'B', email: 'b@b.com' });",
				"    expect(service.getAll()).toHaveLength(2);",
				"  });",
				"});",
			].join("\n"),
			"utf-8",
		);
	},
	async verify(workDir) {
		const checks: VerificationCheck[] = [];
		const srcDir = path.join(workDir, "src");

		// types.ts should have delete method in interface
		const types = await fsp.readFile(path.join(srcDir, "types.ts"), "utf-8");
		checks.push(check("interface_has_delete", /delete\s*\(\s*id\s*:\s*string\s*\)/.test(types), 3));

		// service.ts should implement delete
		const service = await fsp.readFile(path.join(srcDir, "service.ts"), "utf-8");
		checks.push(check("implements_delete", /delete\s*\(\s*id\s*:\s*string\s*\)/.test(service), 3));
		checks.push(check("removes_from_array", /filter|splice|findIndex/.test(service), 2));
		checks.push(check("still_has_create", /create\s*\(/.test(service), 1));
		checks.push(check("still_has_getAll", /getAll\s*\(/.test(service), 1));

		// test file should test delete
		const tests = await fsp.readFile(path.join(srcDir, "service.test.ts"), "utf-8");
		checks.push(check("test_has_delete", /delete/i.test(tests), 3));
		checks.push(check("existing_tests_intact", /create.*user/i.test(tests), 1));

		return scored(checks);
	},
};

// ─── L2-008: Read, analyze, document ────────────────────────
export const L2_PLANNING_01: BenchmarkTask = {
	id: "L2-plan-01",
	name: "Document an existing module",
	level: 2,
	category: "planning",
	prompt: "Read all files in 'src/' and create a 'docs/API.md' file that documents every exported function with its signature, parameters, return type, and a brief description.",
	expectedToolCalls: 5,
	maxToolCalls: 12,
	timeoutMs: 30000,
	tags: ["documentation", "analysis", "markdown"],
	async setup(workDir) {
		const srcDir = path.join(workDir, "src");
		await fsp.mkdir(srcDir, { recursive: true });
		await fsp.mkdir(path.join(workDir, "docs"), { recursive: true });

		await fsp.writeFile(
			path.join(srcDir, "math.ts"),
			[
				"/** Add two numbers */",
				"export function add(a: number, b: number): number {",
				"  return a + b;",
				"}",
				"",
				"/** Clamp a value between min and max */",
				"export function clamp(value: number, min: number, max: number): number {",
				"  return Math.min(Math.max(value, min), max);",
				"}",
			].join("\n"),
			"utf-8",
		);

		await fsp.writeFile(
			path.join(srcDir, "strings.ts"),
			[
				"/** Capitalize first letter */",
				"export function capitalize(s: string): string {",
				'  return s.charAt(0).toUpperCase() + s.slice(1);',
				"}",
				"",
				"/** Truncate to max length with ellipsis */",
				"export function truncate(s: string, max: number): string {",
				'  return s.length > max ? s.slice(0, max) + "..." : s;',
				"}",
			].join("\n"),
			"utf-8",
		);
	},
	async verify(workDir) {
		const docPath = path.join(workDir, "docs", "API.md");
		const checks: VerificationCheck[] = [];

		const exists = await fileExists(docPath);
		checks.push(check("doc_file_created", exists, 2));

		if (exists) {
			const content = await fsp.readFile(docPath, "utf-8");
			checks.push(check("documents_add", /add/.test(content), 2));
			checks.push(check("documents_clamp", /clamp/.test(content), 2));
			checks.push(check("documents_capitalize", /capitalize/.test(content), 2));
			checks.push(check("documents_truncate", /truncate/.test(content), 2));
			checks.push(check("has_params", /param|parameter|argument/i.test(content) || /number|string/.test(content), 1));
			checks.push(check("has_returns", /return|→|->|:/.test(content), 1));
			checks.push(check("is_markdown", /^#/m.test(content), 1));
		}

		return scored(checks);
	},
};

// ─── Export all L2 tasks ────────────────────────────────────
export const L2_TASKS: BenchmarkTask[] = [
	L2_DEBUGGING_01,
	L2_GENERATION_01,
	L2_REFACTORING_01,
	L2_DEBUGGING_02,
	L2_GENERATION_02,
	L2_TESTING_01,
	L2_MULTI_FILE_01,
	L2_PLANNING_01,
];
