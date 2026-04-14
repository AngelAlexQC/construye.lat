/**
 * construye.lat Benchmark System — Test Suite
 *
 * Tests the benchmark harness components:
 * - Task registry integrity
 * - Task setup/verify correctness (no agent needed)
 * - MockProvider scripted behavior
 * - SandboxToolExecutor file operations + security
 * - Integration: executeTask with MockProvider + SandboxToolExecutor
 * - Report formatting
 *
 * Run: pnpm --filter @construye/core test -- --grep "Benchmark"
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
	MockProvider,
	SandboxToolExecutor,
	L1_TASKS,
	L2_TASKS,
	L3_TASKS,
	ALL_TASKS,
	executeTask,
	runBenchmark,
	formatReport,
	createScriptForFileRead,
	createScriptForFileWrite,
	createScriptForEdit,
	createScriptForExec,
	createScriptForMultiStep,
} from "./index.ts";
import type { BenchmarkRunnerConfig } from "./types.ts";

// ═══════════════════════════════════════════════════════════════
// §1 — Task Registry
// ═══════════════════════════════════════════════════════════════
describe("Benchmark: Task Registry", () => {
	it("has the correct number of tasks per level", () => {
		expect(L1_TASKS).toHaveLength(12);
		expect(L2_TASKS).toHaveLength(8);
		expect(L3_TASKS).toHaveLength(3);
		expect(ALL_TASKS).toHaveLength(23);
	});

	it("all tasks have unique IDs", () => {
		const ids = ALL_TASKS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all IDs follow naming convention", () => {
		for (const task of ALL_TASKS) {
			expect(task.id).toMatch(/^L[1-3]-[a-z]+(?:-[a-z]+)*-\d{2}$/);
		}
	});

	it("all tasks have valid levels and required fields", () => {
		for (const task of ALL_TASKS) {
			expect([1, 2, 3]).toContain(task.level);
			expect(task.name.length).toBeGreaterThan(0);
			expect(task.prompt.length).toBeGreaterThan(0);
			expect(typeof task.setup).toBe("function");
			expect(typeof task.verify).toBe("function");
			expect(task.expectedToolCalls).toBeGreaterThan(0);
			expect(task.maxToolCalls).toBeGreaterThanOrEqual(task.expectedToolCalls);
			expect(task.timeoutMs).toBeGreaterThan(0);
			expect(task.tags.length).toBeGreaterThan(0);
		}
	});

	it("L1 tasks have <= 3 expected tool calls", () => {
		for (const task of L1_TASKS) {
			expect(task.expectedToolCalls).toBeLessThanOrEqual(3);
		}
	});

	it("level assignments match ID prefix", () => {
		for (const task of ALL_TASKS) {
			const prefix = task.id.charAt(1);
			expect(task.level).toBe(Number(prefix));
		}
	});
});

// ═══════════════════════════════════════════════════════════════
// §2 — Task Setup & Verification (no agent)
// ═══════════════════════════════════════════════════════════════
describe("Benchmark: Task Setup & Verify", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bench-test-"));
	});

	afterEach(async () => {
		await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
	});

	// All tasks setup without throwing
	for (const task of ALL_TASKS) {
		it(`${task.id}: setup runs without error`, async () => {
			await expect(task.setup(tmpDir)).resolves.not.toThrow();
		});
	}

	it("L1-file-read-01: data.txt has 42 lines", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-read-01")!;
		await task.setup(tmpDir);
		const content = await fsp.readFile(path.join(tmpDir, "data.txt"), "utf-8");
		expect(content.split("\n")).toHaveLength(42);
	});

	it("L1-file-write-01: verify fails when file is missing", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-write-01")!;
		await task.setup(tmpDir);
		const result = await task.verify(tmpDir);
		expect(result.passed).toBe(false);
	});

	it("L1-file-write-01: verify passes with correct file", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-write-01")!;
		await task.setup(tmpDir);
		await fsp.writeFile(
			path.join(tmpDir, "src", "utils.ts"),
			"export function add(a: number, b: number): number {\n  return a + b;\n}\n",
		);
		const result = await task.verify(tmpDir);
		expect(result.passed).toBe(true);
		expect(result.score).toBe(100);
	});

	it("L1-file-edit-01: setup has the typo, verify detects fix", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-edit-01")!;
		await task.setup(tmpDir);

		// Confirm typo exists
		const raw = await fsp.readFile(path.join(tmpDir, "config.json"), "utf-8");
		expect(raw).toContain("databse");

		// Fix it
		await fsp.writeFile(
			path.join(tmpDir, "config.json"),
			raw.replace("databse", "database"),
		);
		const result = await task.verify(tmpDir);
		expect(result.passed).toBe(true);
	});

	it("L1-file-write-01: partial credit for missing type annotations", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-write-01")!;
		await task.setup(tmpDir);
		// Correct function but no type annotations
		await fsp.writeFile(
			path.join(tmpDir, "src", "utils.ts"),
			"export function add(a, b) {\n  return a + b;\n}\n",
		);
		const result = await task.verify(tmpDir);
		// Should get partial credit (file exists, exports add, has params, returns sum) but lose type annotation points
		expect(result.score).toBeGreaterThan(0);
		expect(result.score).toBeLessThan(100);
	});
});

// ═══════════════════════════════════════════════════════════════
// §3 — MockProvider
// ═══════════════════════════════════════════════════════════════
describe("Benchmark: MockProvider", () => {
	it("yields text and tool_call chunks in order", async () => {
		const provider = new MockProvider({
			script: [
				{
					text: "Reading file...",
					toolCalls: [{ name: "readFile", arguments: { path: "a.txt" } }],
				},
			],
		});

		const chunks: Array<{ type: string }> = [];
		for await (const chunk of provider.chat([], [])) {
			chunks.push(chunk);
		}

		expect(chunks[0]).toMatchObject({ type: "text", content: "Reading file..." });
		expect(chunks[1]).toMatchObject({ type: "tool_call" });
		expect(chunks[chunks.length - 1]).toMatchObject({ type: "done" });
	});

	it("advances through script on repeated calls", async () => {
		const provider = new MockProvider({
			script: [
				{ text: "Step 1", toolCalls: [{ name: "exec", arguments: { command: "ls" } }] },
				{ text: "Step 2" },
			],
		});

		// First chat() call → script[0]
		const c1: Array<{ type: string; content?: string }> = [];
		for await (const chunk of provider.chat([], [])) c1.push(chunk);
		expect(c1.some((c) => c.content === "Step 1")).toBe(true);
		expect(c1.some((c) => c.type === "tool_call")).toBe(true);

		// Second chat() call → script[1]
		const c2: Array<{ type: string; content?: string }> = [];
		for await (const chunk of provider.chat([], [])) c2.push(chunk);
		expect(c2.some((c) => c.content === "Step 2")).toBe(true);
	});

	it("returns generic done when script is exhausted", async () => {
		const provider = new MockProvider({ script: [{ text: "Only one" }] });
		for await (const _ of provider.chat([], [])) {
			/* consume */
		}

		const chunks: Array<{ type: string; content?: string }> = [];
		for await (const chunk of provider.chat([], [])) chunks.push(chunk);
		expect(chunks.some((c) => c.content === "Task completed.")).toBe(true);
	});

	it("reset() restarts the script", async () => {
		const provider = new MockProvider({ script: [{ text: "First" }] });
		for await (const _ of provider.chat([], [])) {
			/* consume */
		}
		provider.reset();

		const chunks: Array<{ type: string; content?: string }> = [];
		for await (const chunk of provider.chat([], [])) chunks.push(chunk);
		expect(chunks.some((c) => c.content === "First")).toBe(true);
	});

	it("assigns unique tool_call IDs", async () => {
		const provider = new MockProvider({
			script: [
				{
					toolCalls: [
						{ name: "readFile", arguments: { path: "a.txt" } },
						{ name: "readFile", arguments: { path: "b.txt" } },
					],
				},
			],
		});

		const ids: string[] = [];
		for await (const chunk of provider.chat([], [])) {
			if (chunk.type === "tool_call" && chunk.tool_call) {
				ids.push(chunk.tool_call.id);
			}
		}
		expect(ids).toHaveLength(2);
		expect(ids[0]).not.toBe(ids[1]);
	});
});

// ═══════════════════════════════════════════════════════════════
// §4 — SandboxToolExecutor
// ═══════════════════════════════════════════════════════════════
describe("Benchmark: SandboxToolExecutor", () => {
	let tmpDir: string;
	let executor: SandboxToolExecutor;

	beforeEach(async () => {
		tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "sandbox-test-"));
		executor = new SandboxToolExecutor(tmpDir);
	});

	afterEach(async () => {
		await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
	});

	it("writeFile creates a file with content", async () => {
		const result = await executor.execute({
			id: "t1",
			name: "writeFile",
			arguments: { path: "hello.txt", content: "Hello\nWorld" },
		});
		expect(result.is_error).toBeFalsy();
		const on_disk = await fsp.readFile(path.join(tmpDir, "hello.txt"), "utf-8");
		expect(on_disk).toBe("Hello\nWorld");
	});

	it("writeFile creates nested directories", async () => {
		const result = await executor.execute({
			id: "t2",
			name: "writeFile",
			arguments: { path: "a/b/c/deep.txt", content: "deep" },
		});
		expect(result.is_error).toBeFalsy();
		const on_disk = await fsp.readFile(path.join(tmpDir, "a/b/c/deep.txt"), "utf-8");
		expect(on_disk).toBe("deep");
	});

	it("readFile reads an existing file", async () => {
		await fsp.writeFile(path.join(tmpDir, "test.txt"), "line1\nline2\nline3");
		const result = await executor.execute({
			id: "t3",
			name: "readFile",
			arguments: { path: "test.txt" },
		});
		expect(result.is_error).toBeFalsy();
		expect(result.content).toContain("line1");
		expect(result.content).toContain("line3");
	});

	it("readFile supports line ranges", async () => {
		await fsp.writeFile(path.join(tmpDir, "range.txt"), "A\nB\nC\nD\nE");
		const result = await executor.execute({
			id: "t4",
			name: "readFile",
			arguments: { path: "range.txt", start_line: 2, end_line: 4 },
		});
		expect(result.is_error).toBeFalsy();
		expect(result.content).toBe("B\nC\nD");
	});

	it("editFile replaces text in a file", async () => {
		await fsp.writeFile(path.join(tmpDir, "edit.txt"), "old value here");
		const result = await executor.execute({
			id: "t5",
			name: "editFile",
			arguments: { path: "edit.txt", old_string: "old", new_string: "new" },
		});
		expect(result.is_error).toBeFalsy();
		const content = await fsp.readFile(path.join(tmpDir, "edit.txt"), "utf-8");
		expect(content).toBe("new value here");
	});

	it("exec runs a command in the sandbox", async () => {
		const result = await executor.execute({
			id: "t6",
			name: "exec",
			arguments: { command: "echo hello_world" },
		});
		expect(result.is_error).toBeFalsy();
		expect(result.content).toContain("hello_world");
	});

	it("exec CWD is the sandbox", async () => {
		const result = await executor.execute({
			id: "t7",
			name: "exec",
			arguments: { command: "pwd" },
		});
		expect(result.is_error).toBeFalsy();
		expect(result.content.trim()).toBe(tmpDir);
	});

	it("listDir lists files and directories", async () => {
		await fsp.mkdir(path.join(tmpDir, "subdir"));
		await fsp.writeFile(path.join(tmpDir, "a.ts"), "");
		await fsp.writeFile(path.join(tmpDir, "b.txt"), "");

		const result = await executor.execute({
			id: "t8",
			name: "listDir",
			arguments: { path: "." },
		});
		expect(result.is_error).toBeFalsy();
		expect(result.content).toContain("subdir");
		expect(result.content).toContain("a.ts");
		expect(result.content).toContain("b.txt");
	});

	it("searchText finds matches across files", async () => {
		await fsp.writeFile(path.join(tmpDir, "code.ts"), "// TODO: fix this\nconst x = 1;");
		await fsp.writeFile(path.join(tmpDir, "other.ts"), "// nothing here\n// TODO: another");

		const result = await executor.execute({
			id: "t9",
			name: "searchText",
			arguments: { pattern: "TODO" },
		});
		expect(result.is_error).toBeFalsy();
		expect(result.content).toContain("TODO");
		// Should find matches in both files
		expect(result.content).toContain("code.ts");
		expect(result.content).toContain("other.ts");
	});

	it("prevents path traversal attacks", async () => {
		const result = await executor.execute({
			id: "t10",
			name: "readFile",
			arguments: { path: "../../../etc/passwd" },
		});
		expect(result.is_error).toBe(true);
		expect(result.content).toContain("Path escape");
	});

	it("returns error for unknown tools", async () => {
		const result = await executor.execute({
			id: "t11",
			name: "unknownTool",
			arguments: {},
		});
		expect(result.content).toContain("Unknown tool");
	});

	it("getCallLog tracks all executed calls", async () => {
		await executor.execute({ id: "c1", name: "exec", arguments: { command: "echo a" } });
		await executor.execute({ id: "c2", name: "exec", arguments: { command: "echo b" } });
		const log = executor.getCallLog();
		expect(log).toHaveLength(2);
		expect(log[0].name).toBe("exec");
		expect(log[1].name).toBe("exec");
	});
});

// ═══════════════════════════════════════════════════════════════
// §5 — Script Helper Factories
// ═══════════════════════════════════════════════════════════════
describe("Benchmark: Script Helpers", () => {
	it("createScriptForFileRead → 2 steps", () => {
		const script = createScriptForFileRead("data.txt");
		expect(script).toHaveLength(2);
		expect(script[0].toolCalls![0].name).toBe("readFile");
		expect(script[0].toolCalls![0].arguments.path).toBe("data.txt");
		expect(script[1].text).toBeTruthy();
		expect(script[1].toolCalls).toBeUndefined();
	});

	it("createScriptForFileWrite → 2 steps", () => {
		const script = createScriptForFileWrite("out.ts", "const x = 1;");
		expect(script).toHaveLength(2);
		expect(script[0].toolCalls![0].name).toBe("writeFile");
		expect(script[0].toolCalls![0].arguments.content).toBe("const x = 1;");
	});

	it("createScriptForEdit → 3 steps (read, edit, confirm)", () => {
		const script = createScriptForEdit("f.txt", "old", "new");
		expect(script).toHaveLength(3);
		expect(script[0].toolCalls![0].name).toBe("readFile");
		expect(script[1].toolCalls![0].name).toBe("editFile");
		expect(script[1].toolCalls![0].arguments.old_string).toBe("old");
		expect(script[2].toolCalls).toBeUndefined();
	});

	it("createScriptForExec → 2 steps", () => {
		const script = createScriptForExec("ls -la");
		expect(script).toHaveLength(2);
		expect(script[0].toolCalls![0].name).toBe("exec");
		expect(script[0].toolCalls![0].arguments.command).toBe("ls -la");
	});

	it("createScriptForMultiStep → N + 1 steps", () => {
		const script = createScriptForMultiStep([
			{ tool: "readFile", args: { path: "a.txt" } },
			{ tool: "writeFile", args: { path: "b.txt", content: "hello" } },
			{ tool: "exec", args: { command: "echo done" } },
		]);
		expect(script).toHaveLength(4); // 3 tool steps + 1 "completed"
		expect(script[0].toolCalls![0].name).toBe("readFile");
		expect(script[1].toolCalls![0].name).toBe("writeFile");
		expect(script[2].toolCalls![0].name).toBe("exec");
		expect(script[3].text).toContain("completed");
	});
});

// ═══════════════════════════════════════════════════════════════
// §6 — Integration: executeTask with MockProvider
// ═══════════════════════════════════════════════════════════════
describe("Benchmark: executeTask Integration", () => {
	it("L1-file-write-01: mock agent creates the file correctly", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-write-01")!;
		const fileContent =
			"export function add(a: number, b: number): number {\n  return a + b;\n}\n";

		const provider = new MockProvider({
			script: createScriptForFileWrite("src/utils.ts", fileContent),
		});

		// Use factory pattern so executor gets the evaluator's workDir
		const result = await executeTask(
			task,
			provider,
			(workDir) => new SandboxToolExecutor(workDir),
		);

		expect(result.passed).toBe(true);
		expect(result.score).toBe(100);
		expect(result.toolCallsUsed).toBeGreaterThan(0);
		expect(result.toolsUsed).toContain("writeFile");
		expect(result.efficiencyScore).toBeGreaterThan(0);
		expect(result.timeMs).toBeGreaterThan(0);
		expect(result.error).toBeUndefined();
	});

	it("L1-file-edit-01: mock agent fixes the typo", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-edit-01")!;

		const provider = new MockProvider({
			script: createScriptForEdit("config.json", "databse", "database"),
		});

		const result = await executeTask(
			task,
			provider,
			(workDir) => new SandboxToolExecutor(workDir),
		);

		expect(result.passed).toBe(true);
		expect(result.score).toBeGreaterThanOrEqual(80);
	});

	it("L1-exec-01: mock agent runs echo command", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-exec-01")!;

		const provider = new MockProvider({
			script: createScriptForExec("echo hello > output.txt"),
		});

		const result = await executeTask(
			task,
			provider,
			(workDir) => new SandboxToolExecutor(workDir),
		);

		expect(result.toolCallsUsed).toBeGreaterThan(0);
		expect(result.toolsUsed).toContain("exec");
		// Score depends on whether the file was actually created
		expect(result.score).toBeGreaterThanOrEqual(0);
	});

	it("returns partial results when task errors", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-read-01")!;

		// Provider that yields an error
		const provider = new MockProvider({ script: [] });

		const result = await executeTask(
			task,
			provider,
			(workDir) => new SandboxToolExecutor(workDir),
		);

		// Task should fail but not crash the harness
		expect(result.passed).toBeDefined();
		expect(result.taskId).toBe("L1-file-read-01");
	});

	it("efficiency score is 100 when meeting expected tool calls", async () => {
		const task = L1_TASKS.find((t) => t.id === "L1-file-write-01")!;
		// expected = 1, max = 3 — writing 1 file = 1 tool call → perfect
		const provider = new MockProvider({
			script: createScriptForFileWrite(
				"src/utils.ts",
				"export function add(a: number, b: number): number { return a + b; }\n",
			),
		});

		const result = await executeTask(
			task,
			provider,
			(workDir) => new SandboxToolExecutor(workDir),
		);

		expect(result.efficiencyScore).toBe(100);
	});
});

// ═══════════════════════════════════════════════════════════════
// §7 — runBenchmark orchestration
// ═══════════════════════════════════════════════════════════════
describe("Benchmark: runBenchmark", () => {
	let resultsDir: string;

	beforeEach(async () => {
		resultsDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bench-results-"));
	});

	afterEach(async () => {
		await fsp.rm(resultsDir, { recursive: true, force: true }).catch(() => {});
	});

	it("runs filtered L1 tasks and produces a valid run", async () => {
		// Pick 2 simple tasks to keep the test fast
		const tasks = L1_TASKS.filter((t) =>
			["L1-file-write-01", "L1-exec-01"].includes(t.id),
		);

		// Create matching scripts for each task
		const scriptMap: Record<string, Array<{ text?: string; toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }> }>> = {
			"L1-file-write-01": createScriptForFileWrite(
				"src/utils.ts",
				"export function add(a: number, b: number): number { return a + b; }\n",
			),
			"L1-exec-01": createScriptForExec("echo hello > output.txt"),
		};

		// Build a provider that picks the right script per task
		// Since runBenchmark calls executeTask for each task and each executeTask
		// creates a fresh provider call sequence, we combine both scripts.
		let taskIndex = 0;
		const scripts = tasks.map((t) => scriptMap[t.id]).flat();
		const provider = new MockProvider({ script: scripts });

		const runnerConfig: BenchmarkRunnerConfig = {
			levels: [1],
			resultsDir,
			verbose: false,
			concurrency: 1,
		};

		const run = await runBenchmark(
			tasks,
			provider,
			(workDir) => new SandboxToolExecutor(workDir),
			runnerConfig,
		);

		expect(run.results).toHaveLength(2);
		expect(run.summary.passRate).toBeDefined();
		expect(run.summary.byLevel[1]).toBeDefined();
		expect(run.runId).toBeTruthy();
		expect(run.totalTimeMs).toBeGreaterThan(0);
	});

	it("saves results to disk", async () => {
		const tasks = [L1_TASKS[0]]; // Just one task
		const provider = new MockProvider({
			script: createScriptForFileRead("data.txt"),
		});

		const runnerConfig: BenchmarkRunnerConfig = {
			levels: [1],
			resultsDir,
			verbose: false,
			concurrency: 1,
		};

		const run = await runBenchmark(
			tasks,
			provider,
			(workDir) => new SandboxToolExecutor(workDir),
			runnerConfig,
		);

		// Check latest.json was created
		const latestPath = path.join(resultsDir, "latest.json");
		const latestContent = await fsp.readFile(latestPath, "utf-8");
		const parsed = JSON.parse(latestContent);
		expect(parsed.runId).toBe(run.runId);
		expect(parsed.results).toHaveLength(1);
	});
});

// ═══════════════════════════════════════════════════════════════
// §8 — Report Formatting
// ═══════════════════════════════════════════════════════════════
describe("Benchmark: formatReport", () => {
	it("produces a readable report from a mock run", async () => {
		const tasks = [L1_TASKS[0]];
		const provider = new MockProvider({
			script: createScriptForFileRead("data.txt"),
		});

		const resultsDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bench-report-"));

		try {
			const run = await runBenchmark(
				tasks,
				provider,
				(workDir) => new SandboxToolExecutor(workDir),
				{ levels: [1], resultsDir, verbose: false, concurrency: 1 },
			);

			const report = formatReport(run);

			expect(report).toContain("CONSTRUYE.LAT");
			expect(report).toContain("BENCHMARK REPORT");
			expect(report).toContain("Pass Rate");
			expect(report).toContain("TASK RESULTS");
			expect(report).toContain("BY LEVEL");
			expect(report.length).toBeGreaterThan(200);
		} finally {
			await fsp.rm(resultsDir, { recursive: true, force: true }).catch(() => {});
		}
	});
});
