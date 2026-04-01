import type { Message, ModelConfig, ToolCall, ToolResult, StreamChunk } from "@construye/shared";

/** Provider interface — implemented by each model provider */
export interface Provider {
	chat(messages: Message[], tools?: unknown[]): AsyncIterable<StreamChunk>;
	embed?(texts: string[]): Promise<number[][]>;
}

/** Tool executor — implemented by tool router */
export interface ToolExecutor {
	execute(call: ToolCall): Promise<ToolResult>;
	needsApproval(call: ToolCall): boolean;
}

/** Skill loader — implemented by skills engine */
export interface SkillLoader {
	getStubs(): Array<{ name: string; description: string }>;
	activate(name: string): Promise<string>;
	loadReference(skill: string, path: string): Promise<string>;
}

/** Storage backend for session persistence */
export interface SessionStore {
	save(sessionId: string, data: unknown): Promise<void>;
	load(sessionId: string): Promise<unknown | null>;
}

/** Approval callback for human-in-the-loop */
export type ApprovalCallback = (call: ToolCall) => Promise<boolean>;

/** Stream callback for real-time output to user */
export type StreamCallback = (chunk: StreamChunk) => void;

/** Agent loop configuration */
export interface AgentConfig {
	provider: Provider;
	toolExecutor: ToolExecutor;
	skillLoader: SkillLoader;
	sessionStore?: SessionStore;
	modelConfig: ModelConfig;
	onStream: StreamCallback;
	onApproval?: ApprovalCallback;
	maxTurns?: number;
	projectIdentity?: string;
	tools?: unknown[];
}
