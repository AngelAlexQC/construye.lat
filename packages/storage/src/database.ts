import type { Database } from "./types.ts";
import type { Session, Project } from "@construye/shared";

/**
 * D1-backed SQL database for sessions, projects, and usage data.
 * D1 = SQLite at the edge on Cloudflare.
 */
export class D1Database implements Database {
	private db: D1DatabaseBinding;

	constructor(db: D1DatabaseBinding) {
		this.db = db;
	}

	async getSession(id: string): Promise<Session | null> {
		const rows = await this.query<Session>(
			"SELECT * FROM sessions WHERE id = ?",
			[id],
		);
		return rows[0] ?? null;
	}

	async saveSession(session: Session): Promise<void> {
		await this.query(
			`INSERT OR REPLACE INTO sessions
			 (id, project_id, user_id, status, mode, model, total_tokens, total_cost_cents, started_at, ended_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				session.id, session.project_id, session.user_id,
				session.status, session.mode, session.model,
				session.total_tokens, session.total_cost_cents,
				session.started_at, session.ended_at ?? null,
			],
		);
	}

	async getProject(id: string): Promise<Project | null> {
		const rows = await this.query<Project>(
			"SELECT * FROM projects WHERE id = ?",
			[id],
		);
		return rows[0] ?? null;
	}

	async saveProject(project: Project): Promise<void> {
		await this.query(
			`INSERT OR REPLACE INTO projects (id, user_id, name, repo_url, r2_prefix, config)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[
				project.id, project.user_id, project.name,
				project.repo_url ?? null, project.r2_prefix,
				JSON.stringify(project.config),
			],
		);
	}

	async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
		const stmt = this.db.prepare(sql).bind(...params);
		const result = await stmt.all<T>();
		return result.results ?? [];
	}
}

// Cloudflare D1 binding type (minimal)
interface D1DatabaseBinding {
	prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
	bind(...params: unknown[]): D1PreparedStatement;
	all<T>(): Promise<{ results: T[] }>;
}
