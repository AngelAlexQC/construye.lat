export const VERSION = "0.1.0";

/** Default context window sizes by model */
export const MODEL_CONTEXT_SIZES: Record<string, number> = {
	"claude-opus-4": 200_000,
	"claude-sonnet-4": 200_000,
	"gpt-5": 128_000,
	"gpt-5.3": 128_000,
	"llama-4-scout": 128_000,
	"qwen-3-coder-32b": 32_000,
};

/** Compaction triggers at this percentage of context usage */
export const COMPACTION_THRESHOLD = 0.80;

/** Maximum turns before forcing human input */
export const MAX_AGENT_TURNS = 25;

/** Max characters before persisting tool output to R2 */
export const LARGE_OUTPUT_THRESHOLD = 50_000;

/** Token estimate: ~4 chars per token (rough approximation) */
export const CHARS_PER_TOKEN = 4;

/** Default models per task type */
export const DEFAULT_MODELS: Record<string, string> = {
	reasoning: "claude-opus-4",
	coding: "claude-sonnet-4",
	file_ops: "llama-4-scout",
	planning: "claude-sonnet-4",
	embedding: "bge-large-en-v1.5",
	compaction: "llama-4-scout",
};
