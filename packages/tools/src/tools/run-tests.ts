import type { ToolHandler } from "../types.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

interface TestRunner {
	name: string;
	command: string;
	args: string[];
	/** Files/dirs that indicate this runner is in use */
	detectors: string[];
	/** Function to add a test filter pattern */
	withPattern?: (args: string[], pattern: string) => string[];
}

const RUNNERS: TestRunner[] = [
	{
		name: "vitest",
		command: "npx",
		args: ["vitest", "run", "--reporter=verbose"],
		detectors: ["vitest.config.ts", "vitest.config.js", "vitest.config.mts"],
		withPattern: (args, p) => [...args, p],
	},
	{
		name: "jest",
		command: "npx",
		args: ["jest", "--passWithNoTests", "--verbose"],
		detectors: ["jest.config.ts", "jest.config.js", "jest.config.json", "jest.config.cjs"],
		withPattern: (args, p) => [...args, "--testPathPattern", p],
	},
	{
		name: "pytest",
		command: "python",
		args: ["-m", "pytest", "-v", "--tb=short"],
		detectors: ["pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"],
		withPattern: (args, p) => [...args, p],
	},
	{
		name: "cargo test",
		command: "cargo",
		args: ["test"],
		detectors: ["Cargo.toml"],
		withPattern: (args, p) => [...args, p],
	},
	{
		name: "go test",
		command: "go",
		args: ["test", "./..."],
		detectors: ["go.mod"],
		withPattern: (args, p) => [...args.slice(0, -1), p],
	},
	{
		name: "bun test",
		command: "bun",
		args: ["test"],
		detectors: ["bun.lockb", "bun.lock"],
		withPattern: (args, p) => [...args, "--test-name-pattern", p],
	},
	{
		name: "deno test",
		command: "deno",
		args: ["test"],
		detectors: ["deno.json", "deno.jsonc"],
	},
];

function detectRunner(workingDir: string): TestRunner | null {
	// Check package.json scripts first — most accurate signal
	const pkgPath = join(workingDir, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
				scripts?: Record<string, string>;
				devDependencies?: Record<string, string>;
				dependencies?: Record<string, string>;
			};
			const test = pkg.scripts?.test ?? "";
			const allDeps = { ...pkg.devDependencies, ...pkg.dependencies };

			if (test.includes("vitest") || "vitest" in allDeps) return RUNNERS[0];
			if (test.includes("jest") || "jest" in allDeps) return RUNNERS[1];
			if (test.includes("bun test")) return RUNNERS[5];
		} catch {
			/* ignore parse errors */
		}
	}

	// Fall back to detector files
	for (const runner of RUNNERS) {
		if (runner.detectors.some((d) => existsSync(join(workingDir, d)))) {
			return runner;
		}
	}

	return null;
}

export const runTests: ToolHandler = {
	name: "run_tests",
	description:
		"Run the project's test suite. Auto-detects vitest, jest, pytest, cargo test, go test, bun test, or deno test. Returns pass/fail summary with output.",
	parameters: {
		type: "object",
		properties: {
			pattern: {
				type: "string",
				description: "Optional test file glob or test name filter (e.g. 'auth', 'src/utils.test.ts')",
			},
		},
		required: [],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const runner = detectRunner(context.workingDir);
		if (!runner) {
			return (
				"No se detectó ningún test runner.\n" +
				"Soportados: vitest, jest, pytest, cargo test, go test, bun test, deno test.\n" +
				"Asegúrate de que el runner esté en package.json o en los archivos de configuración."
			);
		}

		let cmdArgs = [...runner.args];
		const pattern = args.pattern as string | undefined;
		if (pattern && runner.withPattern) {
			cmdArgs = runner.withPattern(cmdArgs, pattern);
		}

		try {
			const { stdout, stderr } = await execFileAsync(runner.command, cmdArgs, {
				cwd: context.workingDir,
				timeout: 120_000, // 2 min max
				maxBuffer: 2 * 1024 * 1024,
			});
			const output = (stdout + stderr).trim();
			return `[${runner.name}] ✓ Tests pasaron\n${output}`;
		} catch (err: unknown) {
			const e = err as { stdout?: string; stderr?: string; message: string; code?: number };
			const output = ((e.stdout ?? "") + (e.stderr ?? "")).trim();

			if (output) {
				return `[${runner.name}] ✗ Tests fallaron\n${output}`;
			}
			return `[${runner.name}] Error ejecutando tests: ${e.message}`;
		}
	},
};
