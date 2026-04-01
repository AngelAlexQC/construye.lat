/** Agent operating modes */
export type AgentMode = "plan" | "interactive" | "auto";

/** Session status */
export type SessionStatus = "active" | "paused" | "completed";

/** Model task classification for smart routing */
export type TaskType = "reasoning" | "coding" | "file_ops" | "planning" | "embedding";

/** A session represents one agent conversation */
export interface Session {
	id: string;
	project_id: string;
	user_id: string;
	status: SessionStatus;
	mode: AgentMode;
	model: string;
	total_tokens: number;
	total_cost_cents: number;
	started_at: string;
	ended_at?: string;
}

/** Project metadata parsed from CONSTRUYE.md */
export interface Project {
	id: string;
	user_id: string;
	name: string;
	repo_url?: string;
	r2_prefix: string;
	vectorize_index?: string;
	config: ProjectConfig;
}

/** Parsed CONSTRUYE.md configuration */
export interface ProjectConfig {
	name: string;
	type: string;
	node?: string;
	package_manager?: string;
	conventions?: string[];
	architecture?: Record<string, string>;
	rules?: string[];
	skills?: string[];
}
