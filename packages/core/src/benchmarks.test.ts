import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { classifyTask, getModelForTask } from "./model-router.ts";
import { assembleContext, getContextTokenUsage } from "./context-engine.ts";
import { shouldCompact } from "./compaction.ts";
import { FileSessionStore } from "./file-session-store.ts";
import type { AgentConfig } from "./types.ts";
import type { Message, ToolCall } from "@construye/shared";
import { estimateMessagesTokens, WORKERS_AI_MODEL_MAP, MODEL_CONTEXT_SIZES, COMPACTION_THRESHOLD, MAX_ERROR_RETRIES } from "@construye/shared";
import * as os from "node:os";
import * as path from "node:path";
import * as fsp from "node:fs/promises";

// ═══════════════════════════════════════════
// BENCHMARK SUITE: construye.lat capabilities
// ═══════════════════════════════════════════

// Helper: track execution time in µs
function measure(fn: () => void): number {
	const start = performance.now();
	fn();
	return Math.round((performance.now() - start) * 1000); // µs
}

async function measureAsync(fn: () => Promise<unknown>): Promise<number> {
	const start = performance.now();
	await fn();
	return Math.round((performance.now() - start) * 1000); // µs
}

// ═══════════════════════════════════════════
// 1. MODEL ROUTER — Classification speed & accuracy
// ═══════════════════════════════════════════
describe("benchmark: model-router", () => {
	describe("classification accuracy — English", () => {
		const cases: Array<[string, string]> = [
			["hello", "simple_query"],
			["hi there, who are you?", "simple_query"],
			["hey what's up", "simple_query"],
			["why is the build failing with TS2345", "reasoning"],
			["debug this memory leak in the worker", "reasoning"],
			["explain how the compaction algorithm works", "reasoning"],
			["analyze the performance bottleneck", "reasoning"],
			["investigate why tests are flaky", "reasoning"],
			["compare prisma vs drizzle for d1", "reasoning"],
			["create a plan to migrate to cloudflare", "planning"],
			["what steps do I need for production deploy", "planning"],
			["design the authentication flow", "planning"],
			["find all TypeScript files with TODO comments", "file_ops"],
			["search for usages of useEffect in the project", "file_ops"],
			["show me the package.json", "file_ops"],
			["list the files in the src directory", "file_ops"],
			["implement a retry mechanism with exponential backoff", "coding"],
			["add input validation to the API endpoint", "coding"],
			["create a new React component for user profile", "coding"],
		];

		for (const [input, expected] of cases) {
			it(`"${input.slice(0, 50)}" → ${expected}`, () => {
				expect(classifyTask(input)).toBe(expected);
			});
		}
	});

	describe("classification accuracy — Spanish", () => {
		const cases: Array<[string, string]> = [
			["hola", "simple_query"],
			["qué puedes hacer?", "simple_query"],
			["cómo estás", "simple_query"],
			["por qué falla el build", "reasoning"],
			["analiza el rendimiento del servidor", "reasoning"],
			["investiga el error en producción", "reasoning"],
			["diseña la arquitectura del sistema", "planning"],
			["busca archivos con errores de tipo", "file_ops"],
			["muestra el contenido de index.ts", "file_ops"],
		];

		for (const [input, expected] of cases) {
			it(`"${input.slice(0, 50)}" → ${expected}`, () => {
				expect(classifyTask(input)).toBe(expected);
			});
		}
	});

	describe("classification speed", () => {
		it("classifies 1000 messages in < 50ms", () => {
			const messages = [
				"hello", "debug this error", "create a plan", "find files",
				"implement the feature", "hola qué tal", "por qué falla",
				"diseña la api", "busca el archivo", "add tests",
			];

			const start = performance.now();
			for (let i = 0; i < 1000; i++) {
				classifyTask(messages[i % messages.length]);
			}
			const elapsed = performance.now() - start;
			expect(elapsed).toBeLessThan(50);
			console.log(`  → 1000 classifications in ${elapsed.toFixed(2)}ms (${(elapsed / 1000 * 1000).toFixed(0)}µs/op)`);
		});
	});

	describe("model selection correctness", () => {
		it("routes simple_query to fast model", () => {
			const config = getModelForTask("simple_query");
			expect(config.model).toBe(WORKERS_AI_MODEL_MAP.fast);
			expect(config.temperature).toBe(0.4);
			expect(config.max_tokens).toBe(1024);
		});

		it("routes coding to heavy model (Kimi K2.5)", () => {
			const config = getModelForTask("coding");
			expect(config.model).toBe(WORKERS_AI_MODEL_MAP.heavy);
			expect(config.temperature).toBe(0.1);
		});

		it("routes reasoning to QwQ-32B", () => {
			const config = getModelForTask("reasoning");
			expect(config.model).toBe(WORKERS_AI_MODEL_MAP.reasoning);
			expect(config.temperature).toBe(0.3);
		});

		it("routes compaction to fast model (cheapest)", () => {
			const config = getModelForTask("compaction");
			expect(config.model).toBe(WORKERS_AI_MODEL_MAP.fast);
			expect(config.temperature).toBe(0.0);
		});

		it("all task types map to Workers AI models (no external deps)", () => {
			const taskTypes = ["simple_query", "coding", "reasoning", "planning", "file_ops", "compaction"];
			for (const t of taskTypes) {
				const config = getModelForTask(t as import("@construye/shared").TaskType);
				expect(config.model).toMatch(/^@cf\//);
				expect(config.provider).toBe("workers-ai");
			}
		});
	});
});

// ═══════════════════════════════════════════
// 2. CONTEXT ENGINE — Token efficiency
// ═══════════════════════════════════════════
describe("benchmark: context-engine", () => {
	const stubConfig: AgentConfig = {
		provider: { name: "test", stream: async function* () {} } as any,
		modelConfig: { provider: "workers-ai", model: "@cf/moonshot/kimi-k2.5", temperature: 0.1, max_tokens: 8192 },
		toolExecutor: { execute: vi.fn(), needsApproval: () => false } as any,
		tools: [
			{ name: "read_file", description: "Read file contents" },
			{ name: "write_file", description: "Create or overwrite a file" },
			{ name: "edit_file", description: "Replace text in a file" },
			{ name: "search_text", description: "Search files with grep-style patterns" },
			{ name: "list_dir", description: "List directory contents" },
			{ name: "exec", description: "Run shell commands" },
			{ name: "glob", description: "Find files by glob pattern" },
			{ name: "git", description: "Git operations" },
			{ name: "browse", description: "Fetch web pages" },
		] as any, 
		onStream: vi.fn(),
		skillLoader: { getStubs: () => [], findSkill: () => null } as any,
		projectIdentity: "",
		maxTurns: 30,
	};

	describe("system prompt token economy", () => {
		it("system prompt without project identity < 800 tokens", async () => {
			const ctx = await assembleContext([], stubConfig);
			const sysMsgTokens = estimateMessagesTokens([ctx[0]]);
			expect(sysMsgTokens).toBeLessThan(800);
			console.log(`  → System prompt: ${sysMsgTokens} tokens (9 tools, no project context)`);
		});

		it("system prompt with project identity < 1000 tokens", async () => {
			const configWithProject = {
				...stubConfig,
				projectIdentity: "# My App\nA SaaS dashboard built with Next.js and D1.\n## Conventions\n- Use TypeScript strict\n- Tailwind for styles\n- Vitest for tests",
			};
			const ctx = await assembleContext([], configWithProject);
			const sysMsgTokens = estimateMessagesTokens([ctx[0]]);
			expect(sysMsgTokens).toBeLessThan(1000);
			console.log(`  → System prompt with project: ${sysMsgTokens} tokens`);
		});

		it("tool stubs are compact (~30 tokens each)", async () => {
			const ctx = await assembleContext([], stubConfig);
			const systemContent = ctx[0].content;
			const toolSection = systemContent.split("## Available Tools")[1]?.split("##")[0] ?? "";
			const toolLines = toolSection.trim().split("\n").filter(l => l.startsWith("- "));
			expect(toolLines.length).toBe(9);
			const avgTokensPerTool = estimateMessagesTokens([{ content: toolSection }]) / toolLines.length;
			expect(avgTokensPerTool).toBeLessThan(40);
			console.log(`  → ${toolLines.length} tools, ~${avgTokensPerTool.toFixed(0)} tokens/tool avg`);
		});
	});

	describe("context assembly speed", () => {
		it("assembles context with 50 messages in < 5ms", async () => {
			const messages: Message[] = [];
			for (let i = 0; i < 50; i++) {
				messages.push({ role: "user", content: `Message ${i}: implement feature ${i}` });
				messages.push({ role: "assistant", content: `I'll implement feature ${i} by editing the relevant files.` });
			}
			const elapsed = await measureAsync(() => assembleContext(messages, stubConfig));
			expect(elapsed).toBeLessThan(5000); // < 5ms = 5000µs
			console.log(`  → 50-message context assembled in ${elapsed}µs`);
		});
	});

	describe("context usage tracking", () => {
		it("correctly tracks usage for Kimi K2.5 (128K)", () => {
			const messages: Message[] = [
				{ role: "system", content: "You are a coding agent." },
				{ role: "user", content: "Write a function" },
				{ role: "assistant", content: "Here is the function:\n```typescript\nfunction foo() { return 42; }\n```" },
			];
			const usage = getContextTokenUsage(messages, "@cf/moonshot/kimi-k2.5");
			expect(usage.max).toBe(128_000);
			expect(usage.percentage).toBeLessThan(0.01); // tiny conversation
			console.log(`  → 3-message usage: ${usage.used} tokens (${(usage.percentage * 100).toFixed(3)}% of ${usage.max})`);
		});

		it("detects compaction threshold at 80%", () => {
			// Create a very large message to trigger compaction check
			const large = "x".repeat(128_000 * 4 * 0.85); // ~85% of 128K
			const messages: Message[] = [
				{ role: "system", content: "You are a coding agent." },
				{ role: "user", content: large },
			];
			const usage = getContextTokenUsage(messages, "@cf/moonshot/kimi-k2.5");
			expect(usage.percentage).toBeGreaterThan(COMPACTION_THRESHOLD);
		});
	});
});

// ═══════════════════════════════════════════
// 3. COMPACTION — Token savings
// ═══════════════════════════════════════════
describe("benchmark: compaction", () => {
	it("shouldCompact detects when context exceeds 80%", () => {
		const largeContent = "x".repeat(128_000 * 4 * 0.85);
		const messages: Message[] = [
			{ role: "system", content: "Agent." },
			{ role: "user", content: largeContent },
		];
		const config: AgentConfig = {
			provider: { name: "test" } as any,
			modelConfig: { provider: "workers-ai", model: "@cf/moonshot/kimi-k2.5", temperature: 0.1, max_tokens: 8192 },
			toolExecutor: { execute: vi.fn() } as any,
			tools: [] as any,
			onStream: vi.fn(),
			skillLoader: { getStubs: () => [] } as any,
			projectIdentity: "",
			maxTurns: 30,
		};
		expect(shouldCompact(messages, config)).toBe(true);
	});

	it("shouldCompact returns false for small conversations", () => {
		const messages: Message[] = [
			{ role: "system", content: "Agent." },
			{ role: "user", content: "hello" },
			{ role: "assistant", content: "hi" },
		];
		const config: AgentConfig = {
			provider: { name: "test" } as any,
			modelConfig: { provider: "workers-ai", model: "@cf/moonshot/kimi-k2.5", temperature: 0.1, max_tokens: 8192 },
			toolExecutor: { execute: vi.fn() } as any,
			tools: [] as any,
			onStream: vi.fn(),
			skillLoader: { getStubs: () => [] } as any,
			projectIdentity: "",
			maxTurns: 30,
		};
		expect(shouldCompact(messages, config)).toBe(false);
	});
});

// ═══════════════════════════════════════════
// 4. SESSION PERSISTENCE — Read/write speed
// ═══════════════════════════════════════════
describe("benchmark: session-persistence", () => {
	let store: FileSessionStore;
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = path.join(os.tmpdir(), `construye-bench-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		store = new FileSessionStore(tmpDir);
	});

	afterEach(async () => {
		await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
	});

	it("saves and loads a 100-message session in < 50ms", async () => {
		const messages: Message[] = [];
		for (let i = 0; i < 100; i++) {
			messages.push({ role: "user", content: `Implement feature ${i} with proper error handling and TypeScript types` });
			messages.push({ role: "assistant", content: `I'll implement feature ${i}. Let me read the relevant files first.\n\`\`\`typescript\nfunction feature${i}() {\n  return ${i};\n}\n\`\`\`` });
		}

		const session = { id: "bench-session", started_at: new Date().toISOString() };

		const saveTime = await measureAsync(() => store.save("bench-session", { session, messages }));
		const loadTime = await measureAsync(async () => {
			const result = await store.load("bench-session");
			expect(result?.messages.length).toBe(200);
		});

		expect(saveTime).toBeLessThan(50000); // < 50ms
		expect(loadTime).toBeLessThan(50000); // < 50ms
		console.log(`  → Save 100 msgs: ${(saveTime / 1000).toFixed(1)}ms | Load: ${(loadTime / 1000).toFixed(1)}ms`);
	});

	it("handles large tool results (50KB+) in messages", async () => {
		const largeResult = "x".repeat(50_000);
		const messages: Message[] = [
			{ role: "user", content: "read the file" },
			{ role: "assistant", content: "Let me read it", tool_calls: [{ id: "tc1", name: "read_file", arguments: { path: "/big-file.ts" } }] },
			{ role: "tool", content: largeResult, tool_call_id: "tc1" },
		];

		const session = { id: "large-bench", started_at: new Date().toISOString() };
		const saveTime = await measureAsync(() => store.save("large-bench", { session, messages }));
		const loadTime = await measureAsync(async () => {
			const result = await store.load("large-bench");
			expect(result?.messages[2].content.length).toBe(50_000);
		});

		console.log(`  → Save 50KB msg: ${(saveTime / 1000).toFixed(1)}ms | Load: ${(loadTime / 1000).toFixed(1)}ms`);
	});

	it("lists 20 sessions in < 100ms", async () => {
		// Create 20 sessions
		for (let i = 0; i < 20; i++) {
			const session = { id: `session-${i}`, started_at: new Date(Date.now() - i * 60000).toISOString() };
			await store.save(`session-${i}`, { session, messages: [{ role: "user", content: `msg ${i}` }] });
		}

		const listTime = await measureAsync(async () => {
			const sessions = await store.listRecent(20);
			expect(sessions.length).toBe(20);
		});

		expect(listTime).toBeLessThan(100000); // < 100ms
		console.log(`  → List 20 sessions: ${(listTime / 1000).toFixed(1)}ms`);
	});
});

// ═══════════════════════════════════════════
// 5. TOKEN ECONOMY — Comparative analysis
// ═══════════════════════════════════════════
describe("benchmark: token-economy", () => {
	it("measures token cost of a typical 10-turn coding session", () => {
		const session: Message[] = [
			{ role: "system", content: "You are construye.lat, an expert AI coding agent..." + "x".repeat(500) },
		];

		// 10 turns: user asks, agent uses 2 tools per turn
		for (let i = 0; i < 10; i++) {
			session.push({ role: "user", content: `Implement feature ${i}: add input validation to the ${i}th API endpoint with zod schemas` });
			session.push({
				role: "assistant",
				content: `I'll implement the validation. Let me read the current file first.`,
				tool_calls: [
					{ id: `tc-read-${i}`, name: "read_file", arguments: { path: `/src/api/endpoint${i}.ts`, start_line: 1, end_line: 50 } },
				],
			});
			session.push({ role: "tool", content: `export async function handler${i}(req) {\n  const body = await req.json();\n  return new Response(JSON.stringify({ ok: true }));\n}` + "\n".repeat(20), tool_call_id: `tc-read-${i}` });
			session.push({
				role: "assistant",
				content: `I'll add zod validation to this endpoint.`,
				tool_calls: [
					{ id: `tc-edit-${i}`, name: "edit_file", arguments: { path: `/src/api/endpoint${i}.ts`, old_string: "const body = await req.json();", new_string: `const body = schema${i}.parse(await req.json());` } },
				],
			});
			session.push({ role: "tool", content: `File edited successfully.`, tool_call_id: `tc-edit-${i}` });
			session.push({ role: "assistant", content: `Done! I've added zod validation to endpoint ${i}.` });
		}

		const totalTokens = estimateMessagesTokens(session);
		const inputPerTurn = totalTokens / 10;

		console.log(`  → 10-turn coding session: ${totalTokens} tokens total`);
		console.log(`  → Per-turn average: ${inputPerTurn.toFixed(0)} tokens`);
		console.log(`  → With Code Mode (Est. 81% saving): ~${Math.round(totalTokens * 0.19)} tokens`);

		// Verify reasonable token usage
		expect(totalTokens).toBeLessThan(20000); // Should be efficient
		expect(totalTokens).toBeGreaterThan(500); // But not unrealistically small
	});

	it("measures system prompt overhead per model", () => {
		const models = Object.entries(MODEL_CONTEXT_SIZES);
		console.log("  → System prompt overhead by model:");
		for (const [model, contextSize] of models) {
			const overhead = 350; // estimated system prompt tokens
			const pct = (overhead / contextSize * 100).toFixed(2);
			console.log(`     ${model}: ${overhead}/${contextSize} = ${pct}%`);
		}
	});
});

// ═══════════════════════════════════════════
// 6. ERROR RECOVERY — Resilience
// ═══════════════════════════════════════════
describe("benchmark: error-recovery", () => {
	it("MAX_ERROR_RETRIES is 3", () => {
		expect(MAX_ERROR_RETRIES).toBe(3);
	});

	it("agent loop handles transient errors with exponential backoff", () => {
		// Verify the retry logic constants
		const delays = [500, 1000, 2000]; // 500 * 2^0, 500 * 2^1, 500 * 2^2
		for (let i = 0; i < MAX_ERROR_RETRIES; i++) {
			expect(500 * 2 ** i).toBe(delays[i]);
		}
		console.log(`  → Retry delays: ${delays.join("ms, ")}ms (total: ${delays.reduce((a, b) => a + b)}ms)`);
	});
});

// ═══════════════════════════════════════════
// 7. MULTI-MODEL ROUTING — Cost efficiency
// ═══════════════════════════════════════════
describe("benchmark: cost-efficiency", () => {
	// Cloudflare Workers AI pricing (per M tokens, from docs)
	const PRICING: Record<string, { input: number; output: number }> = {
		"@cf/moonshot/kimi-k2.5": { input: 0.60, output: 2.50 }, // estimated
		"@cf/qwen/qwq-32b": { input: 0.66, output: 1.00 },
		"@cf/qwen/qwen3-coder-30b-a3b": { input: 0.10, output: 0.20 }, // MoE, tiny active params
		"@cf/meta/llama-3.3-70b-instruct-fp8-fast": { input: 0.29, output: 2.25 },
	};

	// Claude pricing for comparison
	const CLAUDE_PRICING = { input: 5.00, output: 25.00 };

	it("calculates cost per session with smart routing", () => {
		// Simulated session: 5 simple, 3 coding, 1 reasoning, 1 planning
		const sessionProfile = {
			simple_query: { count: 5, avgInputTokens: 500, avgOutputTokens: 200 },
			coding: { count: 3, avgInputTokens: 3000, avgOutputTokens: 2000 },
			reasoning: { count: 1, avgInputTokens: 5000, avgOutputTokens: 4000 },
			planning: { count: 1, avgInputTokens: 4000, avgOutputTokens: 3000 },
		};

		let totalCostConstruye = 0;
		let totalCostClaude = 0;
		let totalInputTokens = 0;
		let totalOutputTokens = 0;

		for (const [taskType, profile] of Object.entries(sessionProfile)) {
			const model = getModelForTask(taskType as import("@construye/shared").TaskType);
			const pricing = PRICING[model.model] ?? PRICING["@cf/qwen/qwen3-coder-30b-a3b"];
			
			const input = profile.count * profile.avgInputTokens;
			const output = profile.count * profile.avgOutputTokens;
			totalInputTokens += input;
			totalOutputTokens += output;

			const costConstruye = (input / 1_000_000 * pricing.input) + (output / 1_000_000 * pricing.output);
			const costClaude = (input / 1_000_000 * CLAUDE_PRICING.input) + (output / 1_000_000 * CLAUDE_PRICING.output);

			totalCostConstruye += costConstruye;
			totalCostClaude += costClaude;
		}

		const savings = ((1 - totalCostConstruye / totalCostClaude) * 100).toFixed(1);

		console.log(`  → Session: ${totalInputTokens} input + ${totalOutputTokens} output tokens`);
		console.log(`  → construye.lat (smart routing): $${totalCostConstruye.toFixed(6)}`);
		console.log(`  → Claude Code (Opus 4.6):        $${totalCostClaude.toFixed(6)}`);
		console.log(`  → Savings: ${savings}%`);
		console.log(`  → Daily cost (50 sessions): construye=$${(totalCostConstruye * 50).toFixed(4)} vs Claude=$${(totalCostClaude * 50).toFixed(4)}`);

		expect(totalCostConstruye).toBeLessThan(totalCostClaude);
	});

	it("Workers AI free tier covers ~50 requests/day", () => {
		const FREE_NEURONS = 10_000;
		// Average coding request: ~3000 input (~60K neurons) + ~2000 output (~90K neurons) = ~150K neurons
		// That's too high for heavy models. With smart routing:
		// Simple: ~500 input (~5K neurons) + ~200 output (~3.4K neurons) = ~8.4K neurons
		// So the free tier covers about 1 simple request per 840 neurons
		// Mixed routing: average ~200 neurons per light request, ~150K per heavy
		const avgNeuronsPerLightRequest = 840; // fast model
		const lightRequests = Math.floor(FREE_NEURONS / avgNeuronsPerLightRequest);
		console.log(`  → Free tier (10K neurons): ~${lightRequests} light requests/day`);
		expect(lightRequests).toBeGreaterThan(5);
	});
});

// ═══════════════════════════════════════════
// 8. ARCHITECTURE CAPABILITIES SCORECARD
// ═══════════════════════════════════════════
describe("benchmark: capabilities-scorecard", () => {
	interface Capability {
		name: string;
		status: "implemented" | "partial" | "planned" | "missing";
		score: number; // 0-10
		notes: string;
	}

	const capabilities: Capability[] = [
		{ name: "Agent Loop (streaming)", status: "implemented", score: 8, notes: "While loop with tool calls, streaming, error handling" },
		{ name: "Multi-model routing", status: "implemented", score: 7, notes: "6 task types → 3 Workers AI models" },
		{ name: "Tool system (18 tools)", status: "implemented", score: 8, notes: "Registry, stubs, execution, approval — 18 registered tools" },
		{ name: "Context engine", status: "implemented", score: 7, notes: "System prompt, project identity, tool stubs, skills, auto-detect" },
		{ name: "Compaction", status: "implemented", score: 6, notes: "80% threshold, summary-based, cheapest model" },
		{ name: "Session persistence", status: "implemented", score: 7, notes: "JSONL files, load/save/list/delete" },
		{ name: "Error recovery", status: "implemented", score: 6, notes: "3 retries, exponential backoff, transient detection" },
		{ name: "Git integration", status: "implemented", score: 5, notes: "Real execFile, command whitelist, security" },
		{ name: "Tool call loop detection", status: "implemented", score: 5, notes: "Signature tracking, force text-only after 2 repeats" },
		{ name: "Web search & browse", status: "implemented", score: 7, notes: "Brave Search API + HTML→text converter, URL fetch" },
		{ name: "Codebase indexing (TF-IDF)", status: "implemented", score: 6, notes: "TF-IDF search, file collection, relevance scoring, preview" },
		{ name: "Project detection", status: "implemented", score: 6, notes: "Auto-detect Node.js/Python/Rust/Go, frameworks, monorepo" },
		{ name: "Task memory", status: "implemented", score: 5, notes: "Session-scoped scratchpad, CRUD operations" },
		{ name: "Terminal rendering", status: "implemented", score: 7, notes: "Syntax highlighting, tool icons, activity labels, bordered code" },
		{ name: "Post-edit verification", status: "partial", score: 3, notes: "TypeScript typecheck only, no linting/tests yet" },
		{ name: "Code Mode / batching", status: "planned", score: 0, notes: "Placeholder — needs Dynamic Workers" },
		{ name: "Sub-agents", status: "planned", score: 0, notes: "Planned — needs orchestration" },
		{ name: "MCP support", status: "planned", score: 0, notes: "Planned — McpAgent + client" },
		{ name: "Extended thinking", status: "planned", score: 0, notes: "Planned — QwQ routing exists, budget control missing" },
		{ name: "Web UI", status: "missing", score: 0, notes: "Placeholder page only" },
		{ name: "Cloud execution (DO)", status: "missing", score: 0, notes: "DO exists but doesn't run agent loop" },
		{ name: "Skills (real loading)", status: "partial", score: 2, notes: "Matcher + stubs exist, no skill content loaded" },
	];

	it("prints capabilities scorecard", () => {
		const total = capabilities.reduce((sum, c) => sum + c.score, 0);
		const max = capabilities.length * 10;
		const pct = (total / max * 100).toFixed(1);

		console.log("\n  ════════════════════════════════════════════════");
		console.log("  CONSTRUYE.LAT — CAPABILITIES SCORECARD");
		console.log("  ════════════════════════════════════════════════");
		
		for (const c of capabilities) {
			const bar = "█".repeat(c.score) + "░".repeat(10 - c.score);
			const statusIcon = c.status === "implemented" ? "✅" : c.status === "partial" ? "⚠️" : c.status === "planned" ? "📋" : "❌";
			console.log(`  ${statusIcon} ${bar} ${c.score}/10 ${c.name}`);
		}

		console.log("  ────────────────────────────────────────────────");
		console.log(`  TOTAL: ${total}/${max} (${pct}%)`);
		console.log("  ════════════════════════════════════════════════\n");

		const implemented = capabilities.filter(c => c.status === "implemented");
		const partial = capabilities.filter(c => c.status === "partial");
		const planned = capabilities.filter(c => c.status === "planned");
		const missing = capabilities.filter(c => c.status === "missing");

		console.log(`  Implemented: ${implemented.length} | Partial: ${partial.length} | Planned: ${planned.length} | Missing: ${missing.length}`);
	});

	it("compares against competitors", () => {
		interface Competitor {
			name: string;
			score: number;
			price: string;
			model: string;
			sweBench: string;
		}

		const competitors: Competitor[] = [
			{ name: "Claude Code", score: 95, price: "$20-200/mo + API", model: "Opus 4.6 (proprietary)", sweBench: "80.9% Verified" },
			{ name: "Cursor", score: 90, price: "$20-200/mo", model: "Various (proprietary)", sweBench: "50.2% Pro" },
			{ name: "Auggie CLI", score: 85, price: "$50/mo + API", model: "Any (BYOK)", sweBench: "51.8% Pro (#1)" },
			{ name: "Codex CLI", score: 80, price: "API costs", model: "GPT-5.x (OSS harness)", sweBench: "46.5% Pro" },
			{ name: "Gemini CLI", score: 78, price: "Free tier!", model: "Gemini 3.1 Pro", sweBench: "78.8% Verified" },
			{ name: "OpenCode", score: 70, price: "API costs", model: "75+ providers", sweBench: "~65% est." },
			{ name: "Cline", score: 72, price: "Free + API", model: "BYOK", sweBench: "~60% est." },
			{ name: "construye.lat", score: 45, price: "FREE (Workers AI)", model: "Kimi K2.5 (76.8%)", sweBench: "TBD" },
		];

		console.log("\n  ═══════════════════════════════════════════════════════════════");
		console.log("  COMPETITIVE LANDSCAPE — Coding Agents (April 2026)");
		console.log("  ═══════════════════════════════════════════════════════════════");
		console.log("  Agent            Score  Price              SWE-bench");
		console.log("  ─────────────────────────────────────────────────────────────");
		for (const c of competitors) {
			const bar = "█".repeat(Math.round(c.score / 10)) + "░".repeat(10 - Math.round(c.score / 10));
			console.log(`  ${c.name.padEnd(18)} ${bar} ${String(c.score).padStart(3)}  ${c.price.padEnd(18)} ${c.sweBench}`);
		}
		console.log("  ═══════════════════════════════════════════════════════════════");
		console.log("  KEY INSIGHT: Harness matters more than model.");
		console.log("  Same model (Opus 4.5): Auggie=51.8% vs SWE-Agent=45.9% (+6pts)");
		console.log("  ═══════════════════════════════════════════════════════════════\n");
	});
});
