/**
 * Benchmark Evaluator — The core engine that runs tasks against the agent
 *
 * This is the equivalent of SWE-bench's harness but for construye.lat.
 * Instead of Docker containers, we use tmpdir sandboxes.
 * Instead of git patches, we verify file system state and command output.
 */
import * as path from "node:path";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import { runAgentLoop } from "../agent-loop.ts";
import { estimateMessagesTokens } from "@construye/shared";
import type { AgentConfig, Provider, ToolExecutor, SkillLoader } from "../types.ts";
import type {
	BenchmarkTask,
	TaskResult,
	BenchmarkRun,
	BenchmarkSummary,
	BenchmarkRunnerConfig,
	LevelSummary,
	CategorySummary,
	TaskLevel,
	RunDelta,
	CapturedToolCall,
} from "./types.ts";

/** Factory that creates a ToolExecutor scoped to a given workDir */
export type ToolExecutorFactory = (workDir: string) => ToolExecutor;

/** Execute a single benchmark task against the agent loop */
export async function executeTask(
	task: BenchmarkTask,
	provider: Provider,
	toolExecutorOrFactory: ToolExecutor | ToolExecutorFactory,
	config?: Partial<AgentConfig>,
): Promise<TaskResult> {
	// Create isolated tmpdir for this task
	const workDir = await fsp.mkdtemp(
		path.join(os.tmpdir(), `construye-bench-${task.id}-`),
	);

	// Resolve executor: if factory, create one scoped to this workDir
	const toolExecutor =
		typeof toolExecutorOrFactory === "function"
			? toolExecutorOrFactory(workDir)
			: toolExecutorOrFactory;

	const toolCallsCapture: CapturedToolCall[] = [];
	let tokensConsumed = 0;

	try {
		// Setup the task environment
		await task.setup(workDir);

		// Create a wrapping tool executor that captures calls
		const capturingExecutor: ToolExecutor = {
			execute: async (call) => {
				const start = performance.now();
				const result = await toolExecutor.execute(call);
				const durationMs = performance.now() - start;
				toolCallsCapture.push({
					name: call.name,
					arguments: call.arguments,
					result: result.content,
					isError: result.is_error ?? false,
					durationMs,
				});
				return result;
			},
			needsApproval: () => false, // No human approval in benchmarks
		};

		// Build agent config
		const agentConfig: AgentConfig = {
			provider,
			toolExecutor: capturingExecutor,
			skillLoader: config?.skillLoader ?? createNoopSkillLoader(),
			modelConfig: config?.modelConfig ?? {
				provider: "workers-ai",
				model: "@cf/moonshot/kimi-k2.5",
				temperature: 0.1,
				max_tokens: 8192,
			},
			onStream: () => {}, // Silent during benchmarks
			maxTurns: Math.ceil(task.maxToolCalls / 2) + 2, // budget turns
			projectIdentity: "",
			tools: config?.tools,
		};

		// Run the agent loop with timeout
		const startTime = performance.now();
		const messages = await Promise.race([
			runAgentLoop(task.prompt, [], agentConfig),
			timeout(task.timeoutMs).then(() => {
				throw new Error(`Task timed out after ${task.timeoutMs}ms`);
			}),
		]);
		const timeMs = performance.now() - startTime;

		// Count tokens
		tokensConsumed = estimateMessagesTokens(messages);

		// Calculate turns used (count assistant messages)
		const turnsUsed = messages.filter((m) => m.role === "assistant").length;

		// Verify the result
		const verification = await task.verify(workDir);

		// Calculate efficiency: how optimally did the agent use tool calls?
		const efficiencyScore = calculateEfficiency(
			toolCallsCapture.length,
			task.expectedToolCalls,
			task.maxToolCalls,
		);

		return {
			taskId: task.id,
			taskName: task.name,
			level: task.level,
			category: task.category,
			passed: verification.passed,
			score: verification.score,
			verification,
			toolCallsUsed: toolCallsCapture.length,
			toolsUsed: toolCallsCapture.map((c) => c.name),
			tokensUsed: tokensConsumed,
			timeMs,
			turnsUsed,
			efficiencyScore,
		};
	} catch (err) {
		// Task crashed — still try to verify partial work
		let verification;
		try {
			verification = await task.verify(workDir);
		} catch {
			verification = {
				passed: false,
				score: 0,
				details: "Verification failed after task error",
				checks: [],
			};
		}

		return {
			taskId: task.id,
			taskName: task.name,
			level: task.level,
			category: task.category,
			passed: false,
			score: verification.score,
			verification,
			toolCallsUsed: toolCallsCapture.length,
			toolsUsed: toolCallsCapture.map((c) => c.name),
			tokensUsed: tokensConsumed,
			timeMs: 0,
			turnsUsed: 0,
			error: (err as Error).message,
			efficiencyScore: 0,
		};
	} finally {
		// Cleanup tmpdir
		await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
	}
}

/** Run the full benchmark suite */
export async function runBenchmark(
	tasks: BenchmarkTask[],
	provider: Provider,
	toolExecutorOrFactory: ToolExecutor | ToolExecutorFactory,
	runnerConfig: BenchmarkRunnerConfig,
	agentConfig?: Partial<AgentConfig>,
): Promise<BenchmarkRun> {
	const startedAt = new Date().toISOString();
	const startTime = performance.now();

	// Filter tasks
	let filteredTasks = tasks.filter((t) =>
		runnerConfig.levels.includes(t.level),
	);
	if (runnerConfig.categories?.length) {
		filteredTasks = filteredTasks.filter((t) =>
			runnerConfig.categories!.includes(t.category),
		);
	}
	if (runnerConfig.taskFilter) {
		const pattern = new RegExp(runnerConfig.taskFilter, "i");
		filteredTasks = filteredTasks.filter(
			(t) => pattern.test(t.id) || pattern.test(t.name),
		);
	}

	if (runnerConfig.verbose) {
		console.log(
			`\n  Running ${filteredTasks.length} benchmark tasks (levels: ${runnerConfig.levels.join(",")})...`,
		);
	}

	// Execute tasks sequentially (safest for filesystem operations)
	const results: TaskResult[] = [];
	for (let i = 0; i < filteredTasks.length; i++) {
		const task = filteredTasks[i];
		if (runnerConfig.verbose) {
			const progress = `[${i + 1}/${filteredTasks.length}]`;
			process.stdout.write(
				`  ${progress} ${task.id}: ${task.name}... `,
			);
		}

		const result = await executeTask(task, provider, toolExecutorOrFactory, agentConfig);
		results.push(result);

		if (runnerConfig.verbose) {
			const icon = result.passed ? "PASS" : "FAIL";
			const score = result.score.toFixed(0);
			console.log(
				`${icon} (${score}/100, ${result.toolCallsUsed} calls, ${result.timeMs.toFixed(0)}ms)`,
			);
		}
	}

	const finishedAt = new Date().toISOString();
	const totalTimeMs = performance.now() - startTime;

	// Load previous run for delta comparison
	const previousRun = await loadPreviousRun(runnerConfig.resultsDir);
	const summary = calculateSummary(results, previousRun);

	const run: BenchmarkRun = {
		runId: startedAt.replace(/[:.]/g, "-"),
		startedAt,
		finishedAt,
		totalTimeMs,
		agentConfig: {
			provider: agentConfig?.modelConfig?.provider ?? "workers-ai",
			model: agentConfig?.modelConfig?.model ?? "@cf/moonshot/kimi-k2.5",
			maxTurns: agentConfig?.maxTurns ?? 30,
		},
		results,
		summary,
	};

	// Save results
	await saveRun(run, runnerConfig.resultsDir);

	return run;
}

/** Calculate efficiency score */
function calculateEfficiency(
	actual: number,
	expected: number,
	max: number,
): number {
	if (actual === 0) return 0;
	if (actual <= expected) return 100; // Perfect or better than expected
	if (actual >= max) return 0; // Used all allowed calls
	// Linear degradation between expected and max
	const excess = actual - expected;
	const budget = max - expected;
	return Math.max(0, Math.round(100 * (1 - excess / budget)));
}

/** Calculate aggregate summary */
function calculateSummary(
	results: TaskResult[],
	previousRun?: BenchmarkRun | null,
): BenchmarkSummary {
	const total = results.length;
	if (total === 0) {
		return {
			passRate: 0,
			avgScore: 0,
			byLevel: {} as Record<TaskLevel, LevelSummary>,
			byCategory: {},
			totalTokens: 0,
			avgTokensPerTask: 0,
			avgEfficiency: 0,
			totalToolCalls: 0,
		};
	}

	const passed = results.filter((r) => r.passed).length;
	const passRate = (passed / total) * 100;
	const avgScore = results.reduce((s, r) => s + r.score, 0) / total;
	const totalTokens = results.reduce((s, r) => s + r.tokensUsed, 0);
	const totalToolCalls = results.reduce((s, r) => s + r.toolCallsUsed, 0);
	const avgEfficiency =
		results.reduce((s, r) => s + r.efficiencyScore, 0) / total;

	// By level
	const byLevel = {} as Record<TaskLevel, LevelSummary>;
	for (const level of [1, 2, 3] as TaskLevel[]) {
		const levelResults = results.filter((r) => r.level === level);
		if (levelResults.length === 0) continue;
		const lvlPassed = levelResults.filter((r) => r.passed).length;
		byLevel[level] = {
			total: levelResults.length,
			passed: lvlPassed,
			passRate: (lvlPassed / levelResults.length) * 100,
			avgScore: levelResults.reduce((s, r) => s + r.score, 0) / levelResults.length,
			avgTime: levelResults.reduce((s, r) => s + r.timeMs, 0) / levelResults.length,
		};
	}

	// By category
	const byCategory: Record<string, CategorySummary> = {};
	const categories = [...new Set(results.map((r) => r.category))];
	for (const cat of categories) {
		const catResults = results.filter((r) => r.category === cat);
		const catPassed = catResults.filter((r) => r.passed).length;
		byCategory[cat] = {
			total: catResults.length,
			passed: catPassed,
			passRate: (catPassed / catResults.length) * 100,
			avgScore: catResults.reduce((s, r) => s + r.score, 0) / catResults.length,
		};
	}

	// Delta with previous run
	let delta: RunDelta | undefined;
	if (previousRun) {
		const prevMap = new Map(previousRun.results.map((r) => [r.taskId, r]));
		const newPasses: string[] = [];
		const newFailures: string[] = [];
		const regressions: string[] = [];
		const improvements: string[] = [];

		for (const r of results) {
			const prev = prevMap.get(r.taskId);
			if (!prev) {
				if (r.passed) newPasses.push(r.taskId);
				else newFailures.push(r.taskId);
			} else {
				if (r.passed && !prev.passed) improvements.push(r.taskId);
				if (!r.passed && prev.passed) regressions.push(r.taskId);
			}
		}

		delta = {
			previousRunId: previousRun.runId,
			passRateDelta: passRate - previousRun.summary.passRate,
			avgScoreDelta: avgScore - previousRun.summary.avgScore,
			newPasses,
			newFailures,
			regressions,
			improvements,
		};
	}

	return {
		passRate,
		avgScore,
		byLevel,
		byCategory,
		totalTokens,
		avgTokensPerTask: totalTokens / total,
		avgEfficiency,
		totalToolCalls,
		delta,
	};
}

/** Save a benchmark run to disk */
async function saveRun(run: BenchmarkRun, resultsDir: string): Promise<void> {
	await fsp.mkdir(resultsDir, { recursive: true });
	const filePath = path.join(resultsDir, `${run.runId}.json`);
	await fsp.writeFile(filePath, JSON.stringify(run, null, 2), "utf-8");

	// Also save as "latest.json" for easy access
	const latestPath = path.join(resultsDir, "latest.json");
	await fsp.writeFile(latestPath, JSON.stringify(run, null, 2), "utf-8");
}

/** Load the most recent previous run for delta comparison */
async function loadPreviousRun(
	resultsDir: string,
): Promise<BenchmarkRun | null> {
	try {
		const latestPath = path.join(resultsDir, "latest.json");
		const content = await fsp.readFile(latestPath, "utf-8");
		return JSON.parse(content) as BenchmarkRun;
	} catch {
		return null;
	}
}

/** Create a skill loader that does nothing (benchmarks don't use skills) */
function createNoopSkillLoader(): SkillLoader {
	return {
		getStubs: () => [],
		activate: async () => "",
		loadReference: async () => "",
	};
}

/** Timeout helper */
function timeout(ms: number): Promise<never> {
	return new Promise((_, reject) =>
		setTimeout(() => reject(new Error("timeout")), ms),
	);
}

/** Format a benchmark run as a human-readable report */
export function formatReport(run: BenchmarkRun): string {
	const lines: string[] = [];
	const s = run.summary;

	lines.push("");
	lines.push("  ╔════════════════════════════════════════════════════════════╗");
	lines.push("  ║       CONSTRUYE.LAT — BENCHMARK REPORT                   ║");
	lines.push("  ╠════════════════════════════════════════════════════════════╣");
	lines.push(`  ║  Run:        ${run.runId.padEnd(44)}║`);
	lines.push(`  ║  Model:      ${run.agentConfig.model.padEnd(44)}║`);
	lines.push(`  ║  Duration:   ${(run.totalTimeMs / 1000).toFixed(1).padEnd(44)}║`);
	lines.push("  ╠════════════════════════════════════════════════════════════╣");

	// Overall scores
	const passBar = "█".repeat(Math.round(s.passRate / 10)) + "░".repeat(10 - Math.round(s.passRate / 10));
	lines.push(`  ║  Pass Rate:  ${passBar} ${s.passRate.toFixed(1)}%${" ".repeat(30 - s.passRate.toFixed(1).length)}║`);
	lines.push(`  ║  Avg Score:  ${s.avgScore.toFixed(1)}/100${" ".repeat(38)}║`);
	lines.push(`  ║  Efficiency: ${s.avgEfficiency.toFixed(1)}%${" ".repeat(40 - s.avgEfficiency.toFixed(1).length)}║`);
	lines.push(`  ║  Tokens:     ${s.totalTokens} total (${s.avgTokensPerTask.toFixed(0)}/task)${" ".repeat(Math.max(0, 28 - String(s.totalTokens).length - s.avgTokensPerTask.toFixed(0).length))}║`);
	lines.push("  ╠════════════════════════════════════════════════════════════╣");

	// By level
	lines.push("  ║  BY LEVEL                                                 ║");
	lines.push("  ║  ─────────────────────────────────────────────────────     ║");
	for (const [level, data] of Object.entries(s.byLevel)) {
		const levelName = level === "1" ? "L1 Atomic" : level === "2" ? "L2 Multi-step" : "L3 End-to-End";
		const bar = "█".repeat(Math.round(data.passRate / 10)) + "░".repeat(10 - Math.round(data.passRate / 10));
		lines.push(`  ║  ${levelName.padEnd(14)} ${bar} ${data.passed}/${data.total} (${data.passRate.toFixed(0)}%)${" ".repeat(Math.max(0, 20 - String(data.passed).length - String(data.total).length))}║`);
	}
	lines.push("  ╠════════════════════════════════════════════════════════════╣");

	// By category
	lines.push("  ║  BY CATEGORY                                              ║");
	lines.push("  ║  ─────────────────────────────────────────────────────     ║");
	for (const [cat, data] of Object.entries(s.byCategory)) {
		const bar = "█".repeat(Math.round(data.passRate / 10)) + "░".repeat(10 - Math.round(data.passRate / 10));
		lines.push(`  ║  ${cat.padEnd(14)} ${bar} ${data.passed}/${data.total}${" ".repeat(Math.max(0, 26 - String(data.passed).length - String(data.total).length))}║`);
	}
	lines.push("  ╠════════════════════════════════════════════════════════════╣");

	// Individual results
	lines.push("  ║  TASK RESULTS                                             ║");
	lines.push("  ║  ─────────────────────────────────────────────────────     ║");
	for (const r of run.results) {
		const icon = r.passed ? "PASS" : "FAIL";
		const score = r.score.toFixed(0).padStart(3);
		const calls = String(r.toolCallsUsed).padStart(2);
		const time = (r.timeMs / 1000).toFixed(1).padStart(5);
		lines.push(`  ║  ${icon} ${score}/100 ${calls} calls ${time}s  ${r.taskId.padEnd(26)}║`);
	}

	// Delta (if available)
	if (s.delta) {
		lines.push("  ╠════════════════════════════════════════════════════════════╣");
		lines.push("  ║  DELTA vs PREVIOUS RUN                                    ║");
		lines.push("  ║  ─────────────────────────────────────────────────────     ║");
		const sign = s.delta.passRateDelta >= 0 ? "+" : "";
		lines.push(`  ║  Pass Rate: ${sign}${s.delta.passRateDelta.toFixed(1)}%${" ".repeat(40)}║`);
		if (s.delta.improvements.length) {
			lines.push(`  ║  Improvements: ${s.delta.improvements.join(", ").slice(0, 40).padEnd(40)}║`);
		}
		if (s.delta.regressions.length) {
			lines.push(`  ║  Regressions: ${s.delta.regressions.join(", ").slice(0, 41).padEnd(41)}║`);
		}
	}

	lines.push("  ╚════════════════════════════════════════════════════════════╝");
	lines.push("");

	return lines.join("\n");
}
