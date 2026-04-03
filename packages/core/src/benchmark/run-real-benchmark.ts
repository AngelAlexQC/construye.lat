#!/usr/bin/env tsx
/**
 * construye.lat — REAL Benchmark Runner (Workers AI)
 *
 * Runs the full benchmark harness against LIVE Cloudflare Workers AI models.
 * Uses wrangler OAuth token for authentication.
 *
 * Usage:
 *   npx tsx packages/core/src/benchmark/run-real-benchmark.ts
 *   npx tsx packages/core/src/benchmark/run-real-benchmark.ts --model kimi-k2.5
 *   npx tsx packages/core/src/benchmark/run-real-benchmark.ts --levels 1
 *   npx tsx packages/core/src/benchmark/run-real-benchmark.ts --levels 1,2 --model qwq
 *   CONSTRUYE_DEBUG=1 npx tsx ... (for verbose provider logs)
 */
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	SandboxToolExecutor,
	ALL_TASKS,
	executeTask,
	formatReport,
} from "./index.ts";
import { WorkersAIProvider } from "../../../providers/src/workers-ai.ts";
import type { Provider } from "../types.ts";
import type { ModelConfig, Message, StreamChunk } from "@construye/shared";
import type { BenchmarkTask, TaskResult, TaskLevel } from "./types.ts";

// ═══════════════════════════════════════════════════════════════
// Terminal colors
// ═══════════════════════════════════════════════════════════════
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function pass(msg: string) { return `${GREEN}✓${RESET} ${msg}`; }
function fail(msg: string) { return `${RED}✗${RESET} ${msg}`; }
function info(msg: string) { return `${CYAN}ℹ${RESET} ${msg}`; }
function warn(msg: string) { return `${YELLOW}⚠${RESET} ${msg}`; }
function section(title: string) { return `\n${BOLD}${CYAN}━━━ ${title} ━━━${RESET}`; }

// ═══════════════════════════════════════════════════════════════
// Wrangler Auth — reuse the CLI's approach
// ═══════════════════════════════════════════════════════════════

function readWranglerToken(): string | null {
	const paths = [
		path.join(os.homedir(), ".wrangler", "config", "default.toml"),
		path.join(os.homedir(), ".config", ".wrangler", "config", "default.toml"),
	];
	for (const p of paths) {
		try {
			const content = fs.readFileSync(p, "utf-8");
			const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
			if (match?.[1]) return match[1];
		} catch { /* not found */ }
	}
	return null;
}

async function detectAccountId(token: string): Promise<string | null> {
	try {
		const resp = await fetch("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5", {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = (await resp.json()) as { result?: { id: string; name: string }[] };
		if (data.result?.[0]) return data.result[0].id;
	} catch { /* network error */ }
	return null;
}

// ═══════════════════════════════════════════════════════════════
// Tool schemas for Workers AI (OpenAI function calling format)
// ═══════════════════════════════════════════════════════════════

const BENCHMARK_TOOLS = [
	{
		name: "readFile",
		description: "Read file contents. Use start_line/end_line for large files.",
		input_schema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Relative file path to read" },
				start_line: { type: "number", description: "Start line (1-based, optional)" },
				end_line: { type: "number", description: "End line (1-based, optional)" },
			},
			required: ["path"],
		},
	},
	{
		name: "writeFile",
		description: "Create or overwrite a file with the given content.",
		input_schema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Relative file path to write" },
				content: { type: "string", description: "Full file content to write" },
			},
			required: ["path", "content"],
		},
	},
	{
		name: "editFile",
		description: "Replace an exact string in a file. old_string must match exactly one location.",
		input_schema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Relative file path to edit" },
				old_string: { type: "string", description: "Exact text to find and replace" },
				new_string: { type: "string", description: "Replacement text" },
			},
			required: ["path", "old_string", "new_string"],
		},
	},
	{
		name: "searchText",
		description: "Search for a regex pattern across files. Returns matches with line numbers.",
		input_schema: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "Regex pattern to search for" },
				path: { type: "string", description: "Directory to search in (optional, defaults to project root)" },
			},
			required: ["pattern"],
		},
	},
	{
		name: "listDir",
		description: "List contents of a directory.",
		input_schema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Relative directory path (default: '.')" },
			},
			required: ["path"],
		},
	},
	{
		name: "exec",
		description: "Execute a shell command and return its output.",
		input_schema: {
			type: "object",
			properties: {
				command: { type: "string", description: "Shell command to execute" },
			},
			required: ["command"],
		},
	},
	{
		name: "glob",
		description: "Find files matching a glob pattern (e.g. **/*.ts).",
		input_schema: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "Glob pattern to match files" },
			},
			required: ["pattern"],
		},
	},
];

// ═══════════════════════════════════════════════════════════════
// Adapter: wrap ProviderAdapter → core Provider interface
// ═══════════════════════════════════════════════════════════════

function adaptProvider(
	adapter: WorkersAIProvider,
	modelConfig: ModelConfig,
): Provider {
	return {
		chat(messages: Message[], tools?: unknown[]): AsyncIterable<StreamChunk> {
			return adapter.stream(messages, modelConfig, tools);
		},
	};
}

// ═══════════════════════════════════════════════════════════════
// CLI argument parsing
// ═══════════════════════════════════════════════════════════════

interface BenchmarkCliConfig {
	model: string;
	levels: TaskLevel[];
	taskFilter?: string;
	verbose: boolean;
}

function parseCliArgs(): BenchmarkCliConfig {
	const args = process.argv.slice(2);
	let model = "kimi-k2.5";
	let levels: TaskLevel[] = [1, 2, 3];
	let taskFilter: string | undefined;
	let verbose = true;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--model" && args[i + 1]) {
			model = args[++i];
		} else if (args[i] === "--levels" && args[i + 1]) {
			levels = args[++i].split(",").map(Number) as TaskLevel[];
		} else if (args[i] === "--task" && args[i + 1]) {
			taskFilter = args[++i];
		} else if (args[i] === "--quiet") {
			verbose = false;
		}
	}

	return { model, levels, taskFilter, verbose };
}

// ═══════════════════════════════════════════════════════════════
// Main — Run real benchmark
// ═══════════════════════════════════════════════════════════════

async function main() {
	const cliConfig = parseCliArgs();

	console.log(section("CONSTRUYE.LAT — REAL BENCHMARK (Workers AI)"));
	console.log("");

	// ── Authenticate via wrangler ──
	const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? readWranglerToken();
	if (!apiToken) {
		console.error(fail("No API token found. Run 'npx wrangler login' or set CLOUDFLARE_API_TOKEN."));
		process.exit(1);
	}
	console.log(pass("Wrangler OAuth token found"));

	let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	if (!accountId) {
		console.log(info("Detecting account ID..."));
		accountId = (await detectAccountId(apiToken)) ?? undefined;
	}
	if (!accountId) {
		console.error(fail("Could not detect account ID. Set CLOUDFLARE_ACCOUNT_ID."));
		process.exit(1);
	}
	console.log(pass(`Account: ${accountId}`));

	// ── Create real provider ──
	const workersAI = new WorkersAIProvider(accountId, apiToken);
	const modelConfig: ModelConfig = {
		provider: "workers-ai",
		model: cliConfig.model,
		temperature: 0.1,
		max_tokens: 4096,
	};
	const provider = adaptProvider(workersAI, modelConfig);

	console.log(pass(`Model: ${cliConfig.model}`));
	console.log(pass(`Levels: ${cliConfig.levels.join(", ")}`));

	// ── Quick connectivity test ──
	console.log(info("Testing Workers AI connectivity..."));
	try {
		const testMessages: Message[] = [
			{ role: "user", content: "Reply with exactly: CONNECTED" },
		];
		let testResponse = "";
		for await (const chunk of workersAI.stream(testMessages, modelConfig)) {
			if (chunk.type === "text") testResponse += chunk.content;
			if (chunk.type === "error") throw new Error(chunk.error);
		}
		if (!testResponse) throw new Error("Empty response from Workers AI");
		console.log(pass(`Connected! Response: "${testResponse.trim().slice(0, 50)}"`));
	} catch (err) {
		console.error(fail(`Workers AI connectivity failed: ${(err as Error).message}`));
		process.exit(1);
	}

	// ── Filter tasks ──
	let tasks = ALL_TASKS.filter((t) => cliConfig.levels.includes(t.level));
	if (cliConfig.taskFilter) {
		const pattern = new RegExp(cliConfig.taskFilter, "i");
		tasks = tasks.filter((t) => pattern.test(t.id) || pattern.test(t.name));
	}

	console.log(section(`RUNNING ${tasks.length} TASKS`));
	console.log("");

	// ── Execute tasks ──
	const results: TaskResult[] = [];
	const startTime = performance.now();

	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i];
		const progress = `[${i + 1}/${tasks.length}]`;
		process.stdout.write(`  ${progress} ${task.id}: ${task.name}... `);

		const taskStart = performance.now();
		const result = await executeTask(
			task,
			provider,
			(workDir: string) => new SandboxToolExecutor(workDir),
			{
				provider,
				toolExecutor: undefined as never, // Overridden by executeTask
				skillLoader: { getStubs: () => [], activate: async () => "", loadReference: async () => "" },
				modelConfig,
				onStream: () => {},
				maxTurns: Math.ceil(task.maxToolCalls / 2) + 3,
				tools: BENCHMARK_TOOLS,
			},
		);
		const taskTime = (performance.now() - taskStart) / 1000;
		results.push(result);

		const icon = result.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
		const score = result.score.toFixed(0);
		const calls = result.toolCallsUsed;
		const tokens = result.tokensUsed;
		console.log(`${icon} (${score}/100, ${calls} calls, ${tokens} tok, ${taskTime.toFixed(1)}s)`);

		if (!result.passed && result.error) {
			console.log(`         ${DIM}Error: ${result.error.slice(0, 100)}${RESET}`);
		}
		if (!result.passed && result.verification?.checks) {
			for (const check of result.verification.checks) {
				if (!check.passed) {
					console.log(`         ${DIM}✗ ${check.description}${RESET}`);
				}
			}
		}
	}

	const totalTime = (performance.now() - startTime) / 1000;

	// ═══════════════════════════════════════════════════════════
	// Summary Report
	// ═══════════════════════════════════════════════════════════

	console.log(section("RESULTS SUMMARY"));
	console.log("");

	const passed = results.filter((r) => r.passed).length;
	const total = results.length;
	const passRate = total > 0 ? (passed / total) * 100 : 0;
	const avgScore = total > 0 ? results.reduce((s, r) => s + r.score, 0) / total : 0;
	const totalTokens = results.reduce((s, r) => s + r.tokensUsed, 0);
	const totalCalls = results.reduce((s, r) => s + r.toolCallsUsed, 0);
	const avgEfficiency = total > 0
		? results.reduce((s, r) => s + r.efficiencyScore, 0) / total
		: 0;

	// By level
	const byLevel = new Map<number, { passed: number; total: number; results: TaskResult[] }>();
	for (const r of results) {
		const entry = byLevel.get(r.level) ?? { passed: 0, total: 0, results: [] };
		entry.total++;
		if (r.passed) entry.passed++;
		entry.results.push(r);
		byLevel.set(r.level, entry);
	}

	// By category
	const byCat = new Map<string, { passed: number; total: number }>();
	for (const r of results) {
		const entry = byCat.get(r.category) ?? { passed: 0, total: 0 };
		entry.total++;
		if (r.passed) entry.passed++;
		byCat.set(r.category, entry);
	}

	// Industry comparison
	const SWE_BENCH_2026 = [
		{ name: "Claude 4 Sonnet", score: 77.2 },
		{ name: "GPT-5", score: 74.9 },
		{ name: "Gemini 2.5 Pro", score: 63.8 },
		{ name: "DeepSeek-V3", score: 53.0 },
		{ name: "Llama 4 Maverick", score: 46.7 },
	];

	const bar = (pct: number) => "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));

	console.log("  ╔════════════════════════════════════════════════════════════════╗");
	console.log("  ║       CONSTRUYE.LAT — REAL BENCHMARK REPORT                  ║");
	console.log("  ╠════════════════════════════════════════════════════════════════╣");
	console.log(`  ║  Model:      ${cliConfig.model.padEnd(48)}║`);
	console.log(`  ║  Provider:   Workers AI (Cloudflare)${" ".repeat(25)}║`);
	console.log(`  ║  Duration:   ${totalTime.toFixed(1)}s${" ".repeat(Math.max(0, 47 - totalTime.toFixed(1).length))}║`);
	console.log("  ╠════════════════════════════════════════════════════════════════╣");
	console.log(`  ║  Pass Rate:  ${bar(passRate)} ${passRate.toFixed(1)}%  (${passed}/${total})${" ".repeat(Math.max(0, 12 - passRate.toFixed(1).length - String(passed).length - String(total).length))}║`);
	console.log(`  ║  Avg Score:  ${avgScore.toFixed(1)}/100${" ".repeat(42)}║`);
	console.log(`  ║  Efficiency: ${avgEfficiency.toFixed(1)}%${" ".repeat(Math.max(0, 47 - avgEfficiency.toFixed(1).length))}║`);
	console.log(`  ║  Tokens:     ${totalTokens} total (${total > 0 ? (totalTokens / total).toFixed(0) : 0}/task)${" ".repeat(Math.max(0, 32 - String(totalTokens).length - (total > 0 ? (totalTokens / total).toFixed(0) : "0").length))}║`);
	console.log(`  ║  Tool Calls: ${totalCalls} total (${total > 0 ? (totalCalls / total).toFixed(1) : 0}/task)${" ".repeat(Math.max(0, 32 - String(totalCalls).length - (total > 0 ? (totalCalls / total).toFixed(1) : "0").length))}║`);
	console.log("  ╠════════════════════════════════════════════════════════════════╣");

	console.log("  ║  BY LEVEL                                                     ║");
	console.log("  ║  ──────────────────────────────────────────────────────────    ║");
	for (const [level, data] of [...byLevel.entries()].sort()) {
		const name = level === 1 ? "L1 Atomic    " : level === 2 ? "L2 Multi-step" : "L3 End-to-End";
		const pct = (data.passed / data.total) * 100;
		console.log(`  ║  ${name} ${bar(pct)} ${data.passed}/${data.total} (${pct.toFixed(0)}%)${" ".repeat(Math.max(0, 12 - String(data.passed).length - String(data.total).length))}║`);
	}
	console.log("  ╠════════════════════════════════════════════════════════════════╣");

	console.log("  ║  BY CATEGORY                                                  ║");
	console.log("  ║  ──────────────────────────────────────────────────────────    ║");
	for (const [cat, data] of [...byCat.entries()].sort()) {
		const pct = (data.passed / data.total) * 100;
		const catName = cat.padEnd(14);
		console.log(`  ║  ${catName} ${bar(pct)} ${data.passed}/${data.total}${" ".repeat(Math.max(0, 18 - String(data.passed).length - String(data.total).length))}║`);
	}
	console.log("  ╠════════════════════════════════════════════════════════════════╣");

	console.log("  ║  INDIVIDUAL RESULTS                                           ║");
	console.log("  ║  ──────────────────────────────────────────────────────────    ║");
	for (const r of results) {
		const icon = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
		const score = r.score.toFixed(0).padStart(3);
		const calls = String(r.toolCallsUsed).padStart(2);
		const time = (r.timeMs / 1000).toFixed(1).padStart(6);
		const tokens = String(r.tokensUsed).padStart(5);
		console.log(`  ║  ${icon} ${score}/100 ${calls}c ${tokens}t ${time}s  ${r.taskId.padEnd(22)}║`);
	}
	console.log("  ╠════════════════════════════════════════════════════════════════╣");

	console.log("  ║  vs INDUSTRY (SWE-bench 2026)                                 ║");
	console.log("  ║  ──────────────────────────────────────────────────────────    ║");
	// Insert our result into the leaderboard
	const leaderboard = [
		...SWE_BENCH_2026.map((e) => ({ ...e, ours: false })),
		{ name: `construye.lat (${cliConfig.model})`, score: passRate, ours: true },
	].sort((a, b) => b.score - a.score);

	for (const entry of leaderboard) {
		const marker = entry.ours ? `${BOLD}${CYAN}→${RESET}` : " ";
		const nameStyle = entry.ours ? `${BOLD}${CYAN}` : "";
		const endStyle = entry.ours ? RESET : "";
		console.log(`  ║ ${marker} ${nameStyle}${entry.name.padEnd(30)}${endStyle} ${bar(entry.score)} ${entry.score.toFixed(1)}%${" ".repeat(Math.max(0, 5 - entry.score.toFixed(1).length))}║`);
	}
	console.log("  ╚════════════════════════════════════════════════════════════════╝");

	// ── Final verdict ──
	console.log("");
	if (passRate >= 80) {
		console.log(`  ${BOLD}${GREEN}🏆 EXCELENTE — ${passRate.toFixed(1)}% de tareas completadas correctamente${RESET}`);
	} else if (passRate >= 60) {
		console.log(`  ${BOLD}${YELLOW}💪 BUENO — ${passRate.toFixed(1)}% de tareas completadas${RESET}`);
	} else if (passRate >= 40) {
		console.log(`  ${BOLD}${YELLOW}🔧 PROMEDIO — ${passRate.toFixed(1)}% necesita mejoras${RESET}`);
	} else {
		console.log(`  ${BOLD}${RED}⚠️  BAJO — ${passRate.toFixed(1)}% requiere trabajo significativo${RESET}`);
	}
	console.log(`  ${DIM}Tiempo total: ${totalTime.toFixed(1)}s | Tokens: ${totalTokens} | Modelo: ${cliConfig.model}${RESET}`);
	console.log("");

	// Exit with appropriate code
	process.exit(passRate >= 50 ? 0 : 1);
}

main().catch((err) => {
	console.error(fail(`Benchmark crashed: ${err.message}`));
	console.error(err.stack);
	process.exit(1);
});
