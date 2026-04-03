import { describe, it, expect, vi } from "vitest";
import { D1Database } from "./database.ts";
import { R2FileStore } from "./file-store.ts";
import { KVCache } from "./cache.ts";
import { VectorizeStore } from "./vector-store.ts";
import { CFQueue } from "./queue.ts";

// --- D1Database Tests ---

describe("D1Database", () => {
	function createMockDb(returnRows: unknown[] = []) {
		return {
			prepare: vi.fn((_sql: string) => {
				const stmt = {
					bind: vi.fn((..._params: unknown[]) => stmt),
					all: vi.fn(async () => ({ results: returnRows })),
				};
				return stmt;
			}),
		};
	}

	it("getSession returns null for missing session", async () => {
		const mock = createMockDb([]);
		const db = new D1Database(mock as never);
		const result = await db.getSession("nonexistent");
		expect(result).toBeNull();
		expect(mock.prepare).toHaveBeenCalledWith(
			"SELECT * FROM sessions WHERE id = ?",
		);
	});

	it("getSession returns session when found", async () => {
		const session = { id: "s1", user_id: "u1", status: "active" };
		const mock = createMockDb([session]);
		const db = new D1Database(mock as never);
		const result = await db.getSession("s1");
		expect(result).toEqual(session);
	});

	it("saveSession calls prepare with INSERT OR REPLACE", async () => {
		const mock = createMockDb();
		const db = new D1Database(mock as never);
		const session = {
			id: "s1",
			project_id: "p1",
			user_id: "u1",
			status: "active" as const,
			mode: "interactive" as const,
			model: "@cf/moonshot/kimi-k2.5",
			total_tokens: 100,
			total_cost_cents: 5,
			started_at: "2025-01-01T00:00:00Z",
			ended_at: undefined,
		};
		await db.saveSession(session);
		const sql = mock.prepare.mock.calls[0][0] as string;
		expect(sql).toContain("INSERT OR REPLACE INTO sessions");
	});

	it("getProject returns null for missing project", async () => {
		const mock = createMockDb([]);
		const db = new D1Database(mock as never);
		const result = await db.getProject("nonexistent");
		expect(result).toBeNull();
	});

	it("query returns results array", async () => {
		const rows = [{ count: 42 }];
		const mock = createMockDb(rows);
		const db = new D1Database(mock as never);
		const result = await db.query("SELECT COUNT(*) as count FROM sessions", []);
		expect(result).toEqual(rows);
		expect(mock.prepare).toHaveBeenCalledWith("SELECT COUNT(*) as count FROM sessions");
	});
});

// --- R2FileStore Tests ---

describe("R2FileStore", () => {
	function createMockBucket() {
		const storage = new Map<string, Uint8Array>();
		return {
			get: vi.fn(async (key: string) => {
				const data = storage.get(key);
				if (!data) return null;
				return { arrayBuffer: async () => data.buffer };
			}),
			put: vi.fn(async (key: string, data: Uint8Array) => {
				storage.set(key, data);
			}),
			delete: vi.fn(async (key: string) => {
				storage.delete(key);
			}),
			head: vi.fn(async (key: string) => {
				return storage.has(key) ? {} : null;
			}),
			list: vi.fn(async (opts: { prefix: string }) => {
				const objects = Array.from(storage.keys())
					.filter((k) => k.startsWith(opts.prefix))
					.map((key) => ({ key }));
				return { objects };
			}),
			_storage: storage,
		};
	}

	it("write and read a file", async () => {
		const mock = createMockBucket();
		const store = new R2FileStore(mock as never);
		const data = new TextEncoder().encode("hello world");
		await store.write("test.txt", data);
		const result = await store.read("test.txt");
		expect(result).not.toBeNull();
		expect(new TextDecoder().decode(result!)).toBe("hello world");
	});

	it("read returns null for missing key", async () => {
		const mock = createMockBucket();
		const store = new R2FileStore(mock as never);
		const result = await store.read("missing.txt");
		expect(result).toBeNull();
	});

	it("delete removes a file", async () => {
		const mock = createMockBucket();
		const store = new R2FileStore(mock as never);
		const data = new TextEncoder().encode("to delete");
		await store.write("del.txt", data);
		await store.delete("del.txt");
		expect(mock.delete).toHaveBeenCalledWith("del.txt");
	});

	it("exists returns true for existing key", async () => {
		const mock = createMockBucket();
		const store = new R2FileStore(mock as never);
		const data = new TextEncoder().encode("exists");
		await store.write("e.txt", data);
		const exists = await store.exists("e.txt");
		expect(exists).toBe(true);
	});

	it("exists returns false for missing key", async () => {
		const mock = createMockBucket();
		const store = new R2FileStore(mock as never);
		const exists = await store.exists("nope.txt");
		expect(exists).toBe(false);
	});

	it("list returns keys with prefix", async () => {
		const mock = createMockBucket();
		const store = new R2FileStore(mock as never);
		await store.write("proj/a.txt", new Uint8Array([1]));
		await store.write("proj/b.txt", new Uint8Array([2]));
		await store.write("other/c.txt", new Uint8Array([3]));
		const keys = await store.list("proj/");
		expect(keys).toEqual(["proj/a.txt", "proj/b.txt"]);
	});
});

// --- KVCache Tests ---

describe("KVCache", () => {
	function createMockKV() {
		const storage = new Map<string, string>();
		return {
			get: vi.fn(async (key: string, _type: string) => {
				const val = storage.get(key);
				return val ? JSON.parse(val) : null;
			}),
			put: vi.fn(async (key: string, value: string) => {
				storage.set(key, value);
			}),
			delete: vi.fn(async (key: string) => {
				storage.delete(key);
			}),
			_storage: storage,
		};
	}

	it("set and get a value", async () => {
		const mock = createMockKV();
		const cache = new KVCache(mock as never);
		await cache.set("key1", { hello: "world" });
		const result = await cache.get<{ hello: string }>("key1");
		expect(result).toEqual({ hello: "world" });
	});

	it("get returns null for missing key", async () => {
		const mock = createMockKV();
		const cache = new KVCache(mock as never);
		const result = await cache.get("missing");
		expect(result).toBeNull();
	});

	it("uses prefix for keys", async () => {
		const mock = createMockKV();
		const cache = new KVCache(mock as never, "test:");
		await cache.set("k", "v");
		expect(mock.put).toHaveBeenCalledWith("test:k", '"v"', {});
	});

	it("delete removes a key", async () => {
		const mock = createMockKV();
		const cache = new KVCache(mock as never);
		await cache.set("del", "val");
		await cache.delete("del");
		expect(mock.delete).toHaveBeenCalledWith("cache:del");
	});
});

// --- VectorizeStore Tests ---

describe("VectorizeStore", () => {
	function createMockIndex() {
		const vectors: { id: string; values: number[]; metadata?: Record<string, string> }[] = [];
		return {
			upsert: vi.fn(async (batch: typeof vectors) => {
				vectors.push(...batch);
			}),
			query: vi.fn(async (_vector: number[], opts: { topK: number }) => {
				return {
					matches: vectors.slice(0, opts.topK).map((v) => ({
						id: v.id,
						score: 0.95,
						metadata: v.metadata,
					})),
				};
			}),
			deleteByMetadata: vi.fn(async () => {}),
			_vectors: vectors,
		};
	}

	it("upsert and query vectors", async () => {
		const mock = createMockIndex();
		const store = new VectorizeStore(mock as never);
		await store.upsert("doc1", [0.1, 0.2, 0.3], { source: "test" });
		const matches = await store.query([0.1, 0.2, 0.3], 5);
		expect(matches.length).toBe(1);
		expect(matches[0].id).toBe("doc1");
		expect(matches[0].score).toBe(0.95);
	});

	it("deleteByFilter calls index", async () => {
		const mock = createMockIndex();
		const store = new VectorizeStore(mock as never);
		await store.deleteByFilter({ source: "test" });
		expect(mock.deleteByMetadata).toHaveBeenCalledWith({ source: "test" });
	});
});

// --- CFQueue Tests ---

describe("CFQueue", () => {
	function createMockQueue() {
		const messages: unknown[] = [];
		return {
			send: vi.fn(async (msg: unknown) => {
				messages.push(msg);
			}),
			sendBatch: vi.fn(async (batch: { body: unknown }[]) => {
				messages.push(...batch.map((b) => b.body));
			}),
			_messages: messages,
		};
	}

	it("send single message", async () => {
		const mock = createMockQueue();
		const queue = new CFQueue(mock as never);
		await queue.send({ task: "build" });
		expect(mock.send).toHaveBeenCalledWith({ task: "build" });
	});

	it("sendBatch multiple messages", async () => {
		const mock = createMockQueue();
		const queue = new CFQueue(mock as never);
		await queue.sendBatch([{ a: 1 }, { a: 2 }]);
		expect(mock.sendBatch).toHaveBeenCalledWith([{ body: { a: 1 } }, { body: { a: 2 } }]);
	});
});
