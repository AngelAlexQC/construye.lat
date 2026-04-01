import type { ExecutionLayer } from "@construye/shared";

/** Context provided to tool execution */
export interface ToolContext {
	workingDir: string;
	sessionId: string;
	projectId: string;
}

/** A tool handler implements one agent tool */
export interface ToolHandler {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	layer: ExecutionLayer;
	requiresApproval: boolean;
	execute(args: Record<string, unknown>, context: ToolContext): Promise<string>;
}
