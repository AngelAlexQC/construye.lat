const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

// --- Auth ---

export function getLoginUrl(): string {
	const redirectUri = encodeURIComponent(window.location.origin);
	return `${API_BASE}/auth/github?redirect_uri=${redirectUri}`;
}

export function getStoredAuth(): { token: string; user: string } | null {
	const token = localStorage.getItem("construye_token");
	const user = localStorage.getItem("construye_user");
	if (!token || !user) return null;
	return { token, user };
}

export function storeAuth(token: string, user: string): void {
	localStorage.setItem("construye_token", token);
	localStorage.setItem("construye_user", user);
}

export function clearAuth(): void {
	localStorage.removeItem("construye_token");
	localStorage.removeItem("construye_user");
}

// --- Sessions ---

export interface SessionInfo {
	id: string;
	status: string;
	mode: string;
	model: string;
	total_tokens: number;
	started_at: string;
}

export async function createSession(token: string): Promise<string> {
	const res = await fetch(`${API_BASE}/api/sessions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
	});
	if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
	const data = (await res.json()) as { id: string };
	return data.id;
}

export async function listSessions(token: string): Promise<SessionInfo[]> {
	const res = await fetch(`${API_BASE}/api/sessions`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) return [];
	const data = (await res.json()) as { sessions: SessionInfo[] };
	return data.sessions;
}

export async function deleteSession(
	token: string,
	sessionId: string,
): Promise<void> {
	await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${token}` },
	});
}

// --- WebSocket ---

/** Server → client message types from Durable Object */
export interface ServerMessage {
	type: "text" | "tool_call" | "tool_result" | "done" | "error" | "pong" | "status";
	content?: string;
	toolName?: string;
	toolArgs?: Record<string, unknown>;
	toolResult?: string;
	error?: string;
	status?: string;
}

export function connectWebSocket(
	sessionId: string,
	token: string,
	onMessage: (msg: ServerMessage) => void,
	onClose?: () => void,
	onError?: (err: Event) => void,
): WebSocket {
	const wsUrl = API_BASE.replace("http", "ws");
	const ws = new WebSocket(`${wsUrl}/api/sessions/${sessionId}/ws?token=${token}`);

	ws.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data as string) as ServerMessage;
			onMessage(msg);
		} catch {
			// Ignore non-JSON messages
		}
	};

	ws.onclose = () => onClose?.();
	ws.onerror = (e) => onError?.(e);

	return ws;
}

// --- Usage ---

export interface UsageInfo {
	total_tokens: number;
	total_cost_cents: number;
	session_count: number;
}

export async function getUsage(token: string): Promise<UsageInfo> {
	const res = await fetch(`${API_BASE}/api/usage`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) return { total_tokens: 0, total_cost_cents: 0, session_count: 0 };
	return (await res.json()) as UsageInfo;
}
