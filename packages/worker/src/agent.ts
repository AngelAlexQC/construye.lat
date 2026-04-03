import type { Env } from "./types.ts";
import type { Message, ToolCall } from "@construye/shared";

/**
 * Protocol messages exchanged over WebSocket between client and agent DO.
 */
interface ClientMessage {
	type: "message" | "cancel" | "ping";
	content?: string;
	sessionId?: string;
}

interface ServerMessage {
	type: "text" | "tool_call" | "tool_result" | "done" | "error" | "pong" | "status";
	content?: string;
	tool_call?: ToolCall;
	tool_call_id?: string;
	error?: string;
	usage?: { input_tokens: number; output_tokens: number; cost_cents: number };
}

const SYSTEM_PROMPT = `You are Construye, an expert AI coding agent built to help developers build, debug, and ship software. You run 100% on Cloudflare Workers.

CORE BEHAVIORS:
1. Think step by step. Break complex problems into clear sub-tasks before diving in.
2. Be concise but thorough — show results, not intentions.
3. When you encounter errors, analyze root cause and try a different approach.
4. For code generation, always use best practices: proper error handling, types, and tests.

LANGUAGE RULE: Detect the language of each user message and respond in EXACTLY that language. If the user writes in Spanish, respond entirely in Spanish. If in English, respond in English. Never mix languages.

CAPABILITIES:
- Full-stack code generation (TypeScript, Python, Go, Rust, etc.)
- Architecture design and review
- Bug diagnosis and debugging strategies
- Database schema design (SQL, D1, Prisma)
- API design (REST, GraphQL, tRPC)
- DevOps and deployment (Cloudflare Workers, Docker, CI/CD)
- Code review and refactoring
- Test writing (unit, integration, e2e)

RESPONSE FORMAT:
- Use markdown for structure (headers, code blocks, lists)
- Use code blocks with language tags for all code
- Keep explanations focused and actionable`;

/**
 * ConstruyeAgent Durable Object: maintains long-lived agent session state.
 * Each session gets its own DO instance with WebSocket hibernation support.
 */
export class ConstruyeAgent {
	private state: DurableObjectState;
	private env: Env;
	private sessions: Map<WebSocket, { sessionId: string; userId: string }> = new Map();
	private cancelled = false;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			return this.handleWebSocket(request, url);
		}

		if (url.pathname === "/status") {
			const history = await this.state.storage.get<Message[]>("history") ?? [];
			const sessionId = await this.state.storage.get<string>("sessionId");
			return new Response(JSON.stringify({
				sessionId,
				active: !!sessionId,
				messageCount: history.length,
			}), {
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response("Not found", { status: 404 });
	}

	private handleWebSocket(request: Request, url: URL): Response {
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		const sessionId = url.searchParams.get("sessionId") ?? "";
		const userId = url.searchParams.get("userId") ?? "";

		this.state.acceptWebSocket(server);
		this.sessions.set(server, { sessionId, userId });
		this.state.storage.put("sessionId", sessionId);

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const text = typeof message === "string" ? message : new TextDecoder().decode(message);

		let parsed: ClientMessage;
		try {
			parsed = JSON.parse(text) as ClientMessage;
		} catch {
			this.sendWs(ws, { type: "error", error: "Invalid JSON" });
			return;
		}

		if (parsed.type === "ping") {
			this.sendWs(ws, { type: "pong" });
			return;
		}

		if (parsed.type === "cancel") {
			this.cancelled = true;
			this.sendWs(ws, { type: "status", content: "cancelled" });
			return;
		}

		if (parsed.type === "message" && parsed.content) {
			await this.handleUserMessage(ws, parsed.content);
		}
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		this.sessions.delete(ws);
	}

	async webSocketError(ws: WebSocket): Promise<void> {
		this.sessions.delete(ws);
	}

	private async handleUserMessage(ws: WebSocket, content: string): Promise<void> {
		this.cancelled = false;
		const history = await this.state.storage.get<Message[]>("history") ?? [];
		history.push({ role: "user", content });

		try {
			this.sendWs(ws, { type: "status", content: "thinking" });

			const messages = [
				{ role: "system" as const, content: SYSTEM_PROMPT },
				...history.slice(-60).map((m) => ({ role: m.role, content: m.content })),
			];

			// Use Workers AI with streaming for fast first-token
			const response = await this.env.AI.run(
				"@cf/moonshot/kimi-k2.5" as Parameters<typeof this.env.AI.run>[0],
				{ messages, stream: true },
			);

			let fullText = "";

			if (response instanceof ReadableStream) {
				// SSE streaming response
				const reader = response.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (!this.cancelled) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
						try {
							const chunk = JSON.parse(line.slice(6)) as { response?: string };
							if (chunk.response) {
								fullText += chunk.response;
								this.sendWs(ws, { type: "text", content: chunk.response });
							}
						} catch {
							// skip malformed SSE chunks
						}
					}
				}

				if (this.cancelled) {
					reader.cancel();
					this.sendWs(ws, { type: "status", content: "cancelled" });
					return;
				}
			} else {
				// Non-streaming fallback
				const responseText = typeof response === "string"
					? response
					: (response as { response?: string }).response ?? "";
				fullText = responseText;
				this.sendWs(ws, { type: "text", content: responseText });
			}

			// Add to history
			if (fullText) {
				history.push({ role: "assistant", content: fullText });
			}

			// Persist history (keep last 100 messages)
			const trimmedHistory = history.slice(-100);
			await this.state.storage.put("history", trimmedHistory);

			// Update token usage in D1
			const meta = this.sessions.get(ws);
			if (meta) {
				const estimatedTokens = Math.ceil((content.length + fullText.length) / 4);
				await this.env.DB.prepare(
					"UPDATE sessions SET total_tokens = total_tokens + ? WHERE id = ?",
				).bind(estimatedTokens, meta.sessionId).run();
			}

			this.sendWs(ws, { type: "done" });
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			this.sendWs(ws, { type: "error", error: errorMsg });
		}
	}

	private sendWs(ws: WebSocket, msg: ServerMessage): void {
		try {
			ws.send(JSON.stringify(msg));
		} catch {
			// WebSocket may be closed
		}
	}
}
