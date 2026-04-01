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
