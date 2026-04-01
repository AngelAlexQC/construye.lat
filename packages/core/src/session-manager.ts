import type { Session, SessionStatus } from "@construye/shared";
import type { SessionStore } from "./types.ts";

/** Create a new session */
export function createSession(
	projectId: string,
	userId: string,
	model: string,
): Session {
	return {
		id: crypto.randomUUID(),
		project_id: projectId,
		user_id: userId,
		status: "active",
		mode: "interactive",
		model,
		total_tokens: 0,
		total_cost_cents: 0,
		started_at: new Date().toISOString(),
	};
}

/** Update session stats after a turn */
export function updateSessionStats(
	session: Session,
	tokens: number,
	costCents: number,
): Session {
	return {
		...session,
		total_tokens: session.total_tokens + tokens,
		total_cost_cents: session.total_cost_cents + costCents,
	};
}

/** Mark session with new status */
export function setSessionStatus(
	session: Session,
	status: SessionStatus,
): Session {
	return {
		...session,
		status,
		ended_at: status === "completed" ? new Date().toISOString() : session.ended_at,
	};
}

/** Fork a session — creates new session from current state */
export function forkSession(session: Session): Session {
	return {
		...session,
		id: crypto.randomUUID(),
		status: "active",
		started_at: new Date().toISOString(),
		ended_at: undefined,
	};
}
