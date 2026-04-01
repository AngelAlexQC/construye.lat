import { describe, it, expect, vi, beforeEach } from "vitest";
import { htmlToText, truncateToTokenBudget } from "./tools/web-fetch.ts";
import { createDefaultRegistry } from "./index.ts";

// ─── htmlToText tests ─────────────────────────────────
describe("htmlToText", () => {
	it("strips simple HTML tags", () => {
		const result = htmlToText("<p>Hello <b>world</b></p>");
		expect(result).toContain("Hello");
		expect(result).toContain("**world**");
		expect(result).not.toContain("<p>");
		expect(result).not.toContain("<b>");
	});

	it("converts headers to markdown", () => {
		const result = htmlToText("<h1>Title</h1><h2>Subtitle</h2>");
		expect(result).toContain("# Title");
		expect(result).toContain("## Subtitle");
	});

	it("converts links to markdown", () => {
		const result = htmlToText('<a href="https://example.com">Click here</a>');
		expect(result).toContain("[Click here](https://example.com)");
	});

	it("removes script and style blocks", () => {
		const result = htmlToText(
			'<div>Content</div><script>alert("xss")</script><style>.foo{color:red}</style>',
		);
		expect(result).toContain("Content");
		expect(result).not.toContain("alert");
		expect(result).not.toContain("color:red");
	});

	it("decodes HTML entities", () => {
		const result = htmlToText("&amp; &lt; &gt; &quot; &#39;");
		expect(result).toBe('& < > " \'');
	});

	it("handles empty input", () => {
		expect(htmlToText("")).toBe("");
	});

	it("converts code blocks", () => {
		const result = htmlToText("<pre><code>const x = 1;</code></pre>");
		expect(result).toContain("```");
		expect(result).toContain("const x = 1;");
	});

	it("converts inline code", () => {
		const result = htmlToText("Use <code>npm install</code> to install");
		expect(result).toContain("`npm install`");
	});

	it("ignores javascript: href links", () => {
		const result = htmlToText('<a href="javascript:void(0)">Click</a>');
		expect(result).toContain("Click");
		expect(result).not.toContain("javascript:");
	});

	it("removes nav, footer, header blocks", () => {
		const result = htmlToText(
			"<nav>Navigation</nav><main>Content</main><footer>Footer</footer>",
		);
		expect(result).not.toContain("Navigation");
		expect(result).not.toContain("Footer");
		expect(result).toContain("Content");
	});
});

// ─── truncateToTokenBudget tests ──────────────────────
describe("truncateToTokenBudget", () => {
	it("returns text as-is when under budget", () => {
		const text = "Hello world";
		expect(truncateToTokenBudget(text, 1000)).toBe(text);
	});

	it("truncates text over budget", () => {
		const text = "a".repeat(50_000);
		const result = truncateToTokenBudget(text, 100);
		expect(result.length).toBeLessThan(text.length);
		expect(result).toContain("[truncated");
	});

	it("preserves text at exact budget", () => {
		const text = "a".repeat(400); // 100 tokens × 4 chars
		const result = truncateToTokenBudget(text, 100);
		expect(result).toBe(text);
	});
});

// ─── web_search tool tests ────────────────────────────
describe("web_search tool", () => {
	it("returns helpful message when no API keys set", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_search")!;
		expect(tool).toBeDefined();

		const saved = {
			SERPER_API_KEY: process.env.SERPER_API_KEY,
			BRAVE_API_KEY: process.env.BRAVE_API_KEY,
			TAVILY_API_KEY: process.env.TAVILY_API_KEY,
		};
		delete process.env.SERPER_API_KEY;
		delete process.env.BRAVE_API_KEY;
		delete process.env.TAVILY_API_KEY;

		const result = await tool.execute(
			{ query: "test" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("No search API key configured");
		expect(result).toContain("SERPER_API_KEY");
		expect(result).toContain("BRAVE_API_KEY");
		expect(result).toContain("TAVILY_API_KEY");

		// Restore
		for (const [k, v] of Object.entries(saved)) {
			if (v) process.env[k] = v;
		}
	});

	it("has correct parameter schema", () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_search")!;
		const params = tool.parameters as { properties: Record<string, unknown> };
		expect(params.properties).toHaveProperty("query");
		expect(params.properties).toHaveProperty("max_results");
		expect(params.properties).toHaveProperty("format");
		expect(params.properties).toHaveProperty("provider");
	});
});

// ─── web_fetch tool tests ─────────────────────────────
describe("web_fetch tool", () => {
	it("rejects invalid URLs", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_fetch")!;
		expect(tool).toBeDefined();

		const result = await tool.execute(
			{ url: "not-a-url" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("Invalid URL");
	});

	it("rejects non-http protocols", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_fetch")!;

		const result = await tool.execute(
			{ url: "file:///etc/passwd" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("Only HTTP/HTTPS");
	});

	it("rejects ftp protocol", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_fetch")!;

		const result = await tool.execute(
			{ url: "ftp://evil.com/file" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("Only HTTP/HTTPS");
	});

	it("has method parameter in schema", () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_fetch")!;
		const params = tool.parameters as { properties: Record<string, unknown> };
		expect(params.properties).toHaveProperty("method");
	});
});

// ─── browse tool tests ────────────────────────────────
describe("browse tool (updated)", () => {
	it("returns message for screenshot action", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("browse")!;
		expect(tool).toBeDefined();

		const result = await tool.execute(
			{ url: "https://example.com", action: "screenshot" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("Browser Rendering API");
	});
});

// ─── web_crawl tool tests ─────────────────────────────
describe("web_crawl tool", () => {
	it("requires Worker credentials", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_crawl")!;
		expect(tool).toBeDefined();

		const saved = {
			BROWSER_WORKER_URL: process.env.BROWSER_WORKER_URL,
			BROWSER_WORKER_KEY: process.env.BROWSER_WORKER_KEY,
		};
		delete process.env.BROWSER_WORKER_URL;
		delete process.env.BROWSER_WORKER_KEY;

		const result = await tool.execute(
			{ url: "https://example.com" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("BROWSER_WORKER_URL");
		expect(result).toContain("BROWSER_WORKER_KEY");

		for (const [k, v] of Object.entries(saved)) {
			if (v) process.env[k] = v;
		}
	});

	it("rejects invalid URLs", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_crawl")!;

		const result = await tool.execute(
			{ url: "not-a-url" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("Invalid URL");
	});

	it("rejects non-http protocols", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_crawl")!;

		const result = await tool.execute(
			{ url: "ftp://evil.com" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("Only HTTP/HTTPS");
	});

	it("has correct parameter schema", () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_crawl")!;
		const params = tool.parameters as { properties: Record<string, unknown> };
		expect(params.properties).toHaveProperty("url");
		expect(params.properties).toHaveProperty("limit");
	});
});

// ─── web_extract tool tests ───────────────────────────
describe("web_extract tool", () => {
	it("requires Worker credentials", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_extract")!;
		expect(tool).toBeDefined();

		const saved = {
			BROWSER_WORKER_URL: process.env.BROWSER_WORKER_URL,
			BROWSER_WORKER_KEY: process.env.BROWSER_WORKER_KEY,
		};
		delete process.env.BROWSER_WORKER_URL;
		delete process.env.BROWSER_WORKER_KEY;

		const result = await tool.execute(
			{ url: "https://example.com", prompt: "Extract title" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("BROWSER_WORKER_URL");
		expect(result).toContain("BROWSER_WORKER_KEY");

		for (const [k, v] of Object.entries(saved)) {
			if (v) process.env[k] = v;
		}
	});

	it("rejects invalid URLs", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_extract")!;

		const result = await tool.execute(
			{ url: "not-a-url", prompt: "Extract data" },
			{ workingDir: "/tmp", sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("Invalid URL");
	});

	it("has correct parameter schema", () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("web_extract")!;
		const params = tool.parameters as { properties: Record<string, unknown> };
		expect(params.properties).toHaveProperty("url");
		expect(params.properties).toHaveProperty("prompt");
		expect(params.properties).toHaveProperty("response_format");
	});
});

// ─── search_semantic tool tests ───────────────────────
describe("search_semantic (TF-IDF)", () => {
	it("returns results for matching query", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("search_semantic")!;
		expect(tool).toBeDefined();

		// Search within our own project — search for something specific
		const result = await tool.execute(
			{ query: "ToolRegistry register", max_results: 5 },
			{ workingDir: process.cwd(), sessionId: "test", projectId: "test" },
		);
		// Should find files and return numbered results
		expect(result).toMatch(/^\d+\.\s+\*\*/);
		expect(result).toContain("register");
	});

	it("returns no results for garbage query", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("search_semantic")!;

		const result = await tool.execute(
			{ query: "xyzzyfluxcapacitor999" },
			{ workingDir: process.cwd(), sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("No results");
	});

	it("limits results to max_results", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("search_semantic")!;

		const result = await tool.execute(
			{ query: "function", max_results: 3 },
			{ workingDir: process.cwd(), sessionId: "test", projectId: "test" },
		);
		// Count result entries (numbered 1., 2., 3.)
		const matches = result.match(/^\d+\./gm) ?? [];
		expect(matches.length).toBeLessThanOrEqual(3);
	});
});

// ─── project_detect tool tests ────────────────────────
describe("project_detect", () => {
	it("detects this project as a node/typescript monorepo", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("project_detect")!;
		expect(tool).toBeDefined();

		const result = await tool.execute(
			{ include_readme: false },
			{ workingDir: process.cwd(), sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("TypeScript");
		expect(result).toContain("monorepo");
		expect(result).toContain("pnpm");
	});

	it("includes README when requested", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("project_detect")!;

		const result = await tool.execute(
			{ include_readme: true },
			{ workingDir: process.cwd(), sessionId: "test", projectId: "test" },
		);
		expect(result).toContain("README");
	});
});

// ─── task_memory tool tests ───────────────────────────
describe("task_memory (scratchpad)", () => {
	it("writes and reads a note", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("task_memory")!;
		expect(tool).toBeDefined();

		const ctx = { workingDir: "/tmp", sessionId: "mem-test-1", projectId: "test" };

		const writeResult = await tool.execute(
			{ action: "write", key: "plan", content: "Step 1: Do the thing" },
			ctx,
		);
		expect(writeResult).toContain("Saved note");

		const readResult = await tool.execute(
			{ action: "read", key: "plan" },
			ctx,
		);
		expect(readResult).toBe("Step 1: Do the thing");
	});

	it("lists notes", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("task_memory")!;
		const ctx = { workingDir: "/tmp", sessionId: "mem-test-2", projectId: "test" };

		await tool.execute({ action: "write", key: "note1", content: "AAA" }, ctx);
		await tool.execute({ action: "write", key: "note2", content: "BBB" }, ctx);

		const list = await tool.execute({ action: "list" }, ctx);
		expect(list).toContain("note1");
		expect(list).toContain("note2");
	});

	it("deletes a note", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("task_memory")!;
		const ctx = { workingDir: "/tmp", sessionId: "mem-test-3", projectId: "test" };

		await tool.execute({ action: "write", key: "temp", content: "temporary" }, ctx);
		const delResult = await tool.execute({ action: "delete", key: "temp" }, ctx);
		expect(delResult).toContain("Deleted");

		const readResult = await tool.execute({ action: "read", key: "temp" }, ctx);
		expect(readResult).toContain("not found");
	});

	it("isolates notes between sessions", async () => {
		const registry = createDefaultRegistry();
		const tool = registry.get("task_memory")!;

		await tool.execute(
			{ action: "write", key: "secret", content: "session1-data" },
			{ workingDir: "/tmp", sessionId: "session-A", projectId: "test" },
		);

		const result = await tool.execute(
			{ action: "read", key: "secret" },
			{ workingDir: "/tmp", sessionId: "session-B", projectId: "test" },
		);
		expect(result).toContain("not found");
	});
});

// ─── Registry: all tools registered ───────────────────
describe("createDefaultRegistry includes new tools", () => {
	it("registers 20 tools total", () => {
		const registry = createDefaultRegistry();
		const tools = registry.list();
		expect(tools.length).toBe(20);
	});

	it("includes web_search", () => {
		const registry = createDefaultRegistry();
		expect(registry.get("web_search")).toBeDefined();
	});

	it("includes web_fetch", () => {
		const registry = createDefaultRegistry();
		expect(registry.get("web_fetch")).toBeDefined();
	});

	it("includes project_detect", () => {
		const registry = createDefaultRegistry();
		expect(registry.get("project_detect")).toBeDefined();
	});

	it("includes task_memory", () => {
		const registry = createDefaultRegistry();
		expect(registry.get("task_memory")).toBeDefined();
	});

	it("includes web_crawl", () => {
		const registry = createDefaultRegistry();
		expect(registry.get("web_crawl")).toBeDefined();
	});

	it("includes web_extract", () => {
		const registry = createDefaultRegistry();
		expect(registry.get("web_extract")).toBeDefined();
	});
});
