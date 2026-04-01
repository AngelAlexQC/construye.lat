import type { Env } from "./types.ts";

/**
 * ConstruyeAgent Durable Object: maintains long-lived agent session state.
 * Each session gets its own DO instance with WebSocket support.
 *
 * Lifecycle:
 * 1. Client opens WebSocket → DO accepts
 * 2. Client sends messages → DO runs agent loop
 * 3. Agent streams responses back via WebSocket
 * 4. Session persists in DO storage + D1
 */
export class ConstruyeAgent {
	private state: DurableObjectState;
	private env: Env;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			return this.handleWebSocket(request);
		}

		if (url.pathname === "/status") {
			const sessionId = await this.state.storage.get<string>("sessionId");
			return new Response(JSON.stringify({ sessionId, active: !!sessionId }), {
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response("Not found", { status: 404 });
	}

	private handleWebSocket(request: Request): Response {
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		this.state.acceptWebSocket(server);

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const text = typeof message === "string" ? message : new TextDecoder().decode(message);
		// Future: parse message, run agent loop, stream back
		ws.send(JSON.stringify({ type: "ack", message: text }));
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		// Cleanup on disconnect
	}
}
