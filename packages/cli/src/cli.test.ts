import { describe, it, expect } from "vitest";
import type { LogEntry, LogEntryType, ToolCallStatus, DisplayToolCall } from "./types.ts";
import type { AgentStatus, SessionSnapshot } from "./protocol.ts";

// ── Input history logic (mirrors useInputHistory) ──────
describe("input history logic", () => {
	function createHistory() {
		const entries: string[] = [];
		let cursor = -1;

		return {
			push(input: string) {
				if (!input.trim()) return;
				entries.push(input);
				cursor = -1;
			},
			up(): string | undefined {
				if (entries.length === 0) return undefined;
				const next = cursor === -1 ? entries.length - 1 : Math.max(0, cursor - 1);
				cursor = next;
				return entries[next];
			},
			down(): string | undefined {
				if (cursor === -1) return undefined;
				const next = cursor + 1;
				if (next >= entries.length) {
					cursor = -1;
					return "";
				}
				cursor = next;
				return entries[next];
			},
			reset() {
				cursor = -1;
			},
		};
	}

	it("push and navigate up/down", () => {
		const h = createHistory();
		h.push("first");
		h.push("second");
		h.push("third");

		expect(h.up()).toBe("third");
		expect(h.up()).toBe("second");
		expect(h.up()).toBe("first");
		expect(h.up()).toBe("first"); // Stays at start

		expect(h.down()).toBe("second");
		expect(h.down()).toBe("third");
		expect(h.down()).toBe(""); // Past end resets

		h.reset();
		expect(h.down()).toBeUndefined();
	});

	it("ignores empty input", () => {
		const h = createHistory();
		h.push("");
		h.push("   ");
		expect(h.up()).toBeUndefined();
	});

	it("navigates up from empty state returns undefined", () => {
		const h = createHistory();
		expect(h.up()).toBeUndefined();
		expect(h.down()).toBeUndefined();
	});
});

// ── Type validation ────────────────────────────────────
describe("type contracts", () => {
	it("LogEntry types are valid", () => {
		const userEntry: LogEntry = { id: "1", type: "user", content: "hello", timestamp: Date.now() };
		expect(userEntry.type).toBe("user");

		const assistantEntry: LogEntry = { id: "2", type: "assistant", content: "hi", timestamp: Date.now() };
		expect(assistantEntry.type).toBe("assistant");

		const toolCall: DisplayToolCall = {
			id: "tc1",
			name: "read_file",
			args: '{"path":"/tmp"}',
			status: "done",
			elapsed: 1.5,
			result: "file contents",
		};
		const toolEntry: LogEntry = { id: "3", type: "tool-call", timestamp: Date.now(), toolCall };
		expect(toolEntry.toolCall?.status).toBe("done");

		const metricsEntry: LogEntry = {
			id: "4",
			type: "turn-metrics",
			timestamp: Date.now(),
			metrics: { elapsed: "2.1", tokensIn: 500, tokensOut: 200, costCents: 0.05, turn: 1 },
		};
		expect(metricsEntry.metrics?.elapsed).toBe("2.1");
	});

	it("AgentStatus values are valid", () => {
		const statuses: AgentStatus[] = ["idle", "thinking", "streaming", "tool-calling", "awaiting-approval"];
		expect(statuses).toHaveLength(5);
	});

	it("SessionSnapshot has correct shape", () => {
		const snapshot: SessionSnapshot = {
			id: "abc-123",
			model: "claude-sonnet-4",
			tokensIn: 1000,
			tokensOut: 500,
			costCents: 0.25,
			turns: 3,
			messageCount: 10,
		};
		expect(snapshot.turns).toBe(3);
	});
});

// ── JSON tool-call filter (from use-agent.ts) ──────────
describe("isRawToolCallJson filter", () => {
	const JSON_TOOL_PATTERNS = [
		/^\s*\{[\s]*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:/,
		/^\s*\{[\s]*"tool_name"\s*:/,
		/^\s*\{[\s]*"type"\s*:\s*"function"\s*,/,
		/^\s*```json\s*\n?\s*\{[\s]*"name"\s*:/,
	];

	function isRawToolCallJson(text: string): boolean {
		return JSON_TOOL_PATTERNS.some((re) => re.test(text));
	}

	function looksLikePartialToolCallJson(text: string): boolean {
		const trimmed = text.trimStart();
		if (isRawToolCallJson(text)) return true;
		if (trimmed.length < 300 && /^\{\s*"/.test(trimmed)) return true;
		if (trimmed.length < 300 && /^```(?:json)?[\s\n]*\{?\s*"?/.test(trimmed)) return true;
		return false;
	}

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

	it("detects raw JSON tool calls", () => {
		expect(isRawToolCallJson('{"name": "read_file", "arguments": {"path": "/tmp"}}')).toBe(true);
		expect(isRawToolCallJson('{"tool_name": "exec"}')).toBe(true);
		expect(isRawToolCallJson('{"type": "function", "name": "test"}')).toBe(true);
		expect(isRawToolCallJson('```json\n{"name": "read"}')).toBe(true);
	});

	it("passes normal text through", () => {
		expect(isRawToolCallJson("Hello, how can I help?")).toBe(false);
		expect(isRawToolCallJson("Here's some code: const x = 1")).toBe(false);
		expect(isRawToolCallJson("")).toBe(false);
	});

	it("detects partial JSON building up (chunks from streaming)", () => {
		// First few chunks from a model emitting a tool call as text
		expect(looksLikePartialToolCallJson('{')).toBe(false); // Needs {"
		expect(looksLikePartialToolCallJson('{"')).toBe(true);
		expect(looksLikePartialToolCallJson('{"name')).toBe(true);
		expect(looksLikePartialToolCallJson('{"name": "exec"')).toBe(true);
		// Normal text should pass
		expect(looksLikePartialToolCallJson("Hello world")).toBe(false);
		// Long JSON-like text beyond threshold should pass
		expect(looksLikePartialToolCallJson(`{"data": "${"x".repeat(300)}"}`)).toBe(false);
	});

	it("isJsonToolCallObject catches JSON that regex missed", () => {
		expect(isJsonToolCallObject('{"name": "exec", "arguments": {"cmd": "ls"}}')).toBe(true);
		expect(isJsonToolCallObject('{"tool_name": "read", "input": {}}')).toBe(true);
		// Not a tool call
		expect(isJsonToolCallObject('{"foo": "bar"}')).toBe(false);
		// Not valid JSON
		expect(isJsonToolCallObject('{name: exec}')).toBe(false);
		// Not an object
		expect(isJsonToolCallObject("hello")).toBe(false);
	});
});
