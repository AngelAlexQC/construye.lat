export const VERSION = "0.2.0";

/** Default context window sizes by model */
export const MODEL_CONTEXT_SIZES: Record<string, number> = {
	// Frontier models on Workers AI
	"@cf/moonshotai/kimi-k2.5": 128_000,
	"@cf/qwen/qwq-32b": 32_000,
	"@cf/qwen/qwen3-30b-a3b-fp8": 32_000,
	// Strong models on Workers AI
	"@cf/qwen/qwen2.5-coder-32b-instruct": 32_000,
	"@cf/openai/gpt-oss-120b": 128_000,
	"@cf/meta/llama-3.3-70b-instruct-fp8-fast": 128_000,
	// Proprietary (when available)
	"claude-opus-4": 200_000,
	"claude-sonnet-4": 200_000,
	"gpt-5": 128_000,
};

/** Compaction triggers at this percentage of context usage */
export const COMPACTION_THRESHOLD = 0.80;

/** Maximum turns before forcing human input */
export const MAX_AGENT_TURNS = 30;

/** Max characters before persisting tool output to R2 */
export const LARGE_OUTPUT_THRESHOLD = 50_000;

/** Token estimate: ~4 chars per token (rough approximation) */
export const CHARS_PER_TOKEN = 4;

/** Maximum retries for error recovery in agent loop */
export const MAX_ERROR_RETRIES = 3;

/** Models available on Workers AI — keyed by task role */
export const WORKERS_AI_MODEL_MAP = {
	/** Heavy coding — best open model for SWE tasks */
	heavy: "@cf/moonshotai/kimi-k2.5",
	/** Reasoning — dedicated thinking model */
	reasoning: "@cf/qwen/qwq-32b",
	/** Fast — tiny MoE, instant responses, file ops */
	fast: "@cf/qwen/qwen3-30b-a3b-fp8",
	/** Fallback — strong general purpose */
	general: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
} as const;

/** Built-in Browser Worker proxy — deployed at Cloudflare, free tier */
export const BROWSER_WORKER_DEFAULTS = {
	url: "https://construye-browser.quirozai.workers.dev",
	key: "construye-br-3aba0c39976303975e061ac71011a788",
} as const;

/** Default models per task type — all Workers AI, no external deps */
export const DEFAULT_MODELS: Record<string, string> = {
	reasoning: WORKERS_AI_MODEL_MAP.reasoning,
	coding: WORKERS_AI_MODEL_MAP.heavy,
	file_ops: WORKERS_AI_MODEL_MAP.fast,
	planning: WORKERS_AI_MODEL_MAP.heavy,
	compaction: WORKERS_AI_MODEL_MAP.fast,
	simple_query: WORKERS_AI_MODEL_MAP.fast,
	embedding: "@cf/baai/bge-large-en-v1.5",
};
