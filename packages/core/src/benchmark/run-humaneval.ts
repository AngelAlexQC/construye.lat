#!/usr/bin/env tsx
/**
 * construye.lat — HumanEval Benchmark Runner (REAL Industry Benchmark)
 *
 * Runs OpenAI's HumanEval (164 Python problems) against Workers AI models.
 * This is the SAME benchmark used by Claude, GPT, Gemini, etc.
 *
 * OPTIMIZED: Parallel execution with configurable concurrency.
 * Sequential (~2.2h) → Parallel 20x (~5min)
 *
 * How it works:
 *   1. Load HumanEval JSONL (164 problems)
 *   2. Fire N problems concurrently to Workers AI
 *   3. Extract Python code from each response
 *   4. Execute Python tests in parallel with 10s timeout per test
 *   5. Score pass/fail and produce industry comparison
 *
 * Usage:
 *   npx tsx packages/core/src/benchmark/run-humaneval.ts
 *   npx tsx packages/core/src/benchmark/run-humaneval.ts --model qwq-32b
 *   npx tsx packages/core/src/benchmark/run-humaneval.ts --concurrency 20  # parallel workers
 *   npx tsx packages/core/src/benchmark/run-humaneval.ts --limit 10        # first 10 problems
 *   npx tsx packages/core/src/benchmark/run-humaneval.ts --problems 0,5,10 # specific problems
 *   npx tsx packages/core/src/benchmark/run-humaneval.ts --k 5             # Pass@5 (5 attempts)
 */
import * as os from "node:os";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { WorkersAIProvider } from "../../../providers/src/workers-ai.ts";
import type { ModelConfig, Message } from "@construye/shared";

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
const MAGENTA = "\x1b[35m";

function pass(msg: string) { return `${GREEN}✓${RESET} ${msg}`; }
function fail(msg: string) { return `${RED}✗${RESET} ${msg}`; }
function info(msg: string) { return `${CYAN}ℹ${RESET} ${msg}`; }
function warn(msg: string) { return `${YELLOW}⚠${RESET} ${msg}`; }
function section(title: string) { return `\n${BOLD}${CYAN}━━━ ${title} ━━━${RESET}`; }

// ═══════════════════════════════════════════════════════════════
// HumanEval Types
// ═══════════════════════════════════════════════════════════════

interface HumanEvalProblem {
	task_id: string;       // "HumanEval/0"
	prompt: string;        // Function signature + docstring
	entry_point: string;   // "has_close_elements"
	canonical_solution: string;
	test: string;          // Test harness with check() function
}

interface HumanEvalResult {
	task_id: string;
	passed: boolean;
	attempts: number;
	error?: string;
	generated_code: string;
	time_ms: number;
	tokens_used: number;
}

// ═══════════════════════════════════════════════════════════════
// Wrangler Auth
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
// Load HumanEval Dataset
// ═══════════════════════════════════════════════════════════════

const HUMANEVAL_URL = "https://raw.githubusercontent.com/openai/human-eval/master/data/HumanEval.jsonl.gz";
const HUMANEVAL_CACHE = path.join(os.tmpdir(), "HumanEval.jsonl");

async function loadHumanEval(): Promise<HumanEvalProblem[]> {
	// Check if cached
	if (fs.existsSync(HUMANEVAL_CACHE)) {
		console.log(info("Using cached HumanEval dataset"));
	} else {
		console.log(info("Downloading HumanEval dataset from OpenAI..."));
		const gzPath = HUMANEVAL_CACHE + ".gz";
		execSync(`curl -sL "${HUMANEVAL_URL}" -o "${gzPath}" && gunzip -f "${gzPath}"`);
	}

	const content = await fsp.readFile(HUMANEVAL_CACHE, "utf-8");
	const lines = content.trim().split("\n");
	return lines.map((line) => JSON.parse(line) as HumanEvalProblem);
}

// ═══════════════════════════════════════════════════════════════
// Code Extraction from LLM Response
// ═══════════════════════════════════════════════════════════════

function extractPythonCode(response: string, prompt: string, entryPoint: string): string {
	// Strategy 1: Look for ```python code blocks
	const codeBlockMatch = response.match(/```python\s*\n([\s\S]*?)```/);
	if (codeBlockMatch?.[1]) {
		const code = codeBlockMatch[1].trim();
		// If the code includes the full function, use it
		if (code.includes(`def ${entryPoint}`)) {
			return code;
		}
		// If it's just the body, combine with prompt
		return prompt + code + "\n";
	}

	// Strategy 2: Look for any code block
	const anyBlockMatch = response.match(/```\s*\n([\s\S]*?)```/);
	if (anyBlockMatch?.[1]) {
		const code = anyBlockMatch[1].trim();
		if (code.includes(`def ${entryPoint}`)) {
			return code;
		}
		return prompt + code + "\n";
	}

	// Strategy 3: If the response contains the function definition directly
	if (response.includes(`def ${entryPoint}`)) {
		// Extract from the def line to the end
		const defIndex = response.indexOf(`def ${entryPoint}`);
		let code = response.substring(defIndex);
		// Try to find where the function ends (next function def or class def)
		const nextDef = code.indexOf("\ndef ", 1);
		const nextClass = code.indexOf("\nclass ", 1);
		const endIndex = Math.min(
			nextDef > 0 ? nextDef : Infinity,
			nextClass > 0 ? nextClass : Infinity,
		);
		if (endIndex < Infinity) {
			code = code.substring(0, endIndex);
		}
		return code;
	}

	// Strategy 4: Assume the response IS the completion body
	// This is the simplest case: the model just returns the function body
	const trimmed = response.trim();
	if (trimmed.length > 0) {
		return prompt + trimmed + "\n";
	}

	return prompt + "    pass\n";
}

// ═══════════════════════════════════════════════════════════════
// Python Test Execution
// ═══════════════════════════════════════════════════════════════

async function executeTest(
	code: string,
	test: string,
	entryPoint: string,
	timeoutMs: number = 10000,
): Promise<{ passed: boolean; error?: string }> {
	const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "humaneval-"));
	const testFile = path.join(tmpDir, "test.py");

	// Build the test file:
	// 1. The generated code (full function)
	// 2. The test harness
	// 3. Call check(entry_point)
	const fullTest = `${code}

${test}

check(${entryPoint})
`;

	await fsp.writeFile(testFile, fullTest, "utf-8");

	try {
		execSync(`python3 "${testFile}"`, {
			timeout: timeoutMs,
			stdio: ["pipe", "pipe", "pipe"],
			encoding: "utf-8",
		});
		return { passed: true };
	} catch (err: unknown) {
		const error = err as { stderr?: string; message?: string; killed?: boolean };
		if (error.killed) {
			return { passed: false, error: "TIMEOUT" };
		}
		const stderr = error.stderr || error.message || "Unknown error";
		// Truncate long errors
		return { passed: false, error: stderr.substring(0, 500) };
	} finally {
		// Cleanup
		await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
	}
}

// ═══════════════════════════════════════════════════════════════
// Workers AI Call (Direct, no agent loop — pure model evaluation)
// ═══════════════════════════════════════════════════════════════

async function callWorkersAI(
	provider: WorkersAIProvider,
	modelConfig: ModelConfig,
	problem: HumanEvalProblem,
): Promise<{ code: string; tokens: number }> {
	const messages: Message[] = [
		{
			role: "system",
			content: `You are an expert Python programmer. Complete the given Python function.
Return ONLY the completed function code inside a \`\`\`python code block.
Do NOT include any explanation, just the code.
The function signature and docstring are already provided — complete the implementation.`,
		},
		{
			role: "user",
			content: `Complete this Python function:\n\n${problem.prompt}`,
		},
	];

	let fullResponse = "";
	let tokens = 0;

	const fastConfig: ModelConfig = {
		...modelConfig,
		max_tokens: 1024,
	};

	try {
		for await (const chunk of provider.stream(messages, fastConfig)) {
			if (chunk.type === "text" && "content" in chunk) {
				fullResponse += (chunk as { content: string }).content;
			}
			if (chunk.type === "usage" && "output_tokens" in chunk) {
				tokens = (chunk as { output_tokens: number }).output_tokens || 0;
			}
		}
	} catch (err: unknown) {
		const error = err as { message?: string };
		fullResponse = `ERROR: ${error.message || "Unknown error"}`;
	}

	const code = extractPythonCode(fullResponse, problem.prompt, problem.entry_point);
	return { code, tokens };
}

// ═══════════════════════════════════════════════════════════════
// CLI Argument Parsing
// ═══════════════════════════════════════════════════════════════

interface CliConfig {
	model: string;
	limit: number;
	problems: number[] | null;
	k: number;
	verbose: boolean;
	concurrency: number;
}

function parseCliArgs(): CliConfig {
	const args = process.argv.slice(2);
	let model = "kimi-k2.5";
	let limit = 164;
	let problems: number[] | null = null;
	let k = 1;
	let verbose = true;
	let concurrency = 15;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--model" && args[i + 1]) {
			model = args[++i];
		} else if (args[i] === "--limit" && args[i + 1]) {
			limit = Number.parseInt(args[++i], 10);
		} else if (args[i] === "--problems" && args[i + 1]) {
			problems = args[++i].split(",").map(Number);
		} else if (args[i] === "--k" && args[i + 1]) {
			k = Number.parseInt(args[++i], 10);
		} else if (args[i] === "--concurrency" && args[i + 1]) {
			concurrency = Number.parseInt(args[++i], 10);
		} else if (args[i] === "--quiet") {
			verbose = false;
		}
	}

	return { model, limit, problems, k, verbose, concurrency };
}

// ═══════════════════════════════════════════════════════════════
// Model ID Resolution (same as run-real-benchmark.ts)
// ═══════════════════════════════════════════════════════════════

const MODEL_MAP: Record<string, string> = {
	"kimi-k2.5": "@cf/moonshotai/kimi-k2.5",
	"kimi": "@cf/moonshotai/kimi-k2.5",
	"qwq": "@cf/qwen/qwq-32b",
	"qwq-32b": "@cf/qwen/qwq-32b",
	"qwen3": "@cf/qwen/qwen3-30b-a3b-fp8",
	"qwen3-30b": "@cf/qwen/qwen3-30b-a3b-fp8",
	"llama": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
	"llama-70b": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
};

function resolveModelId(shortName: string): string {
	return MODEL_MAP[shortName] || shortName;
}

// ═══════════════════════════════════════════════════════════════
// Industry Comparison Data
// ═══════════════════════════════════════════════════════════════

const INDUSTRY_SCORES: Array<{ name: string; score: number }> = [
	{ name: "GPT-5.4 Pro", score: 95.0 },
	{ name: "Qwen2.5-Coder-32B", score: 92.7 },
	{ name: "Claude Opus 4.6", score: 91.0 },
	{ name: "Gemini 3.1 Pro", score: 91.0 },
	{ name: "GPT-5.4", score: 90.0 },
	{ name: "Claude Sonnet 4.6", score: 88.0 },
	{ name: "DeepSeek V3.2", score: 87.0 },
	{ name: "Llama 3.3 70B", score: 82.0 },
	{ name: "GLM-4.7", score: 80.0 },
	{ name: "Kimi K2.5", score: 78.0 },
	{ name: "Qwen3-30B", score: 72.0 },
];

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
	const config = parseCliArgs();
	const modelId = resolveModelId(config.model);

	console.log(`
${BOLD}${MAGENTA}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ${CYAN}construye.lat × HumanEval${MAGENTA}                                 ║
║   ${DIM}${RESET}OpenAI's Industry-Standard Coding Benchmark${MAGENTA}              ║
║   ${DIM}${RESET}164 Python Problems · Pass@${config.k} · ${config.concurrency}x Parallel${MAGENTA}              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${RESET}
`);

	// ── Authenticate ──
	const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? readWranglerToken();
	if (!apiToken) {
		console.error(fail("No API token. Run 'npx wrangler login' or set CLOUDFLARE_API_TOKEN."));
		process.exit(1);
	}
	console.log(pass("Wrangler OAuth token found"));

	let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	if (!accountId) {
		accountId = (await detectAccountId(apiToken)) ?? undefined;
	}
	if (!accountId) {
		console.error(fail("No account ID. Set CLOUDFLARE_ACCOUNT_ID."));
		process.exit(1);
	}
	console.log(pass(`Account: ${accountId}`));
	console.log(pass(`Model: ${modelId}`));

	// ── Load dataset ──
	const allProblems = await loadHumanEval();
	console.log(pass(`Loaded ${allProblems.length} HumanEval problems`));

	// ── Filter problems ──
	let problems: HumanEvalProblem[];
	if (config.problems) {
		problems = config.problems
			.map((idx) => allProblems[idx])
			.filter((p): p is HumanEvalProblem => p !== undefined);
		console.log(info(`Running ${problems.length} specific problems: ${config.problems.join(", ")}`));
	} else {
		problems = allProblems.slice(0, config.limit);
		if (config.limit < 164) {
			console.log(info(`Running first ${config.limit} of 164 problems`));
		}
	}

	// ── Create provider ──
	const provider = new WorkersAIProvider(accountId, apiToken);
	const modelConfig: ModelConfig = {
		provider: "workers-ai",
		model: config.model,
		temperature: 0.2,
		max_tokens: 1024,
	};

	// ── Estimate ──
	const estSeqMins = (problems.length * 48) / 60;
	const estParMins = (problems.length * 15) / config.concurrency / 60;
	console.log(info(`Sequential estimate: ${estSeqMins.toFixed(0)} min | Parallel (${config.concurrency}x): ${estParMins.toFixed(1)} min`));

	// ── Run benchmark (PARALLEL) ──
	console.log(section(`RUNNING HumanEval (${problems.length} problems, Pass@${config.k}, ${config.concurrency} concurrent)`));
	console.log("");

	const results: HumanEvalResult[] = new Array(problems.length);
	let passed = 0;
	let failed = 0;
	let errors = 0;
	let completed = 0;
	const startTime = performance.now();

	// Semaphore for concurrency control
	let activeCount = 0;
	const queue: Array<() => void> = [];

	function acquire(): Promise<void> {
		if (activeCount < config.concurrency) {
			activeCount++;
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => {
			queue.push(() => { activeCount++; resolve(); });
		});
	}

	function release(): void {
		activeCount--;
		if (queue.length > 0) {
			const next = queue.shift()!;
			next();
		}
	}

	async function runProblem(i: number): Promise<void> {
		await acquire();
		const problem = problems[i];
		const taskId = problem.task_id;

		let taskPassed = false;
		let bestCode = "";
		let totalTokens = 0;
		let lastError: string | undefined;
		const taskStart = performance.now();

		try {
			// Pass@k: try k times, pass if ANY attempt succeeds
			for (let attempt = 1; attempt <= config.k; attempt++) {
				try {
					const { code, tokens } = await callWorkersAI(provider, modelConfig, problem);
					totalTokens += tokens;

					if (code.startsWith("ERROR:")) {
						lastError = code;
						continue;
					}

					const result = await executeTest(code, problem.test, problem.entry_point);
					if (result.passed) {
						taskPassed = true;
						bestCode = code;
						break;
					} else {
						lastError = result.error;
						bestCode = code;
					}
				} catch (err: unknown) {
					const error = err as { message?: string };
					lastError = error.message || "Unknown error";
				}
			}
		} finally {
			release();
		}

		const taskTime = performance.now() - taskStart;
		completed++;

		if (taskPassed) {
			passed++;
			if (config.verbose) {
				process.stdout.write(`[${String(completed).padStart(3, " ")}/${problems.length}] ${GREEN}✓${RESET} ${taskId} ${DIM}(${(taskTime / 1000).toFixed(1)}s)${RESET}\n`);
			}
		} else {
			failed++;
			if (lastError?.includes("ERROR:") || lastError?.includes("API") || lastError?.includes("fetch")) {
				errors++;
			}
			if (config.verbose) {
				const shortError = lastError
					? lastError.split("\n").pop()?.substring(0, 60) || ""
					: "";
				process.stdout.write(`[${String(completed).padStart(3, " ")}/${problems.length}] ${RED}✗${RESET} ${taskId} ${DIM}${shortError}${RESET}\n`);
			}
		}

		// Progress bar every 10 completions
		if (completed % 10 === 0) {
			const elapsed = (performance.now() - startTime) / 1000;
			const eta = (elapsed / completed) * (problems.length - completed);
			process.stdout.write(`${CYAN}    ▸ ${completed}/${problems.length} done | ${passed} passed | ETA: ${eta.toFixed(0)}s${RESET}\n`);
		}

		results[i] = {
			task_id: taskId,
			passed: taskPassed,
			attempts: config.k,
			error: taskPassed ? undefined : lastError,
			generated_code: bestCode,
			time_ms: taskTime,
			tokens_used: totalTokens,
		};
	}

	// Launch all problems in parallel, controlled by semaphore
	await Promise.all(problems.map((_, i) => runProblem(i)));

	const totalTime = performance.now() - startTime;

	// ═══════════════════════════════════════════════════════════════
	// Results
	// ═══════════════════════════════════════════════════════════════

	const passRate = (passed / problems.length) * 100;
	const avgTime = totalTime / problems.length / 1000;

	console.log(section("HUMANEVAL RESULTS"));
	console.log("");
	console.log(`  ${BOLD}Model:${RESET}        ${modelId}`);
	console.log(`  ${BOLD}Problems:${RESET}     ${problems.length} / 164`);
	console.log(`  ${BOLD}Metric:${RESET}       Pass@${config.k}`);
	console.log(`  ${BOLD}Passed:${RESET}       ${GREEN}${passed}${RESET}`);
	console.log(`  ${BOLD}Failed:${RESET}       ${RED}${failed}${RESET}`);
	if (errors > 0) {
		console.log(`  ${BOLD}API Errors:${RESET}   ${YELLOW}${errors}${RESET}`);
	}
	console.log(`  ${BOLD}Pass Rate:${RESET}    ${BOLD}${passRate >= 70 ? GREEN : passRate >= 40 ? YELLOW : RED}${passRate.toFixed(1)}%${RESET}`);
	console.log(`  ${BOLD}Total Time:${RESET}   ${(totalTime / 1000).toFixed(1)}s`);
	console.log(`  ${BOLD}Avg/Problem:${RESET}  ${avgTime.toFixed(1)}s`);
	console.log("");

	// ── Industry Comparison ──
	console.log(section("INDUSTRY COMPARISON (HumanEval Pass@1)"));
	console.log("");

	// Insert our score into the leaderboard
	const allScores = [
		...INDUSTRY_SCORES,
		{ name: `→ construye.lat (${config.model})`, score: Math.round(passRate * 10) / 10 },
	].sort((a, b) => b.score - a.score);

	const maxName = Math.max(...allScores.map((s) => s.name.length));
	for (const entry of allScores) {
		const isUs = entry.name.startsWith("→");
		const barLen = Math.round(entry.score / 2);
		const bar = "█".repeat(barLen);
		const name = entry.name.padEnd(maxName);
		const pct = entry.score.toFixed(1).padStart(5) + "%";
		if (isUs) {
			console.log(`  ${BOLD}${MAGENTA}${name}  ${bar} ${pct}${RESET}  ◄ US`);
		} else {
			console.log(`  ${DIM}${name}  ${bar} ${pct}${RESET}`);
		}
	}

	console.log("");

	// ── Save results ──
	const resultsDir = path.join(process.cwd(), "benchmark-results");
	await fsp.mkdir(resultsDir, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const resultsFile = path.join(resultsDir, `humaneval-${config.model}-${timestamp}.json`);
	await fsp.writeFile(
		resultsFile,
		JSON.stringify(
			{
				benchmark: "HumanEval",
				source: "https://github.com/openai/human-eval",
				model: modelId,
				model_short: config.model,
				problems_total: 164,
				problems_run: problems.length,
				pass_at_k: config.k,
				passed,
				failed,
				api_errors: errors,
				pass_rate: passRate,
				total_time_ms: totalTime,
				avg_time_per_problem_ms: totalTime / problems.length,
				timestamp: new Date().toISOString(),
				platform: "Cloudflare Workers AI via construye.lat",
				results: results.map((r) => ({
					task_id: r.task_id,
					passed: r.passed,
					error: r.error?.substring(0, 200),
					time_ms: r.time_ms,
				})),
			},
			null,
			2,
		),
		"utf-8",
	);

	console.log(info(`Results saved to ${resultsFile}`));

	// ── Key insight ──
	console.log(section("WHAT THIS MEANS"));
	console.log("");
	console.log(`  HumanEval measures ${BOLD}function-level code generation${RESET}.`);
	console.log(`  Frontier models (GPT-5.4, Opus 4.6) score 90%+ — benchmark is ${YELLOW}saturated${RESET}.`);
	console.log(`  For real-world evaluation, ${BOLD}SWE-bench${RESET} (repo-level) is the gold standard.`);
	console.log("");
	console.log(`  ${BOLD}Key insight${RESET}: "The agent matters more than the model."`);
	console.log(`  SWE-bench Pro shows ${BOLD}22+ point swing${RESET} between scaffolds using the same model.`);
	console.log(`  construye.lat's value = ${BOLD}scaffold quality${RESET}, not underlying model.`);
	console.log("");
}

main().catch((err) => {
	console.error(fail(`Fatal: ${err.message}`));
	process.exit(1);
});
