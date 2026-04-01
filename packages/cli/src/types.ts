import type { AgentMode } from "@construye/shared";

export interface CliConfig {
	mode: AgentMode;
	model: string;
	provider: string;
	cloud: boolean;
	verbose: boolean;
	demo: boolean;
}

export interface CliState {
	config: CliConfig;
	sessionId: string | null;
	isRunning: boolean;
	inputBuffer: string;
}

export const DEFAULT_CLI_CONFIG: CliConfig = {
	mode: "interactive",
	model: "claude-sonnet-4-20250514",
	provider: "anthropic",
	cloud: false,
	verbose: false,
	demo: false,
};

// ── Display types for Ink UI ──────────────────────────

export type ToolCallStatus = "pending" | "running" | "done" | "error" | "denied";

export interface DisplayToolCall {
	id: string;
	name: string;
	args: string;
	status: ToolCallStatus;
	result?: string;
	elapsed?: number;
}

export type LogEntryType = "user" | "assistant" | "tool-call" | "turn-metrics" | "system";

export interface LogEntry {
	id: string;
	type: LogEntryType;
	timestamp: number;
	content?: string;
	toolCall?: DisplayToolCall;
	metrics?: {
		elapsed: string;
		tokensIn?: number;
		tokensOut?: number;
		costCents?: number;
		turn: number;
	};
}
