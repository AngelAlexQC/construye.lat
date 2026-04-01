import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, Static, useApp, useInput } from "ink";
import { createSession } from "@construye/core";
import type { FileSessionStore } from "@construye/core";
import type { Session } from "@construye/shared";
import { useAgent, type AgentSetup } from "./hooks/use-agent.ts";
import { useInputHistory } from "./hooks/use-input-history.ts";
import { LogEntryView } from "./components/log-entry.tsx";
import { InputArea } from "./components/input-area.tsx";
import { StatusBar } from "./components/status-bar.tsx";
import { renderMarkdown } from "./render.ts";
import type { CliConfig, LogEntry } from "./types.ts";
import type { AgentStatus } from "./protocol.ts";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface AppProps {
	setup: AgentSetup;
	config: CliConfig;
	providerName: string;
	modelName: string;
	sessionStore: FileSessionStore;
	initialSession: Session;
}

export function App({
	setup,
	config,
	providerName,
	modelName,
	sessionStore,
	initialSession,
}: AppProps): React.JSX.Element {
	const { exit } = useApp();
	const agent = useAgent(setup);
	const inputHistory = useInputHistory();
	const [session, setSession] = useState(initialSession);

	// Spinner animation for thinking/tool-calling states
	const [frame, setFrame] = useState(0);
	useEffect(() => {
		if (agent.status === "thinking" || agent.status === "tool-calling") {
			const timer = setInterval(() => setFrame((f) => f + 1), 80);
			return () => clearInterval(timer);
		}
	}, [agent.status]);

	// Auto-save when a turn completes (status goes from busy → idle)
	const prevStatusRef = useRef<AgentStatus>("idle");
	useEffect(() => {
		if (prevStatusRef.current !== "idle" && agent.status === "idle" && agent.log.length > 0) {
			sessionStore.save(session.id, { session, messages: agent.getHistory() }).catch(() => {});
		}
		prevStatusRef.current = agent.status;
	}, [agent.status, session, sessionStore, agent]);

	// Ctrl+C to exit
	useInput((input, key) => {
		if (key.ctrl && input === "c") exit();
	});

	const handleSubmit = useCallback(
		async (text: string) => {
			inputHistory.push(text);

			// ── Slash commands ──
			if (text === "/clear") {
				agent.clearSession();
				setSession(createSession("local", "cli-user", modelName));
				agent.addEntry("system", "Sesión limpiada.");
				return;
			}
			if (text === "/usage") {
				const { stats } = agent;
				agent.addEntry(
					"system",
					`Tokens: ${stats.tokensIn} in / ${stats.tokensOut} out · Costo: $${(stats.costCents / 100).toFixed(4)} · Turnos: ${stats.turns}`,
				);
				return;
			}
			if (text === "/sessions") {
				try {
					const recent = await sessionStore.listRecent(5);
					if (recent.length === 0) {
						agent.addEntry("system", "No hay sesiones guardadas.");
					} else {
						const lines = recent.map((r) => `  ${r.id.slice(0, 8)}  ${r.session.started_at ?? ""}`);
						agent.addEntry("system", `Sesiones recientes:\n${lines.join("\n")}`);
					}
				} catch {
					agent.addEntry("system", "Error al listar sesiones.");
				}
				return;
			}
			if (text.startsWith("/resume")) {
				const prefix = text.split(" ")[1]?.trim();
				try {
					const recent = await sessionStore.listRecent(20);
					const match = prefix ? recent.find((r) => r.id.startsWith(prefix)) : recent[0];
					if (match) {
						const loaded = await sessionStore.load(match.id);
						if (loaded) {
							setSession(loaded.session);
							agent.loadHistory(loaded.messages);
							agent.addEntry("system", `Sesión ${match.id.slice(0, 8)} reanudada (${loaded.messages.length} mensajes)`);
						}
					} else {
						agent.addEntry("system", prefix ? `No hay sesión con prefijo '${prefix}'` : "No hay sesiones para reanudar.");
					}
				} catch {
					agent.addEntry("system", "Error al reanudar sesión.");
				}
				return;
			}
			if (text === "/help") {
				agent.addEntry(
					"system",
					"/clear    Limpiar sesión\n/usage    Ver uso de tokens\n/sessions Listar sesiones\n/resume   Reanudar sesión\n/exit     Salir",
				);
				return;
			}
			if (text === "/exit" || text === "/quit") {
				exit();
				return;
			}
			if (text.startsWith("/")) {
				agent.addEntry("system", `Comando desconocido: ${text}. Escribe /help`);
				return;
			}

			agent.sendMessage(text);
		},
		[agent, inputHistory, modelName, exit, sessionStore],
	);

	const showSpinner = (agent.status === "thinking" || agent.status === "tool-calling") && !agent.liveText;

	return (
		<Box flexDirection="column">
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color="cyan">{"construye "}</Text>
				<Text dimColor>{`v0.2.0 · ${modelName} · ${session.id.slice(0, 8)}`}</Text>
			</Box>

			{/* Completed entries — Static renders once, never re-renders */}
			<Static items={agent.log}>
				{(entry: LogEntry) => <LogEntryView key={entry.id} entry={entry} />}
			</Static>

			{/* Live streaming text */}
			{agent.liveText ? (
				<Box marginLeft={2} flexDirection="column">
					<Text>{renderMarkdown(agent.liveText)}</Text>
				</Box>
			) : null}

			{/* Thinking/working spinner */}
			{showSpinner ? (
				<Box marginLeft={2}>
					<Text color="cyan">{`${SPINNER[frame % SPINNER.length]} `}</Text>
					<Text dimColor>{agent.status === "thinking" ? "Pensando..." : "Ejecutando..."}</Text>
				</Box>
			) : null}

			{/* Status bar */}
			<StatusBar
				model={modelName}
				provider={providerName}
				sessionId={session.id}
				tokensIn={agent.stats.tokensIn}
				tokensOut={agent.stats.tokensOut}
				costCents={agent.stats.costCents}
				turns={agent.stats.turns}
				status={agent.status}
			/>

			{/* Input area */}
			<InputArea
				onSubmit={handleSubmit}
				onApproval={agent.pendingApproval ? agent.respondToApproval : undefined}
				status={agent.status}
				pendingToolName={agent.pendingApproval?.call.name}
				onHistoryUp={inputHistory.up}
				onHistoryDown={inputHistory.down}
				onHistoryReset={inputHistory.reset}
			/>
		</Box>
	);
}
