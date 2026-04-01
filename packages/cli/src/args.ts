import { DEFAULT_CLI_CONFIG } from "./types.ts";
import type { CliConfig, } from "./types.ts";
import type { AgentMode } from "@construye/shared";

const VALID_MODES: AgentMode[] = ["plan", "interactive", "auto"];

export function parseArgs(argv: string[]): CliConfig {
	const config = { ...DEFAULT_CLI_CONFIG };

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];

		if (arg === "--mode" || arg === "-m") {
			const value = argv[++i] as AgentMode;
			if (VALID_MODES.includes(value)) config.mode = value;
		}

		if (arg === "--model") {
			config.model = argv[++i];
		}

		if (arg === "--provider" || arg === "-p") {
			config.provider = argv[++i];
		}

		if (arg === "--cloud") {
			config.cloud = true;
		}

		if (arg === "--verbose" || arg === "-v") {
			config.verbose = true;
		}

		if (arg === "--demo") {
			config.demo = true;
		}

		if (arg === "--help" || arg === "-h") {
			printHelp();
			process.exit(0);
		}
	}

	return config;
}

function printHelp(): void {
	console.log(`
construye — AI coding agent powered by Cloudflare

Usage: construye [options] [prompt]

Options:
  -m, --mode <mode>       Agent mode: plan | interactive | auto
  --model <model>         Model name or alias (see below)
  -p, --provider <name>   Provider: anthropic | openai | workers-ai
  --cloud                 Run on Cloudflare (default: local)
  --demo                  Run with demo provider (no API key needed)
  -v, --verbose           Verbose output
  -h, --help              Show help

Workers AI Models (free/cheap on Cloudflare):
  llama-3.3              Meta Llama 3.3 70B (fast, best default)
  llama-3.1              Meta Llama 3.1 70B
  llama-3.1-8b           Meta Llama 3.1 8B (fastest, cheapest)
  qwen-coder             Qwen 2.5 Coder 32B (best for code)
  qwen-2.5               Qwen 2.5 72B (powerful general)
  deepseek-r1            DeepSeek R1 distilled (reasoning)
  gpt-oss-120b           OpenAI GPT-OSS 120B
  hermes-2-pro           Hermes 2 Pro 7B (tool calling)

Environment variables:
  CLOUDFLARE_ACCOUNT_ID   Cloudflare account ID
  CLOUDFLARE_API_TOKEN    Cloudflare API token (Workers AI permissions)
  ANTHROPIC_API_KEY       Anthropic API key (for Claude models)
  OPENAI_API_KEY          OpenAI API key (for GPT models)
`);
}
