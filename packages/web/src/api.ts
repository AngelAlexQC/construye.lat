import type { Message } from "@construye/shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export async function createSession(token: string): Promise<string> {
	const res = await fetch(`${API_BASE}/api/sessions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
	});
	const data = await res.json() as { id: string };
	return data.id;
}

export function connectWebSocket(
	sessionId: string,
	token: string,
	onMessage: (msg: Message) => void,
): WebSocket {
	const wsUrl = API_BASE.replace("http", "ws");
	const ws = new WebSocket(`${wsUrl}/api/sessions/${sessionId}/ws?token=${token}`);

	ws.onmessage = (event) => {
		const msg = JSON.parse(event.data) as Message;
		onMessage(msg);
	};

	return ws;
}
