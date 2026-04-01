#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink";
import { parseArgs } from "./args.ts";
import { createSession, FileSessionStore } from "@construye/core";
import { ClaudeProvider, WorkersAIProvider, DemoProvider, WORKERS_AI_MODELS } from "@construye/providers";
import type { ProviderAdapter } from "@construye/providers";
import { createDefaultRegistry, type ToolContext } from "@construye/tools";
import type { ToolCall } from "@construye/shared";
import { App } from "./app.tsx";
import type { AgentSetup } from "./hooks/use-agent.ts";

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
		} catch {
			/* not found */
		}
	}
	return null;
}

/** Detect Cloudflare account ID from API */
async function detectAccountId(token: string): Promise<string | null> {
	try {
		const resp = await fetch("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5", {
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = (await resp.json()) as { result?: { id: string; name: string }[] };
		if (data.result?.[0]) return data.result[0].id;
	} catch {
		/* network error */
	}
	return null;
}

async function main(): Promise<void> {
	const config = parseArgs(process.argv.slice(2));

	// ── Detect best available provider ──────────────────────
	const anthropicKey = process.env.ANTHROPIC_API_KEY;
	let cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	let cfApiToken = process.env.CLOUDFLARE_API_TOKEN;
	const openaiKey = process.env.OPENAI_API_KEY;

	if (!cfApiToken) {
		const wranglerToken = readWranglerToken();
		if (wranglerToken) {
			cfApiToken = wranglerToken;
			if (!cfAccountId) {
				cfAccountId = (await detectAccountId(wranglerToken)) ?? undefined;
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
		if (!cfAccountId || !cfApiToken) {
			console.error("  Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, or run 'npx wrangler login'.");
			process.exit(1);
		}
		provider = new WorkersAIProvider(cfAccountId, cfApiToken);
		providerName = "workers-ai (Cloudflare)";
		modelName =
			config.model.startsWith("@cf/") || config.model.startsWith("@hf/")
				? config.model
				: (WORKERS_AI_MODELS[config.model as keyof typeof WORKERS_AI_MODELS] ?? WORKERS_AI_MODELS["qwen-coder"]);
	} else if (anthropicKey) {
		provider = new ClaudeProvider(anthropicKey);
		providerName = "anthropic";
		modelName = config.model;
	} else {
		provider = new DemoProvider();
		providerName = "demo (no API key)";
		modelName = "demo";
	}

	// ── Tool registry ──────────────────────────────────────
	const registry = createDefaultRegistry();
	const workingDir = process.cwd();
	const sessionStore = new FileSessionStore();
	const session = createSession("local", "cli-user", modelName);

	const toolContext: ToolContext = {
		workingDir,
		sessionId: session.id,
		projectId: "local",
	};

	const anthropicTools = registry
		.list()
		.map((name) => {
			const def = registry.getDefinition(name);
			if (!def) return null;
			return { name: def.name, description: def.description, input_schema: def.parameters };
		})
		.filter(Boolean);

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

	const skillLoader = {
		getStubs: () => [],
		activate: async (_name: string) => "Skill not loaded",
		loadReference: async (_skill: string, _path: string) => "",
	};

	let projectIdentity: string | undefined;
	try {
		projectIdentity = fs.readFileSync(path.join(workingDir, "CONSTRUYE.md"), "utf-8");
	} catch {
		/* no CONSTRUYE.md */
	}

	// ── Build agent setup and render Ink app ───────────────
	const isOpenAI = providerName.includes("workers-ai") || providerName.includes("openai");

	const setup: AgentSetup = {
		provider,
		modelConfig: {
			provider: (isOpenAI ? "workers-ai" : "claude") as "workers-ai" | "claude",
			model: modelName,
			max_tokens: 4096,
		},
		tools: anthropicTools,
		toolExecutor,
		skillLoader,
		projectIdentity,
		mode: config.mode,
	};

	render(
		React.createElement(App, {
			setup,
			config,
			providerName,
			modelName,
			sessionStore,
			initialSession: session,
		}),
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
