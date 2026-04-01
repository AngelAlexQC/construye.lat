/** Conversation message roles */
export type Role = "system" | "user" | "assistant" | "tool";

/** A single message in the conversation */
export interface Message {
	role: Role;
	content: string;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
	name?: string;
}

/** A tool invocation from the LLM */
export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

/** Result of executing a tool */
export interface ToolResult {
	tool_call_id: string;
	content: string;
	is_error?: boolean;
}

/** Execution layer for tool routing */
export type ExecutionLayer = "dynamic_worker" | "sandbox" | "browser" | "none";

/** Tool definition registered in the tool registry */
export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	layer: ExecutionLayer;
	requires_approval?: boolean;
}

/** Stub for lazy loading — only name and description in context */
export interface ToolStub {
	name: string;
	description: string;
}
