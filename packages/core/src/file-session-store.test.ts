import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { FileSessionStore } from "./file-session-store.ts";

describe("FileSessionStore", () => {
	let tmpDir: string;
	let store: FileSessionStore;

	beforeEach(async () => {
		tmpDir = path.join(os.tmpdir(), `construye-test-${Date.now()}`);
		store = new FileSessionStore(tmpDir);
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	const mockSession = {
		id: "test-session-1",
		project_id: "proj-1",
		user_id: "user-1",
		status: "active" as const,
		mode: "interactive" as const,
		model: "@cf/moonshot/kimi-k2.5",
		total_tokens: 1000,
		total_cost_cents: 0,
		started_at: new Date().toISOString(),
	};

	const mockMessages = [
		{ role: "user" as const, content: "hello" },
		{ role: "assistant" as const, content: "hi there" },
	];

	it("saves and loads a session with messages", async () => {
		await store.save("test-session-1", { session: mockSession, messages: mockMessages });

		const loaded = await store.load("test-session-1");
		expect(loaded).not.toBeNull();
		expect(loaded!.session.id).toBe("test-session-1");
		expect(loaded!.messages).toHaveLength(2);
		expect(loaded!.messages[0].content).toBe("hello");
	});

	it("returns null for non-existent session", async () => {
		const loaded = await store.load("nonexistent");
		expect(loaded).toBeNull();
	});

	it("lists recent sessions sorted by time", async () => {
		const session1 = { ...mockSession, id: "s1", started_at: "2026-01-01T00:00:00Z" };
		const session2 = { ...mockSession, id: "s2", started_at: "2026-03-01T00:00:00Z" };

		await store.save("s1", { session: session1, messages: [] });
		await store.save("s2", { session: session2, messages: [] });

		const recent = await store.listRecent(10);
		expect(recent).toHaveLength(2);
		expect(recent[0].id).toBe("s2"); // most recent first
	});

	it("deletes a session", async () => {
		await store.save("to-delete", { session: mockSession, messages: mockMessages });
		await store.delete("to-delete");

		const loaded = await store.load("to-delete");
		expect(loaded).toBeNull();
	});

	it("sanitizes session IDs to prevent path traversal", async () => {
		// This should NOT create files outside tmpDir
		await store.save("../../../etc/evil", { session: mockSession, messages: [] });

		const loaded = await store.load("../../../etc/evil");
		expect(loaded).not.toBeNull();
		// Verify the actual path is sanitized
		const entries = await fs.readdir(tmpDir);
		expect(entries.every(e => !e.includes(".."))).toBe(true);
	});

	it("handles sessions with empty messages", async () => {
		await store.save("empty-msgs", { session: mockSession, messages: [] });
		const loaded = await store.load("empty-msgs");
		expect(loaded).not.toBeNull();
		expect(loaded!.messages).toHaveLength(0);
	});
});
