#!/usr/bin/env node

import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parseArgs } from "./args.ts";
import { runAgentLoop, createSession, updateSessionStats, FileSessionStore } from "@construye/core";
import type { Session } from "@construye/shared";
import { ClaudeProvider, WorkersAIProvider, DemoProvider, WORKERS_AI_MODELS } from "@construye/providers";
import type { ProviderAdapter } from "@construye/providers";
import {
	createDefaultRegistry,
	type ToolContext,
} from "@construye/tools";
import type { StreamChunk, ToolCall, Message } from "@construye/shared";
import chalk from "chalk";
import {
	banner,
	assistantHeader,
	indentedMarkdown,
	toolCallHeader,
	toolCallExecuting,
	toolCallDone,
	turnMetrics,
	spinnerFrame,
	thinkingLine,
	receivingLine,
	usageTable,
	fmtTokens,
	fmtCost,
	PROMPT,
	successMsg,
	errorMsg,
	dimMsg,
	approvalPrompt,
	approvalResult,
	autoApproved,
	goodbye,
} from "./render.ts";

// ── JSON tool-call filter ───────────────────────────────────
// Some smaller models emit raw JSON tool calls as text. Filter them out.
const JSON_TOOL_CALL_PATTERNS = [
	/^\s*\{[\s]*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:/,
	/^\s*\{[\s]*"tool_name"\s*:/,
	/^\s*\{[\s]*"type"\s*:\s*"function"\s*,/,
	/^\s*```json\s*\n?\s*\{[\s]*"name"\s*:/,
];

function isRawToolCallJson(text: string): boolean {
	return JSON_TOOL_CALL_PATTERNS.some(re => re.test(text));
}



/** Read wrangler OAuth token from ~/.wrangler/config/default.toml */
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

/** Detect Cloudflare account ID from API */
async function detectAccountId(token: string): Promise<string | null> {
	try {
		const resp = await fetch("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5", {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await resp.json() as { result?: { id: string; name: string }[] };
		if (data.result?.[0]) return data.result[0].id;
	} catch { /* network error */ }
	return null;
}

async function main(): Promise<void> {
	const config = parseArgs(process.argv.slice(2));

	// Detect best available provider
	const anthropicKey = process.env.ANTHROPIC_API_KEY;
	let cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	let cfApiToken = process.env.CLOUDFLARE_API_TOKEN;
	const openaiKey = process.env.OPENAI_API_KEY;

	// Auto-detect wrangler credentials if not set via env
	if (!cfApiToken) {
		const wranglerToken = readWranglerToken();
		if (wranglerToken) {
			cfApiToken = wranglerToken;
			if (!cfAccountId) {
				cfAccountId = await detectAccountId(wranglerToken) ?? undefined;
			}
		}
	}

	let provider: ProviderAdapter;
	let providerName: string;
	let modelName: string;

	if (config.demo) {
		provider = new DemoProvider();
		providerName = "demo";
		modelName = "demo";
	} else if (config.provider === "workers-ai" || (cfAccountId && cfApiToken && !anthropicKey && !openaiKey)) {
		// Use Cloudflare Workers AI
		if (!cfAccountId || !cfApiToken) {
			console.error(chalk.red("  Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, or run 'npx wrangler login'."));
			process.exit(1);
		}
		provider = new WorkersAIProvider(cfAccountId, cfApiToken);
		providerName = "workers-ai (Cloudflare)";
		// Pick best default model — qwen-coder is fast + good at coding
		modelName = config.model.startsWith("@cf/") || config.model.startsWith("@hf/")
			? config.model
			: WORKERS_AI_MODELS[config.model as keyof typeof WORKERS_AI_MODELS]
				?? WORKERS_AI_MODELS["qwen-coder"];
	} else if (anthropicKey) {
		provider = new ClaudeProvider(anthropicKey);
		providerName = "anthropic";
		modelName = config.model;
	} else {
		// No keys — fallback to demo
		provider = new DemoProvider();
		providerName = "demo (no API key)";
		modelName = "demo";
	}

	// Initialize tool registry with real local tools
	const registry = createDefaultRegistry();
	const workingDir = process.cwd();

	// Session persistence
	const sessionStore = new FileSessionStore();
	let session = createSession("local", "cli-user", modelName);

	const toolContext: ToolContext = {
		workingDir,
		sessionId: session.id,
		projectId: "local",
	};

	// Build Anthropic tool definitions from registry
	const anthropicTools = registry.list().map((name) => {
		const def = registry.getDefinition(name);
		if (!def) return null;
		return {
			name: def.name,
			description: def.description,
			input_schema: def.parameters,
		};
	}).filter(Boolean);

	// Tool executor adapter
	const toolExecutor = {
		async execute(call: ToolCall) {
			const handler = registry.get(call.name);
			if (!handler) {
				return { tool_call_id: call.id, content: `Unknown tool: ${call.name}`, is_error: true };
			}
			try {
				const result = await handler.execute(call.arguments, toolContext);
				return { tool_call_id: call.id, content: result };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { tool_call_id: call.id, content: `Error: ${msg}`, is_error: true };
			}
		},
		needsApproval(call: ToolCall): boolean {
			const handler = registry.get(call.name);
			if (!handler) return true;
			if (config.mode === "auto") return call.name === "exec";
			if (config.mode === "plan") return true;
			return handler.requiresApproval;
		},
	};

	// Skill loader stub
	const skillLoader = {
		getStubs: () => [],
		activate: async (_name: string) => "Skill not loaded",
		loadReference: async (_skill: string, _path: string) => "",
	};

	// Load project identity (CONSTRUYE.md)
	let projectIdentity: string | undefined;
	try {
		projectIdentity = fs.readFileSync(path.join(workingDir, "CONSTRUYE.md"), "utf-8");
	} catch {
		// No CONSTRUYE.md — that's fine
	}

	// Print banner
	const modeLabel = config.mode === "plan" ? "📋 Plan" : config.mode === "auto" ? "⚡ Auto" : "💬 Interactive";
	const shortDir = workingDir.replace(os.homedir(), "~");
	console.log(banner({
		provider: providerName,
		model: modelName,
		modeLabel,
		tools: registry.list().length,
		dir: shortDir,
		isDemo: providerName.includes("demo"),
	}));

	// Conversation history
	let history: Message[] = [];
	let processing = false;

	// ── Tool approval memory (per session) ──────────────────────
	const approvedTools = new Set<string>();

	// ── Session statistics ─────────────────────────────────────
	let sessionTokensIn = 0;
	let sessionTokensOut = 0;
	let sessionCostCents = 0;
	let turnCount = 0;

	// Readline REPL
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.on("close", () => {
		if (processing) {
			const check = setInterval(() => {
				if (!processing) {
					clearInterval(check);
					console.log(goodbye());
					process.exit(0);
				}
			}, 100);
		} else {
			console.log(goodbye());
			process.exit(0);
		}
	});

	const prompt = () => {
		try {
			rl.question(PROMPT, async (input) => {
				const trimmed = input.trim();
				if (!trimmed) { prompt(); return; }

				if (trimmed === "/clear") {
					history = [];
					approvedTools.clear();
					sessionTokensIn = 0;
					sessionTokensOut = 0;
					sessionCostCents = 0;
					turnCount = 0;
					session = createSession("local", "cli-user", modelName);
					console.log(successMsg("Historial limpiado. Nueva sesión.") + "\n");
					prompt();
					return;
				}
				if (trimmed === "/history") {
					console.log(dimMsg(`${history.length} mensajes | Sesión: ${session.id.slice(0, 8)}`) + "\n");
					prompt();
					return;
				}
				if (trimmed === "/usage") {
					console.log(usageTable({
						tokensIn: sessionTokensIn,
						tokensOut: sessionTokensOut,
						costCents: sessionCostCents,
						turns: turnCount,
						messages: history.length,
						sessionId: session.id.slice(0, 8),
					}));
					prompt();
					return;
				}
				if (trimmed === "/sessions") {
					const recent = await sessionStore.listRecent(5);
					if (recent.length === 0) {
						console.log(dimMsg("No hay sesiones guardadas.") + "\n");
					} else {
						console.log(dimMsg("Sesiones recientes:"));
						for (const r of recent) {
							const msgs = (await sessionStore.load(r.id))?.messages.length ?? 0;
							console.log(`  ${chalk.cyan(r.id.slice(0, 8))}  ${msgs} msgs  ${chalk.dim(r.session.started_at)}`);
						}
						console.log();
					}
					prompt();
					return;
				}
				if (trimmed.startsWith("/resume")) {
					const prefix = trimmed.split(" ")[1]?.trim();
					if (!prefix) {
						const recent = await sessionStore.listRecent(1);
						if (recent.length === 0) {
							console.log(dimMsg("No hay sesiones para reanudar.") + "\n");
							prompt();
							return;
						}
						const loaded = await sessionStore.load(recent[0].id);
						if (loaded) {
							session = loaded.session;
							history = loaded.messages;
							approvedTools.clear();
							console.log(successMsg(`Sesión ${chalk.cyan(session.id.slice(0, 8))} reanudada (${history.length} mensajes)`) + "\n");
						}
					} else {
						const recent = await sessionStore.listRecent(20);
						const match = recent.find((r) => r.id.startsWith(prefix));
						if (match) {
							const loaded = await sessionStore.load(match.id);
							if (loaded) {
								session = loaded.session;
								history = loaded.messages;
								approvedTools.clear();
								console.log(successMsg(`Sesión ${chalk.cyan(session.id.slice(0, 8))} reanudada (${history.length} mensajes)`) + "\n");
							}
						} else {
							console.log(errorMsg(`No hay sesión con prefijo '${prefix}'`) + "\n");
						}
					}
					prompt();
					return;
				}

				try {
					processing = true;

					let spinnerIdx = 0;
					let phase: "thinking" | "receiving" | "toolcall" | "idle" = "thinking";
					const startTime = Date.now();
					let streamBuffer = "";
					let headerPrinted = false;
					const spinnerTimer = setInterval(() => {
						const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
						if (phase === "thinking") {
							process.stdout.write(thinkingLine(spinnerFrame(spinnerIdx), elapsed));
						} else if (phase === "receiving") {
							const words = streamBuffer.split(/\s+/).filter(Boolean).length;
							process.stdout.write(receivingLine(spinnerFrame(spinnerIdx), words));
						}
						spinnerIdx++;
					}, 80);

					const flushTextBuffer = () => {
						if (streamBuffer.trim() && !isRawToolCallJson(streamBuffer)) {
							process.stdout.write("\r\x1b[K"); // clear spinner/receiving line
							if (!headerPrinted) {
								process.stdout.write(assistantHeader());
								headerPrinted = true;
							}
							process.stdout.write(indentedMarkdown(streamBuffer) + "\n");
						}
						streamBuffer = "";
					};

					const isOpenAI = providerName.includes("workers-ai") || providerName.includes("openai");

					// Wrap tool executor to display timing and results
					const displayToolExecutor = {
						async execute(call: ToolCall) {
							const t0 = Date.now();
							process.stdout.write(toolCallExecuting());
							const result = await toolExecutor.execute(call);
							const te = ((Date.now() - t0) / 1000).toFixed(1);
							if (result.is_error) {
								process.stdout.write("\n" + toolCallDone(false, te));
							} else {
								const preview = result.content.length > 80
									? result.content.slice(0, 77).replace(/\n/g, " ") + "..."
									: result.content.replace(/\n/g, " ");
								process.stdout.write("\n" + toolCallDone(true, te, preview));
							}
							// Reset for next text block
							headerPrinted = false;
							phase = "thinking";
							return result;
						},
						needsApproval: toolExecutor.needsApproval.bind(toolExecutor),
					};

					const agentConfig = {
						provider: {
							chat: (messages: Message[], tools?: unknown[]) => provider.stream(messages, {
								provider: "workers-ai" as const,
								model: modelName,
								max_tokens: 4096,
							}, tools),
						},
						toolExecutor: displayToolExecutor,
						skillLoader,
						modelConfig: {
							provider: (isOpenAI ? "workers-ai" : "claude") as "workers-ai" | "claude",
							model: modelName,
							max_tokens: 4096,
						},
						onStream: (chunk: StreamChunk) => {
							if (chunk.type === "text" && chunk.content) {
								// Accumulate text in buffer
								streamBuffer += chunk.content;

								// Filter raw JSON tool calls from smaller models
								if (isRawToolCallJson(streamBuffer)) {
									if (streamBuffer.length < 3000) return;
								}

								// Switch to receiving phase on first text
								if (phase === "thinking") {
									phase = "receiving";
								}
							}
							if (chunk.type === "tool_call" && chunk.tool_call) {
								// Flush accumulated text before tool call
								phase = "toolcall";
								flushTextBuffer();

								const tc = chunk.tool_call;
								const argsStr = JSON.stringify(tc.arguments);
								process.stdout.write(toolCallHeader(tc.name, argsStr));
							}
							if (chunk.type === "done") {
								phase = "idle";
								clearInterval(spinnerTimer);

								// Flush remaining text
								flushTextBuffer();

								// Capture usage stats
								const u = chunk.usage;
								if (u) {
									sessionTokensIn += u.input_tokens;
									sessionTokensOut += u.output_tokens;
									sessionCostCents += u.cost_cents;
								}
								turnCount++;

								// Completion metrics
								const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
								process.stdout.write(turnMetrics({
									elapsed,
									tokensIn: u?.input_tokens,
									tokensOut: u?.output_tokens,
									costCents: u?.cost_cents,
									turn: turnCount,
								}));
							}
						},
						onApproval: async (call: ToolCall): Promise<boolean> => {
							if (config.mode === "auto") return true;

							// Check if already approved for this session
							if (approvedTools.has(call.name)) {
								process.stdout.write(autoApproved());
								return true;
							}

							return new Promise((resolve) => {
								rl.question(
									approvalPrompt(call.name),
									(answer) => {
										const a = answer.trim().toLowerCase();
										if (a === "n") {
											process.stdout.write(approvalResult("denied") + "\n");
											resolve(false);
										} else if (a === "a" || a === "always" || a === "siempre") {
											approvedTools.add(call.name);
											process.stdout.write(approvalResult("always") + "\n");
											resolve(true);
										} else {
											process.stdout.write(approvalResult("approved") + "\n");
											resolve(true);
										}
									},
								);
							});
						},
						maxTurns: 15,
						tools: anthropicTools,
						projectIdentity,
					};

					history = await runAgentLoop(trimmed, history, agentConfig);

					// Persist session to disk
					await sessionStore.save(session.id, { session, messages: history });

					clearInterval(spinnerTimer);
					process.stdout.write("\n\n");
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error("\n" + errorMsg(`Error: ${msg}`) + "\n");
				} finally {
					processing = false;
				}

				prompt();
			});
		} catch {
			// readline closed
		}
	};

	prompt();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
