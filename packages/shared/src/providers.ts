/** Model provider configuration */
export interface ModelConfig {
	provider: ProviderName;
	model: string;
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
}

/** Supported provider names */
export type ProviderName = "ai_gateway" | "claude" | "openai" | "workers-ai" | "custom";

/** A chunk from a streaming response */
export interface StreamChunk {
	type: "text" | "tool_call" | "done" | "error";
	content?: string;
	tool_call?: import("./types.js").ToolCall;
	error?: string;
	usage?: TokenUsage;
}

/** Token usage stats for a single request */
export interface TokenUsage {
	input_tokens: number;
	output_tokens: number;
	cached_tokens?: number;
	cost_cents: number;
}
