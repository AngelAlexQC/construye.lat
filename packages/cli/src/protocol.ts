/**
 * Session Protocol — Foundation for multi-device sync.
 * Every surface (CLI, web, mobile) speaks this protocol.
 * The Durable Object session engine broadcasts to all connected surfaces.
 */

import type { StreamChunk, ToolCall, ToolResult, TokenUsage } from "@construye/shared";

/** Messages FROM a surface TO the session engine */
export type ClientMessage =
	| { type: "user_message"; content: string }
	| { type: "tool_approval"; tool_call_id: string; approved: boolean }
	| { type: "abort" }
	| { type: "command"; name: string; args?: Record<string, unknown> };

/** Messages FROM the session engine TO all connected surfaces */
export type ServerMessage =
	| { type: "stream_chunk"; chunk: StreamChunk }
	| { type: "tool_call"; tool_call: ToolCall }
	| { type: "tool_result"; result: ToolResult }
	| { type: "turn_complete"; usage?: TokenUsage; elapsed: number }
	| { type: "agent_status"; status: AgentStatus }
	| { type: "error"; error: string }
	| { type: "session_state"; state: SessionSnapshot };

export type AgentStatus = "idle" | "thinking" | "streaming" | "tool-calling" | "awaiting-approval";

export interface SessionSnapshot {
	id: string;
	model: string;
	tokensIn: number;
	tokensOut: number;
	costCents: number;
	turns: number;
	messageCount: number;
}
