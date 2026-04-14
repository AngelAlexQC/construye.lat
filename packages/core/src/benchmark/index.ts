/**
 * construye.lat Benchmark System
 *
 * Usage:
 *   pnpm --filter @construye/core test -- --grep benchmark
 *
 * Or from code:
 *   import { runBenchmark, ALL_TASKS, formatReport } from './benchmark/index.ts';
 */

// Types
export type {
	BenchmarkTask,
	TaskLevel,
	TaskCategory,
	TaskResult,
	BenchmarkRun,
	BenchmarkSummary,
	BenchmarkRunnerConfig,
	VerificationResult,
	VerificationCheck,
	RunDelta,
	CapturedToolCall,
	LevelSummary,
	CategorySummary,
} from "./types.ts";

// Evaluator engine
export { executeTask, runBenchmark, formatReport } from "./evaluator.ts";
export type { ToolExecutorFactory } from "./evaluator.ts";

// Mock provider & tools
export {
	MockProvider,
	SandboxToolExecutor,
	createScriptForFileRead,
	createScriptForFileWrite,
	createScriptForEdit,
	createScriptForExec,
	createScriptForMultiStep,
} from "./mock-provider.ts";
export type { ScriptedAction, MockProviderConfig } from "./mock-provider.ts";

// Tasks
export { L1_TASKS } from "./tasks-l1.ts";
export { L2_TASKS } from "./tasks-l2.ts";
export { L3_TASKS } from "./tasks-l3.ts";

// Convenience: all tasks combined
import { L1_TASKS } from "./tasks-l1.ts";
import { L2_TASKS } from "./tasks-l2.ts";
import { L3_TASKS } from "./tasks-l3.ts";

export const ALL_TASKS = [...L1_TASKS, ...L2_TASKS, ...L3_TASKS];
