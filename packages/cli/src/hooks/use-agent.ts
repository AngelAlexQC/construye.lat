import { useState, useRef, useCallback } from "react";
import { runAgentLoop } from "@construye/core";
import type { StreamChunk, ToolCall, Message, ModelConfig } from "@construye/shared";
import type { AgentStatus } from "../protocol.ts";
import type { LogEntry, LogEntryType } from "../types.ts";

// ── JSON tool-call filter (smaller models emit raw JSON as text) ──
const JSON_TOOL_PATTERNS = [
	/^\s*\{[\s]*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:/,
	/^\s*\{[\s]*"tool_name"\s*:/,
	/^\s*\{[\s]*"type"\s*:\s*"function"\s*,/,
	/^\s*```json\s*\n?\s*\{[\s]*"name"\s*:/,
];

function isRawToolCallJson(text: string): boolean {
	return JSON_TOOL_PATTERNS.some((re) => re.test(text));
}

/** Detect partial JSON that is still building up and might become a tool-call */
function looksLikePartialToolCallJson(text: string): boolean {
	const trimmed = text.trimStart();
	if (isRawToolCallJson(text)) return true;
	// Short text starting with {" — could be a JSON tool call accumulating chunk by chunk
	if (trimmed.length < 300 && /^\{\s*"/.test(trimmed)) return true;
	// Code-fenced JSON block building up
	if (trimmed.length < 300 && /^```(?:json)?[\s\n]*\{?\s*"?/.test(trimmed)) return true;
	return false;
}

/** Last-resort check: try parsing complete JSON to detect tool calls the regex missed */
function isJsonToolCallObject(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
	try {
		const parsed = JSON.parse(trimmed);
		return parsed && typeof parsed === "object" && ("name" in parsed || "tool_name" in parsed);
	} catch {
		return false;
	}
}

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

export interface AgentSetup {
	provider: { stream(messages: Message[], config: ModelConfig, tools?: unknown[]): AsyncIterable<StreamChunk> };
	modelConfig: ModelConfig;
	tools: unknown[];
	toolExecutor: {
		execute(call: ToolCall): Promise<{ tool_call_id: string; content: string; is_error?: boolean }>;
		needsApproval(call: ToolCall): boolean;
	};
	skillLoader: {
		getStubs(): Array<{ name: string; description: string }>;
		activate(name: string): Promise<string>;
		loadReference(skill: string, path: string): Promise<string>;
	};
	projectIdentity?: string;
	mode: string;
}

export function useAgent(setup: AgentSetup) {
	const [log, setLog] = useState<LogEntry[]>([]);
	const [liveText, setLiveText] = useState("");
	const [status, setStatus] = useState<AgentStatus>("idle");
	const [pendingApproval, setPendingApproval] = useState<{
		call: ToolCall;
		resolve: (v: boolean) => void;
	} | null>(null);
	const [stats, setStats] = useState({ tokensIn: 0, tokensOut: 0, costCents: 0, turns: 0 });

	const historyRef = useRef<Message[]>([]);
	const liveTextRef = useRef("");
	const approvedToolsRef = useRef(new Set<string>());
	const turnCountRef = useRef(0);

	const addEntry = useCallback((type: LogEntryType, content?: string, extra?: Partial<LogEntry>) => {
		setLog((prev) => [...prev, { id: uid(), type, content, timestamp: Date.now(), ...extra }]);
	}, []);

	const flushLiveText = useCallback(() => {
		const text = liveTextRef.current;
		liveTextRef.current = "";
		setLiveText("");
		if (!text.trim()) return;
		// Suppress raw JSON tool calls (regex + JSON.parse fallback)
		if (isRawToolCallJson(text) || isJsonToolCallObject(text)) return;
		addEntry("assistant", text);
	}, [addEntry]);

	const sendMessage = useCallback(
		async (text: string) => {
			addEntry("user", text);
			setStatus("thinking");
			liveTextRef.current = "";
			setLiveText("");

			const turnStart = Date.now();

			const agentConfig = {
				provider: {
					chat: (messages: Message[], tools?: unknown[]) =>
						setup.provider.stream(messages, setup.modelConfig, tools),
				},
				toolExecutor: {
					async execute(call: ToolCall) {
						// Mark tool as running
						setLog((prev) =>
							prev.map((e) =>
								e.type === "tool-call" && e.toolCall?.id === call.id
									? { ...e, toolCall: { ...e.toolCall!, status: "running" as const } }
									: e,
							),
						);
						const t0 = Date.now();
						const result = await setup.toolExecutor.execute(call);
						const elapsed = (Date.now() - t0) / 1000;

						// Mark tool done/error with result
						setLog((prev) =>
							prev.map((e) =>
								e.type === "tool-call" && e.toolCall?.id === call.id
									? {
											...e,
											toolCall: {
												...e.toolCall!,
												status: result.is_error ? "error" as const : "done" as const,
												result:
													result.content.length > 200
														? `${result.content.slice(0, 197)}...`
														: result.content,
												elapsed,
											},
										}
									: e,
							),
						);
						return result;
					},
					needsApproval: setup.toolExecutor.needsApproval.bind(setup.toolExecutor),
				},
				skillLoader: setup.skillLoader,
				modelConfig: setup.modelConfig,
				onStream: (chunk: StreamChunk) => {
					if (chunk.type === "text" && chunk.content) {
						liveTextRef.current += chunk.content;
						// Suppress text that looks like a raw JSON tool call (or is still building up to one)
						if (looksLikePartialToolCallJson(liveTextRef.current)) return;
						setLiveText(liveTextRef.current);
						setStatus("streaming");
					}
					if (chunk.type === "tool_call" && chunk.tool_call) {
						flushLiveText();
						const tc = chunk.tool_call;
						setLog((prev) => [
							...prev,
							{
								id: uid(),
								type: "tool-call" as const,
								timestamp: Date.now(),
								toolCall: { id: tc.id, name: tc.name, args: JSON.stringify(tc.arguments), status: "pending" as const },
							},
						]);
						setStatus("tool-calling");
					}
					if (chunk.type === "done") {
						flushLiveText();
						if (chunk.usage) {
							turnCountRef.current += 1;
							setStats((prev) => ({
								tokensIn: prev.tokensIn + (chunk.usage?.input_tokens ?? 0),
								tokensOut: prev.tokensOut + (chunk.usage?.output_tokens ?? 0),
								costCents: prev.costCents + (chunk.usage?.cost_cents ?? 0),
								turns: turnCountRef.current,
							}));
						}
						setStatus("thinking"); // May loop for more tool calls
					}
				},
				onApproval: async (call: ToolCall): Promise<boolean> => {
					if (setup.mode === "auto") return true;
					if (approvedToolsRef.current.has(call.name)) return true;
					return new Promise((resolve) => {
						setPendingApproval({ call, resolve });
						setStatus("awaiting-approval");
					});
				},
				maxTurns: 15,
				tools: setup.tools,
				projectIdentity: setup.projectIdentity,
			};

			try {
				const result = await runAgentLoop(text, historyRef.current, agentConfig);
				historyRef.current = result;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				addEntry("system", `Error: ${msg}`);
			} finally {
				liveTextRef.current = "";
				setLiveText("");
				setStatus("idle");
			}
		},
		[setup, flushLiveText, addEntry],
	);

	const respondToApproval = useCallback(
		(approved: boolean, always?: boolean) => {
			if (!pendingApproval) return;
			if (always && approved) approvedToolsRef.current.add(pendingApproval.call.name);
			if (!approved) {
				setLog((prev) =>
					prev.map((e) =>
						e.type === "tool-call" && e.toolCall?.id === pendingApproval.call.id
							? { ...e, toolCall: { ...e.toolCall!, status: "denied" as const } }
							: e,
					),
				);
			}
			pendingApproval.resolve(approved);
			setPendingApproval(null);
		},
		[pendingApproval],
	);

	const clearSession = useCallback(() => {
		setLog([]);
		setLiveText("");
		liveTextRef.current = "";
		historyRef.current = [];
		approvedToolsRef.current.clear();
		turnCountRef.current = 0;
		setStats({ tokensIn: 0, tokensOut: 0, costCents: 0, turns: 0 });
	}, []);

	const loadHistory = useCallback(
		(messages: Message[]) => {
			historyRef.current = messages;
			const entries: LogEntry[] = messages
				.filter((m) => m.role === "user" || m.role === "assistant")
				.map((m) => ({
					id: uid(),
					type: (m.role === "user" ? "user" : "assistant") as LogEntryType,
					content: m.content,
					timestamp: Date.now(),
				}));
			setLog(entries);
		},
		[],
	);

	const getHistory = useCallback(() => historyRef.current, []);

	return {
		log, liveText, status, pendingApproval, stats,
		sendMessage, respondToApproval, clearSession, loadHistory, getHistory, addEntry,
	};
}
