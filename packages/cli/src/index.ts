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

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const RED = "\x1b[31m";

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
			console.error(`${RED}  Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, or run 'npx wrangler login'.${RESET}`);
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
	console.log(`\n${BOLD}${CYAN}  ╔═══════════════════════════════════════╗${RESET}`);
	console.log(`${BOLD}${CYAN}  ║   🏗️  construye.lat — AI coding agent  ║${RESET}`);
	console.log(`${BOLD}${CYAN}  ╚═══════════════════════════════════════╝${RESET}\n`);
	console.log(`  ${DIM}Provider:${RESET} ${providerName}  ${DIM}Model:${RESET} ${modelName}  ${DIM}Tools:${RESET} ${registry.list().length}`);
	console.log(`  ${DIM}Dir:${RESET} ${workingDir}`);
	if (providerName.includes("demo")) {
		console.log(`\n  ${YELLOW}Running in demo mode. To use real AI:${RESET}`);
		console.log(`  ${DIM}  Cloudflare: npx wrangler login  (auto-detects credentials)${RESET}`);
		console.log(`  ${DIM}  or set:     CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN${RESET}`);
		console.log(`  ${DIM}  Anthropic:  ANTHROPIC_API_KEY${RESET}`);
	}
	console.log(`\n  ${DIM}Type your request. Ctrl+C to exit.${RESET}\n`);

	// Conversation history
	let history: Message[] = [];
	let processing = false;

	// Readline REPL
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.on("close", () => {
		if (processing) {
			// Wait for the current request to finish before exiting
			const check = setInterval(() => {
				if (!processing) {
					clearInterval(check);
					console.log(`\n${DIM}  Bye!${RESET}\n`);
					process.exit(0);
				}
			}, 100);
		} else {
			console.log(`\n${DIM}  Bye!${RESET}\n`);
			process.exit(0);
		}
	});

	const prompt = () => {
		try {
			rl.question(`${GREEN}❯ ${RESET}`, async (input) => {
				const trimmed = input.trim();
				if (!trimmed) { prompt(); return; }

				if (trimmed === "/clear") {
					history = [];
					session = createSession("local", "cli-user", modelName);
					console.log(`${DIM}  History cleared. New session started.${RESET}\n`);
					prompt();
					return;
				}
				if (trimmed === "/history") {
					console.log(`${DIM}  ${history.length} messages in history | Session: ${session.id.slice(0, 8)}${RESET}\n`);
					prompt();
					return;
				}
				if (trimmed === "/sessions") {
					const recent = await sessionStore.listRecent(5);
					if (recent.length === 0) {
						console.log(`${DIM}  No saved sessions.${RESET}\n`);
					} else {
						console.log(`${DIM}  Recent sessions:${RESET}`);
						for (const r of recent) {
							const msgs = (await sessionStore.load(r.id))?.messages.length ?? 0;
							console.log(`  ${DIM}${r.id.slice(0, 8)}${RESET}  ${msgs} msgs  ${r.session.started_at}`);
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
							console.log(`${DIM}  No sessions to resume.${RESET}\n`);
							prompt();
							return;
						}
						const loaded = await sessionStore.load(recent[0].id);
						if (loaded) {
							session = loaded.session;
							history = loaded.messages;
							console.log(`${GREEN}  Resumed session ${session.id.slice(0, 8)} (${history.length} messages)${RESET}\n`);
						}
					} else {
						const recent = await sessionStore.listRecent(20);
						const match = recent.find((r) => r.id.startsWith(prefix));
						if (match) {
							const loaded = await sessionStore.load(match.id);
							if (loaded) {
								session = loaded.session;
								history = loaded.messages;
								console.log(`${GREEN}  Resumed session ${session.id.slice(0, 8)} (${history.length} messages)${RESET}\n`);
							}
						} else {
							console.log(`${RED}  No session matching '${prefix}'${RESET}\n`);
						}
					}
					prompt();
					return;
				}

				try {
					processing = true;

					// Spinner while waiting for first token
					const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
					let spinnerIdx = 0;
					let gotFirstToken = false;
					const startTime = Date.now();
					const spinner = setInterval(() => {
						if (!gotFirstToken) {
							const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
							process.stdout.write(`\r  ${CYAN}${spinnerFrames[spinnerIdx]}${RESET} ${DIM}Thinking... ${elapsed}s${RESET}  `);
							spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
						}
					}, 80);

					const isOpenAI = providerName.includes("workers-ai") || providerName.includes("openai");
					const agentConfig = {
						provider: {
							chat: (messages: Message[], tools?: unknown[]) => provider.stream(messages, {
								provider: "workers-ai" as const,
								model: modelName,
								max_tokens: 4096,
							}, tools),
						},
						toolExecutor,
						skillLoader,
						modelConfig: {
							provider: (isOpenAI ? "workers-ai" : "claude") as "workers-ai" | "claude",
							model: modelName,
							max_tokens: 4096,
						},
						onStream: (chunk: StreamChunk) => {
							if (chunk.type === "text" && chunk.content) {
								if (!gotFirstToken) {
									gotFirstToken = true;
									clearInterval(spinner);
									// Clear spinner line, start fresh
									process.stdout.write(`\r\x1b[K`);
								}
								process.stdout.write(chunk.content);
							}
							if (chunk.type === "tool_call" && chunk.tool_call) {
								if (!gotFirstToken) {
									gotFirstToken = true;
									clearInterval(spinner);
									process.stdout.write(`\r\x1b[K`);
								}
								const args = JSON.stringify(chunk.tool_call.arguments).slice(0, 80);
								process.stdout.write(`\n  ${YELLOW}⚡ ${chunk.tool_call.name}${DIM}(${args})${RESET}`);
							}
							if (chunk.type === "done") {
								if (!gotFirstToken) {
									gotFirstToken = true;
									clearInterval(spinner);
									process.stdout.write(`\r\x1b[K`);
								}
								const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
								process.stdout.write(`${RESET}\n  ${DIM}${elapsed}s${RESET}`);
							}
						},
						onApproval: async (call: ToolCall): Promise<boolean> => {
							if (config.mode === "auto") return true;
							return new Promise((resolve) => {
								rl.question(`\n  ${YELLOW}Allow ${call.name}? [Y/n] ${RESET}`, (answer) => {
									resolve(answer.trim().toLowerCase() !== "n");
								});
							});
						},
						maxTurns: 15,
						tools: anthropicTools,
						projectIdentity,
					};

					history = await runAgentLoop(trimmed, history, agentConfig);

					// Persist session to disk
					await sessionStore.save(session.id, { session, messages: history });

					clearInterval(spinner);
					process.stdout.write(`${RESET}\n\n`);
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`\n${RED}  Error: ${msg}${RESET}\n`);
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
