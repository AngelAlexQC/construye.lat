import { describe, it, expect, vi } from "vitest";
import { DynamicWorker } from "./dynamic-worker.ts";
import { Container } from "./container.ts";
import { createCodeModeApi } from "./code-mode-runtime.ts";
import { SandboxOrchestrator } from "./manager.ts";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// --- DynamicWorker Tests (local mode) ---

describe("DynamicWorker (local fallback)", () => {
	it("runs a simple command locally", async () => {
		const worker = new DynamicWorker("test-ns");
		const result = await worker.run("echo hello-construye");
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain("hello-construye");
		expect(result.duration).toBeGreaterThanOrEqual(0);
	});

	it("returns non-zero exit code on failure", async () => {
		const worker = new DynamicWorker("test-ns");
		const result = await worker.run("exit 42");
		expect(result.exitCode).not.toBe(0);
	});

	it("runCode executes code with api object", async () => {
		const worker = new DynamicWorker("test-ns");
		const mockApi = {
			readFile: vi.fn(async () => "file content"),
			writeFile: vi.fn(async () => {}),
			editFile: vi.fn(async () => {}),
			searchText: vi.fn(async () => ""),
			listDir: vi.fn(async () => []),
			glob: vi.fn(async () => []),
		};
		const result = await worker.runCode("return await api.readFile('test.txt')", mockApi);
		expect(result).toBe("file content");
		expect(mockApi.readFile).toHaveBeenCalledWith("test.txt");
	});

	it("runCode catches errors gracefully", async () => {
		const worker = new DynamicWorker("test-ns");
		const mockApi = {
			readFile: vi.fn(async () => { throw new Error("not found"); }),
			writeFile: vi.fn(async () => {}),
			editFile: vi.fn(async () => {}),
			searchText: vi.fn(async () => ""),
			listDir: vi.fn(async () => []),
			glob: vi.fn(async () => []),
		};
		const result = await worker.runCode("return await api.readFile('missing')", mockApi);
		expect(result).toContain("Error");
	});
});

// --- Container Tests (local mode) ---

describe("Container (local fallback)", () => {
	it("runs a simple command locally", async () => {
		const container = new Container();
		const result = await container.run("echo container-test");
		expect(result.exitCode).toBe(0);
		expect(result.output).toContain("container-test");
	});

	it("destroy does not throw when no container", async () => {
		const container = new Container();
		await expect(container.destroy()).resolves.not.toThrow();
	});
});

// --- CodeModeApi Tests ---

describe("createCodeModeApi", () => {
	const testDir = join(tmpdir(), `construye-test-${Date.now()}`);

	// Setup and teardown
	async function setup() {
		await mkdir(testDir, { recursive: true });
	}

	async function teardown() {
		await rm(testDir, { recursive: true, force: true });
	}

	it("writeFile creates file and readFile returns content", async () => {
		await setup();
		try {
			const api = createCodeModeApi(testDir);
			await api.writeFile("test.txt", "hello world");
			const content = await api.readFile("test.txt");
			expect(content).toBe("hello world");
		} finally {
			await teardown();
		}
	});

	it("writeFile creates nested directories", async () => {
		await setup();
		try {
			const api = createCodeModeApi(testDir);
			await api.writeFile("deep/nested/dir/file.txt", "nested content");
			const content = await api.readFile("deep/nested/dir/file.txt");
			expect(content).toBe("nested content");
		} finally {
			await teardown();
		}
	});

	it("editFile replaces text in file", async () => {
		await setup();
		try {
			const api = createCodeModeApi(testDir);
			await api.writeFile("edit.txt", "hello world foo bar");
			await api.editFile("edit.txt", "foo", "baz");
			const content = await api.readFile("edit.txt");
			expect(content).toBe("hello world baz bar");
		} finally {
			await teardown();
		}
	});

	it("editFile throws when string not found", async () => {
		await setup();
		try {
			const api = createCodeModeApi(testDir);
			await api.writeFile("edit2.txt", "some content");
			await expect(api.editFile("edit2.txt", "nonexistent", "replacement")).rejects.toThrow(
				"String not found",
			);
		} finally {
			await teardown();
		}
	});

	it("listDir returns entries with trailing / for dirs", async () => {
		await setup();
		try {
			const api = createCodeModeApi(testDir);
			await api.writeFile("a.txt", "a");
			await mkdir(join(testDir, "subdir"), { recursive: true });
			await writeFile(join(testDir, "subdir", "b.txt"), "b", "utf-8");

			const entries = await api.listDir(".");
			expect(entries).toContain("a.txt");
			expect(entries).toContain("subdir/");
		} finally {
			await teardown();
		}
	});

	it("searchText finds matching lines", async () => {
		await setup();
		try {
			const api = createCodeModeApi(testDir);
			await api.writeFile("search.ts", "const foo = 1;\nconst bar = 2;\nconst foo_bar = 3;");
			const results = await api.searchText("foo");
			expect(results).toContain("search.ts:1:");
			expect(results).toContain("search.ts:3:");
		} finally {
			await teardown();
		}
	});

	it("glob matches files by pattern", async () => {
		await setup();
		try {
			const api = createCodeModeApi(testDir);
			await api.writeFile("src/index.ts", "export {}");
			await api.writeFile("src/utils.ts", "export {}");
			await api.writeFile("src/styles.css", "body {}");

			const tsFiles = await api.glob("src/*.ts");
			expect(tsFiles).toContain("src/index.ts");
			expect(tsFiles).toContain("src/utils.ts");
			expect(tsFiles).not.toContain("src/styles.css");
		} finally {
			await teardown();
		}
	});

	it("prevents path traversal", async () => {
		await setup();
		try {
			const api = createCodeModeApi(testDir);
			await expect(api.readFile("../../etc/passwd")).rejects.toThrow("Path traversal");
		} finally {
			await teardown();
		}
	});
});

// --- SandboxOrchestrator Tests ---

describe("SandboxOrchestrator", () => {
	it("routes dynamic_worker layer to DynamicWorker", async () => {
		const dynamicWorkerRun = vi.fn(async () => ({ output: "dw", exitCode: 0, duration: 1 }));
		const containerRun = vi.fn(async () => ({ output: "ct", exitCode: 0, duration: 1 }));

		const orchestrator = new SandboxOrchestrator(
			{ run: dynamicWorkerRun, runCode: vi.fn() },
			{ run: containerRun, destroy: vi.fn() },
		);

		const result = await orchestrator.execute("ls", "dynamic_worker");
		expect(result.output).toBe("dw");
		expect(dynamicWorkerRun).toHaveBeenCalledWith("ls", undefined);
	});

	it("routes sandbox layer to Container", async () => {
		const dynamicWorkerRun = vi.fn(async () => ({ output: "dw", exitCode: 0, duration: 1 }));
		const containerRun = vi.fn(async () => ({ output: "ct", exitCode: 0, duration: 1 }));

		const orchestrator = new SandboxOrchestrator(
			{ run: dynamicWorkerRun, runCode: vi.fn() },
			{ run: containerRun, destroy: vi.fn() },
		);

		const result = await orchestrator.execute("npm test", "sandbox");
		expect(result.output).toBe("ct");
		expect(containerRun).toHaveBeenCalled();
	});

	it("cleanup calls container.destroy", async () => {
		const destroy = vi.fn(async () => {});
		const orchestrator = new SandboxOrchestrator(
			{ run: vi.fn(), runCode: vi.fn() },
			{ run: vi.fn(), destroy },
		);

		await orchestrator.cleanup();
		expect(destroy).toHaveBeenCalled();
	});
});
