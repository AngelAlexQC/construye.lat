#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import React from "react";
import { render } from "ink";
import { parseArgs } from "./args.ts";
import { ensureCloudflareSetup, loadConfig } from "./setup/first-run.ts";
import { createSession, FileSessionStore } from "@construye/core";
import {
	ClaudeProvider,
	WorkersAIProvider,
	DemoProvider,
	WORKERS_AI_MODELS,
} from "@construye/providers";
import type { ProviderAdapter } from "@construye/providers";
import { createDefaultRegistry, type ToolContext } from "@construye/tools";
import type { ToolCall } from "@construye/shared";
import { BROWSER_WORKER_DEFAULTS } from "@construye/shared";
import { App } from "./app.tsx";
import type { AgentSetup } from "./hooks/use-agent.ts";

async function main(): Promise<void> {
	const config = parseArgs(process.argv.slice(2));

	// ── Browser Worker (free, built-in) ───────────────────────
	if (!process.env.BROWSER_WORKER_URL) {
		process.env.BROWSER_WORKER_URL = BROWSER_WORKER_DEFAULTS.url;
	}
	if (!process.env.BROWSER_WORKER_KEY) {
		process.env.BROWSER_WORKER_KEY = BROWSER_WORKER_DEFAULTS.key;
	}

	// ── Provider selection ────────────────────────────────────
	let provider: ProviderAdapter;
	let providerName: string;
	let modelName: string;
	let providerType: "workers-ai" | "claude";

	if (config.demo) {
		provider = new DemoProvider();
		providerName = "demo";
		modelName = "demo";
		providerType = "workers-ai";
	} else if (config.provider === "anthropic") {
		// Explicitly requested Claude
		const anthropicKey = process.env.ANTHROPIC_API_KEY;
		if (!anthropicKey) {
			console.error("\n  Error: --provider anthropic requiere ANTHROPIC_API_KEY en el entorno.\n");
			process.exit(1);
		}
		provider = new ClaudeProvider(anthropicKey);
		providerName = "anthropic (Claude)";
		modelName = config.model;
		providerType = "claude";
	} else if (config.provider === "openai") {
		// OpenAI explicit — fallback to Workers AI if no key
		const openaiKey = process.env.OPENAI_API_KEY;
		if (!openaiKey) {
			console.error("\n  Error: --provider openai requiere OPENAI_API_KEY en el entorno.\n");
			process.exit(1);
		}
		// Use Claude provider as OpenAI-compatible for now
		provider = new ClaudeProvider(openaiKey);
		providerName = "openai";
		modelName = config.model;
		providerType = "claude";
	} else {
		// DEFAULT: Cloudflare Workers AI — auto-configure if needed
		const creds = await ensureCloudflareSetup();

		if (!creds) {
			// Hard fallback: if wrangler login failed/cancelled, check Claude key
			const anthropicKey = process.env.ANTHROPIC_API_KEY;
			if (anthropicKey) {
				console.log("  Usando Anthropic Claude como fallback.\n");
				provider = new ClaudeProvider(anthropicKey);
				providerName = "anthropic (Claude)";
				modelName = config.model;
				providerType = "claude";
			} else {
				console.log("  Iniciando en modo demo (sin provider configurado).\n");
				provider = new DemoProvider();
				providerName = "demo";
				modelName = "demo";
				providerType = "workers-ai";
			}
		} else {
			// Resolve model: explicit flag > saved config > default (kimi-k2.5)
			const savedConfig = loadConfig();
			const defaultModel =
				config.model !== "claude-opus-4-5-20251101" // not the default Claude model
					? config.model
					: (savedConfig?.provider === "workers-ai"
						? WORKERS_AI_MODELS["kimi-k2.5"]
						: WORKERS_AI_MODELS["kimi-k2.5"]);

			const resolvedModel =
				defaultModel.startsWith("@cf/") || defaultModel.startsWith("@hf/")
					? defaultModel
					: (WORKERS_AI_MODELS[defaultModel as keyof typeof WORKERS_AI_MODELS] ??
						WORKERS_AI_MODELS["kimi-k2.5"]);

			provider = new WorkersAIProvider(creds.accountId, creds.apiToken);
			providerName = "Cloudflare Workers AI";
			modelName = resolvedModel;
			providerType = "workers-ai";
		}
	}

	// ── Tool registry ──────────────────────────────────────────
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

	// ── Build agent setup and render Ink app ───────────────────
	const setup: AgentSetup = {
		provider,
		modelConfig: {
			provider: providerType,
			model: modelName,
			max_tokens: 8192,
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
