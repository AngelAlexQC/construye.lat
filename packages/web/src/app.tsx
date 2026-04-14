import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	getLoginUrl,
	getStoredAuth,
	storeAuth,
	clearAuth,
	createSession,
	listSessions,
	deleteSession,
	connectWebSocket,
	type ServerMessage,
	type SessionInfo,
} from "./api.ts";

// --- Types ---

interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "tool" | "error" | "status";
	content: string;
	toolName?: string;
	timestamp: number;
}

// --- App ---

export function App(): React.JSX.Element {
	const [auth, setAuth] = useState(getStoredAuth());
	const [sessions, setSessions] = useState<SessionInfo[]>([]);
	const [activeSession, setActiveSession] = useState<string | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [wsConnected, setWsConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);

	// --- Check for OAuth callback params ---
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const token = params.get("token");
		const user = params.get("user");
		if (token && user) {
			storeAuth(token, user);
			setAuth({ token, user });
			window.history.replaceState({}, "", window.location.pathname);
		}
	}, []);

	// --- Load sessions on auth ---
	useEffect(() => {
		if (!auth) return;
		listSessions(auth.token).then(setSessions).catch(() => {});
	}, [auth]);

	// --- Auto-scroll ---
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// --- WebSocket message handler ---
	const handleWsMessage = useCallback((msg: ServerMessage) => {
		const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		switch (msg.type) {
			case "text":
				setMessages((prev) => {
					// Append to last assistant message if consecutive
					const last = prev[prev.length - 1];
					if (last?.role === "assistant" && msg.content) {
						return [
							...prev.slice(0, -1),
							{ ...last, content: last.content + msg.content },
						];
					}
					return [...prev, { id, role: "assistant", content: msg.content ?? "", timestamp: Date.now() }];
				});
				break;
			case "tool_call":
				setMessages((prev) => [
					...prev,
					{ id, role: "tool", content: `Llamando: ${msg.toolName}(${JSON.stringify(msg.toolArgs ?? {})})`, toolName: msg.toolName, timestamp: Date.now() },
				]);
				break;
			case "tool_result":
				setMessages((prev) => [
					...prev,
					{ id, role: "tool", content: msg.toolResult ?? "", toolName: msg.toolName, timestamp: Date.now() },
				]);
				break;
			case "done":
				setSending(false);
				break;
			case "error":
				setMessages((prev) => [
					...prev,
					{ id, role: "error", content: msg.error ?? "Error desconocido", timestamp: Date.now() },
				]);
				setSending(false);
				break;
			case "status":
				setMessages((prev) => [
					...prev,
					{ id, role: "status", content: msg.status ?? msg.content ?? "", timestamp: Date.now() },
				]);
				break;
		}
	}, []);

	// --- Connect WebSocket to session ---
	const connectToSession = useCallback(
		(sessionId: string) => {
			if (!auth) return;
			wsRef.current?.close();
			setMessages([]);
			setActiveSession(sessionId);

			const ws = connectWebSocket(
				sessionId,
				auth.token,
				handleWsMessage,
				() => setWsConnected(false),
				() => setWsConnected(false),
			);
			ws.onopen = () => setWsConnected(true);
			wsRef.current = ws;
		},
		[auth, handleWsMessage],
	);

	// --- New Session ---
	const handleNewSession = async () => {
		if (!auth) return;
		try {
			const id = await createSession(auth.token);
			const updated = await listSessions(auth.token);
			setSessions(updated);
			connectToSession(id);
		} catch (err) {
			console.error("Failed to create session:", err);
		}
	};

	// --- Send message ---
	const handleSend = () => {
		if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
		const id = `msg-${Date.now()}`;
		setMessages((prev) => [
			...prev,
			{ id, role: "user", content: input.trim(), timestamp: Date.now() },
		]);
		wsRef.current.send(JSON.stringify({ type: "message", content: input.trim() }));
		setInput("");
		setSending(true);
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	// --- Logout ---
	const handleLogout = () => {
		wsRef.current?.close();
		clearAuth();
		setAuth(null);
		setSessions([]);
		setActiveSession(null);
		setMessages([]);
	};

	// --- Login Screen ---
	if (!auth) {
		return (
			<div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
				<div className="text-center space-y-6 max-w-md mx-auto px-4">
					<div className="text-5xl">🏗️</div>
					<h1 className="text-3xl font-bold">construye.lat</h1>
					<p className="text-zinc-400">Agente de código IA que corre 100% en Cloudflare</p>
					<a
						href={getLoginUrl()}
						className="inline-flex items-center gap-2 bg-white text-black font-semibold px-6 py-3 rounded-lg hover:bg-zinc-200 transition-colors"
					>
						<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
						</svg>
						Iniciar sesión con GitHub
					</a>
				</div>
			</div>
		);
	}

	// --- Main App ---
	return (
		<div className="min-h-screen bg-zinc-950 text-white flex flex-col h-screen">
			{/* Header */}
			<header className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3 shrink-0">
				<h1 className="text-lg font-bold">🏗️ construye.lat</h1>
				<span className="text-zinc-500 text-sm">v0.2.0</span>
				<div className="ml-auto flex items-center gap-4">
					<span className={`text-xs ${wsConnected ? "text-green-400" : "text-zinc-500"}`}>
						{wsConnected ? "● Conectado" : "○ Desconectado"}
					</span>
					<span className="text-sm text-zinc-400">{auth.user}</span>
					<button
						onClick={handleLogout}
						className="text-xs text-zinc-500 hover:text-white transition-colors"
					>
						Salir
					</button>
				</div>
			</header>

			<div className="flex flex-1 overflow-hidden">
				{/* Sidebar */}
				<aside className="w-64 border-r border-zinc-800 flex flex-col shrink-0">
					<div className="p-3">
						<button
							onClick={handleNewSession}
							className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
						>
							+ Nueva sesión
						</button>
					</div>
					<div className="flex-1 overflow-y-auto">
						{sessions.map((s) => (
							<button
								key={s.id}
								onClick={() => connectToSession(s.id)}
								className={`w-full text-left px-3 py-2 text-sm border-b border-zinc-900 hover:bg-zinc-800/50 transition-colors ${
									activeSession === s.id ? "bg-zinc-800 text-white" : "text-zinc-400"
								}`}
							>
								<div className="truncate font-mono text-xs">{s.id.slice(0, 8)}...</div>
								<div className="text-xs text-zinc-500 mt-0.5">
									{new Date(s.started_at).toLocaleDateString("es")} · {s.total_tokens} tokens
								</div>
							</button>
						))}
						{sessions.length === 0 && (
							<div className="px-3 py-6 text-center text-zinc-600 text-sm">
								Sin sesiones aún
							</div>
						)}
					</div>
				</aside>

				{/* Chat Area */}
				<main className="flex-1 flex flex-col overflow-hidden">
					{activeSession ? (
						<>
							{/* Messages */}
							<div className="flex-1 overflow-y-auto p-4 space-y-3">
								{messages.length === 0 && (
									<div className="flex items-center justify-center h-full text-zinc-600">
										<div className="text-center">
											<p className="text-lg">¿Qué quieres construir?</p>
											<p className="text-sm mt-1">Escribe tu idea abajo</p>
										</div>
									</div>
								)}
								{messages.map((msg) => (
									<MessageBubble key={msg.id} message={msg} />
								))}
								{sending && (
									<div className="flex items-center gap-2 text-zinc-500 text-sm">
										<span className="animate-pulse">●</span> Pensando...
									</div>
								)}
								<div ref={messagesEndRef} />
							</div>

							{/* Input */}
							<div className="border-t border-zinc-800 p-4 shrink-0">
								<div className="flex gap-2 max-w-4xl mx-auto">
									<textarea
										ref={inputRef}
										value={input}
										onChange={(e) => setInput(e.target.value)}
										onKeyDown={handleKeyDown}
										placeholder="Describe lo que quieres construir..."
										className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
										rows={2}
										disabled={!wsConnected}
									/>
									<button
										onClick={handleSend}
										disabled={!input.trim() || !wsConnected || sending}
										className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 rounded-lg transition-colors font-medium text-sm self-end"
									>
										Enviar
									</button>
								</div>
							</div>
						</>
					) : (
						<div className="flex-1 flex items-center justify-center text-zinc-600">
							<div className="text-center">
								<p className="text-4xl mb-4">🏗️</p>
								<p className="text-lg">Selecciona o crea una sesión</p>
								<p className="text-sm mt-1 text-zinc-700">para empezar a construir</p>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}

// --- Message Bubble ---

function MessageBubble({ message }: { message: ChatMessage }): React.JSX.Element {
	const roleStyles: Record<string, string> = {
		user: "bg-cyan-900/30 border-cyan-800/40 ml-12",
		assistant: "bg-zinc-900 border-zinc-800 mr-12",
		tool: "bg-amber-900/20 border-amber-800/30 text-amber-200 text-xs font-mono",
		error: "bg-red-900/20 border-red-800/30 text-red-300",
		status: "bg-zinc-800/50 border-zinc-700/30 text-zinc-400 text-xs text-center",
	};

	const roleLabels: Record<string, string> = {
		user: "Tú",
		assistant: "Construye",
		tool: "Herramienta",
		error: "Error",
		status: "Estado",
	};

	return (
		<div className={`rounded-lg border px-4 py-3 ${roleStyles[message.role] ?? ""}`}>
			<div className="text-xs text-zinc-500 mb-1 flex items-center gap-2">
				<span className="font-medium">{roleLabels[message.role] ?? message.role}</span>
				{message.toolName && <span className="text-amber-400">{message.toolName}</span>}
			</div>
			<div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
		</div>
	);
}
