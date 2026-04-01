import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { Message, Session } from "@construye/shared";
import type { SessionStore } from "./types.ts";

const SESSIONS_DIR = path.join(os.homedir(), ".construye", "sessions");

/** File-based session store — persists to ~/.construye/sessions/ */
export class FileSessionStore implements SessionStore {
	private dir: string;

	constructor(dir?: string) {
		this.dir = dir ?? SESSIONS_DIR;
	}

	private sessionDir(sessionId: string): string {
		// Sanitize sessionId to prevent path traversal
		const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
		return path.join(this.dir, safe);
	}

	async save(sessionId: string, data: unknown): Promise<void> {
		const dir = this.sessionDir(sessionId);
		await fsp.mkdir(dir, { recursive: true });

		const payload = data as { session?: Session; messages?: Message[] };

		if (payload.session) {
			await fsp.writeFile(
				path.join(dir, "meta.json"),
				JSON.stringify(payload.session, null, 2),
			);
		}

		if (payload.messages) {
			// Append-only JSONL for messages (overwrite for simplicity in v1)
			const lines = payload.messages.map((m) => JSON.stringify(m)).join("\n");
			await fsp.writeFile(path.join(dir, "messages.jsonl"), lines + "\n");
		}
	}

	async load(sessionId: string): Promise<{ session: Session; messages: Message[] } | null> {
		const dir = this.sessionDir(sessionId);
		try {
			const metaRaw = await fsp.readFile(path.join(dir, "meta.json"), "utf-8");
			const session = JSON.parse(metaRaw) as Session;

			let messages: Message[] = [];
			try {
				const msgRaw = await fsp.readFile(path.join(dir, "messages.jsonl"), "utf-8");
				messages = msgRaw
					.split("\n")
					.filter((line) => line.trim())
					.map((line) => JSON.parse(line) as Message);
			} catch {
				// No messages file yet
			}

			return { session, messages };
		} catch {
			return null;
		}
	}

	/** List recent sessions sorted by most recent */
	async listRecent(limit = 10): Promise<Array<{ id: string; session: Session }>> {
		try {
			const entries = await fsp.readdir(this.dir, { withFileTypes: true });
			const sessions: Array<{ id: string; session: Session; time: number }> = [];

			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				try {
					const metaPath = path.join(this.dir, entry.name, "meta.json");
					const raw = await fsp.readFile(metaPath, "utf-8");
					const session = JSON.parse(raw) as Session;
					const time = new Date(session.ended_at ?? session.started_at).getTime();
					sessions.push({ id: entry.name, session, time });
				} catch {
					// Corrupt/missing meta — skip
				}
			}

			sessions.sort((a, b) => b.time - a.time);
			return sessions.slice(0, limit).map(({ id, session }) => ({ id, session }));
		} catch {
			return [];
		}
	}

	/** Delete a session from disk */
	async delete(sessionId: string): Promise<void> {
		const dir = this.sessionDir(sessionId);
		await fsp.rm(dir, { recursive: true, force: true });
	}
}
