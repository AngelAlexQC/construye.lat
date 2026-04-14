/**
 * construye.lat Benchmark System — Type Definitions
 *
 * Inspired by SWE-bench, Terminal-Bench, and ProjDevBench but designed
 * specifically for evaluating construye.lat's agent capabilities.
 *
 * Key design decisions:
 * - 3-level task hierarchy (atomic → multi-step → end-to-end)
 * - Verifier functions for deterministic pass/fail (no LLM-as-judge)
 * - Measures both correctness AND efficiency (tokens, time, tool calls)
 * - Tracks regression across runs with persistent results
 */

/** Difficulty level maps to expected tool calls and complexity */
export type TaskLevel = 1 | 2 | 3;

/** Categories of agent capabilities being tested */
export type TaskCategory =
	| "file_read"       // Can the agent read and understand files?
	| "file_write"      // Can the agent create files correctly?
	| "file_edit"       // Can the agent modify existing files?
	| "search"          // Can the agent find information in a codebase?
	| "exec"            // Can the agent run commands?
	| "multi_file"      // Can the agent coordinate across files?
	| "debugging"       // Can the agent find and fix bugs?
	| "generation"      // Can the agent generate new code?
	| "refactoring"     // Can the agent refactor existing code?
	| "testing"         // Can the agent write tests?
	| "project_setup"   // Can the agent set up a project from scratch?
	| "planning"        // Can the agent plan before acting?
	| "integration";    // Can the agent integrate multiple components?

/** A single benchmark task */
export interface BenchmarkTask {
	/** Unique identifier (e.g., "L1-file-read-01") */
	id: string;
	/** Human-readable name */
	name: string;
	/** Difficulty level */
	level: TaskLevel;
	/** What capability this tests */
	category: TaskCategory;
	/** The prompt given to the agent */
	prompt: string;
	/** Set up the test environment (create scaffold files, etc.) */
	setup: (workDir: string) => Promise<void>;
	/** Verify the agent's work — deterministic, no LLM needed */
	verify: (workDir: string) => Promise<VerificationResult>;
	/** Expected number of tool calls (for efficiency scoring) */
	expectedToolCalls: number;
	/** Maximum tool calls before we cap it */
	maxToolCalls: number;
	/** Timeout in ms */
	timeoutMs: number;
	/** Tags for filtering */
	tags: string[];
}

/** Result of verifying a task */
export interface VerificationResult {
	/** Did the agent complete the task correctly? */
	passed: boolean;
	/** Score 0-100 (partial credit) */
	score: number;
	/** Human-readable explanation of what passed/failed */
	details: string;
	/** Individual check results */
	checks: VerificationCheck[];
}

/** A single verification check */
export interface VerificationCheck {
	name: string;
	passed: boolean;
	expected?: string;
	actual?: string;
	weight: number;
}

/** Result of running a single benchmark task */
export interface TaskResult {
	taskId: string;
	taskName: string;
	level: TaskLevel;
	category: TaskCategory;
	/** Did verification pass? */
	passed: boolean;
	/** Score 0-100 */
	score: number;
	/** Verification details */
	verification: VerificationResult;
	/** How many tool calls the agent made */
	toolCallsUsed: number;
	/** Tools the agent used (in order) */
	toolsUsed: string[];
	/** Total tokens consumed (input + output) */
	tokensUsed: number;
	/** Wall-clock time in ms */
	timeMs: number;
	/** Number of agent loop turns */
	turnsUsed: number;
	/** Error if the task crashed */
	error?: string;
	/** Efficiency score: how close to optimal tool call count */
	efficiencyScore: number;
}

/** Result of a full benchmark run */
export interface BenchmarkRun {
	/** Unique run ID (ISO timestamp) */
	runId: string;
	/** When this run started */
	startedAt: string;
	/** When this run finished */
	finishedAt: string;
	/** Total wall-clock time */
	totalTimeMs: number;
	/** Agent configuration used */
	agentConfig: {
		provider: string;
		model: string;
		maxTurns: number;
	};
	/** Results per task */
	results: TaskResult[];
	/** Aggregate scores */
	summary: BenchmarkSummary;
}

/** Aggregate scores for a benchmark run */
export interface BenchmarkSummary {
	/** Overall pass rate (0-100) */
	passRate: number;
	/** Average score across all tasks */
	avgScore: number;
	/** Score by level */
	byLevel: Record<TaskLevel, LevelSummary>;
	/** Score by category */
	byCategory: Record<string, CategorySummary>;
	/** Total tokens used across all tasks */
	totalTokens: number;
	/** Average tokens per task */
	avgTokensPerTask: number;
	/** Average efficiency score */
	avgEfficiency: number;
	/** Total tool calls */
	totalToolCalls: number;
	/** Comparison with previous run (if available) */
	delta?: RunDelta;
}

export interface LevelSummary {
	total: number;
	passed: number;
	passRate: number;
	avgScore: number;
	avgTime: number;
}

export interface CategorySummary {
	total: number;
	passed: number;
	passRate: number;
	avgScore: number;
}

/** Delta between two benchmark runs */
export interface RunDelta {
	previousRunId: string;
	passRateDelta: number;
	avgScoreDelta: number;
	newPasses: string[];
	newFailures: string[];
	regressions: string[];
	improvements: string[];
}

/** Simulated tool call captured during benchmark execution */
export interface CapturedToolCall {
	name: string;
	arguments: Record<string, unknown>;
	result: string;
	isError: boolean;
	durationMs: number;
}

/** Configuration for the benchmark runner */
export interface BenchmarkRunnerConfig {
	/** Which task levels to run */
	levels: TaskLevel[];
	/** Filter by category */
	categories?: TaskCategory[];
	/** Filter by task ID pattern */
	taskFilter?: string;
	/** Path to store results */
	resultsDir: string;
	/** Whether to print progress to console */
	verbose: boolean;
	/** Maximum parallel tasks (default: 1 — sequential is safer) */
	concurrency: number;
}
