/**
 * REAL-WORLD integration tests.
 * These actually hit the network and the filesystem — no mocks.
 */
import { describe, it, expect } from "vitest";
import { webFetch } from "./tools/web-fetch.ts";
import { htmlToText, truncateToTokenBudget } from "./tools/web-fetch.ts";
import { searchSemantic } from "./tools/search-semantic.ts";
import { projectDetect } from "./tools/project-detect.ts";
import { taskMemory } from "./tools/task-memory.ts";
import { webSearch } from "./tools/web-search.ts";
import { webCrawl } from "./tools/web-crawl.ts";
import { webExtract } from "./tools/web-extract.ts";

const CTX = { workingDir: process.cwd(), sessionId: "test-real", projectId: "test" };

// ═══════════════════════════════════════════════════
// 1. web_fetch — Real HTTP fetches
// ═══════════════════════════════════════════════════
describe("REAL: web_fetch", () => {
	it("fetches a real website and extracts clean text", async () => {
		const result = await webFetch.execute({ url: "https://news.ycombinator.com/" }, CTX);
		expect(result).toBeTruthy();
		expect(result.length).toBeGreaterThan(50);
		// Should not contain raw HTML tags
		expect(result).not.toContain("<table");
		expect(result).not.toContain("<td");
		console.log("  → HN homepage:", result.slice(0, 200));
	}, 15_000);

	it("fetches Hacker News with token limit", async () => {
		const result = await webFetch.execute(
			{ url: "https://news.ycombinator.com/", max_tokens: 500 },
			CTX,
		);
		expect(result).toBeTruthy();
		expect(result.length).toBeLessThan(3000); // 500 tokens ≈ 2000 chars + overhead
		console.log("  → HN capped at 500 tokens, length:", result.length);
	}, 15_000);

	it("fetches a JSON API endpoint", async () => {
		const result = await webFetch.execute(
			{ url: "https://httpbin.org/json" },
			CTX,
		);
		expect(result).toContain("slideshow");
		console.log("  → JSON API (first 300 chars):\n", result.slice(0, 300));
	}, 15_000);

	it("fetches a plain text endpoint", async () => {
		const result = await webFetch.execute(
			{ url: "https://httpbin.org/robots.txt", max_tokens: 1000 },
			CTX,
		);
		expect(result).toBeTruthy();
		expect(result.length).toBeGreaterThan(5);
		console.log("  → Plain text (robots.txt):\n", result.slice(0, 200));
	}, 15_000);

	it("handles 404 gracefully", async () => {
		const result = await webFetch.execute(
			{ url: "https://httpbin.org/status/404" },
			CTX,
		);
		expect(result).toContain("404");
	}, 15_000);

	it("does not crash on slow endpoints", async () => {
		const result = await webFetch.execute(
			{ url: "https://httpbin.org/delay/5" },
			CTX,
		);
		// Should return something (either data or timeout error), not crash
		expect(result).toBeTruthy();
		expect(typeof result).toBe("string");
	}, 25_000);

	it("respects token budget on large pages", async () => {
		const result = await webFetch.execute(
			{ url: "https://en.wikipedia.org/wiki/TypeScript", max_tokens: 500 },
			CTX,
		);
		// 500 tokens ≈ 2000 chars, result should be truncated
		expect(result.length).toBeLessThan(3000);
		expect(result).toContain("truncated");
		console.log("  → Wikipedia truncated to ~500 tokens, length:", result.length);
	}, 15_000);
});

// ═══════════════════════════════════════════════════
// 2. htmlToText — Real page HTML
// ═══════════════════════════════════════════════════
describe("REAL: htmlToText on realistic HTML", () => {
	it("converts realistic HTML to clean text with markdown formatting", () => {
		const html = `<!DOCTYPE html><html><head><title>Test</title>
			<script>console.log('nope')</script>
			<style>body { color: red; }</style></head>
			<body><nav>Skip this nav</nav>
			<main>
			<h1>Breaking: TypeScript 5.8 Released</h1>
			<p>The <strong>TypeScript team</strong> at Microsoft announced <a href="https://typescript.dev">TypeScript 5.8</a> today.</p>
			<h2>Key Features</h2>
			<ul><li>Isolated declarations</li><li>Better <em>inference</em></li></ul>
			<pre><code>const x: string = "hello";</code></pre>
			<footer>Copyright 2026</footer>
			</main></body></html>`;

		const text = htmlToText(html);

		// Script/style/nav/footer stripped
		expect(text).not.toContain("console.log");
		expect(text).not.toContain("color: red");
		expect(text).not.toContain("Skip this nav");
		expect(text).not.toContain("Copyright 2026");

		// Content preserved with formatting
		expect(text).toContain("# Breaking: TypeScript 5.8 Released");
		expect(text).toContain("## Key Features");
		expect(text).toContain("**TypeScript team**");
		expect(text).toContain("[TypeScript 5.8](https://typescript.dev)");
		expect(text).toContain("*inference*");
		// <pre><code> → code block (triple backtick)
		expect(text).toContain("const x: string");
		expect(text).not.toContain("<");

		console.log("  → Realistic HTML → text:\n", text);
	});
});

// ═══════════════════════════════════════════════════
// 3. search_semantic — Real codebase search
// ═══════════════════════════════════════════════════
describe("REAL: search_semantic on this monorepo", () => {
	it("finds agent loop code in packages/", async () => {
		const result = await searchSemantic.execute(
			{ query: "agent loop streaming tool call", max_results: 5 },
			CTX,
		);
		// Should find real source code, not .agents reference docs
		expect(result).toContain("packages/");
		expect(result).toMatch(/agent-loop|agent\.ts|session/);
		console.log("  → 'agent loop' results:\n", result.slice(0, 500));
	}, 10_000);

	it("finds web search implementation", async () => {
		const result = await searchSemantic.execute(
			{ query: "search provider api key query", max_results: 5 },
			CTX,
		);
		expect(result).toContain("packages/");
		expect(result).toMatch(/web-search|web-fetch|search|provider/i);
		console.log("  → 'search provider api' results:\n", result.slice(0, 500));
	}, 10_000);

	it("finds vitest config and test files", async () => {
		const result = await searchSemantic.execute(
			{ query: "vitest test runner configuration", max_results: 5 },
			CTX,
		);
		expect(result).toMatch(/vitest/i);
		console.log("  → 'vitest' results:\n", result.slice(0, 500));
	}, 10_000);

	it("finds compaction module", async () => {
		const result = await searchSemantic.execute(
			{ query: "compaction threshold context window tokens", max_results: 5 },
			CTX,
		);
		expect(result).toContain("packages/");
		expect(result).toMatch(/compaction|context-engine|compact/i);
		console.log("  → 'compaction' results:\n", result.slice(0, 500));
	}, 10_000);

	it("finds HTML conversion code", async () => {
		const result = await searchSemantic.execute(
			{ query: "html text strip tags markdown convert", max_results: 3 },
			CTX,
		);
		expect(result).toContain("packages/");
		expect(result).toMatch(/web-fetch|htmlToText|html/i);
		console.log("  → 'html to text' results:\n", result.slice(0, 400));
	}, 10_000);
});

// ═══════════════════════════════════════════════════
// 4. project_detect — Detect THIS monorepo
// ═══════════════════════════════════════════════════
describe("REAL: project_detect on this monorepo", () => {
	it("correctly identifies this as a TypeScript monorepo", async () => {
		const result = await projectDetect.execute(
			{ include_readme: true },
			CTX,
		);
		console.log("  → Project detection:\n", result.slice(0, 800));

		expect(result).toContain("TypeScript");
		expect(result).toContain("pnpm");
		// Should detect monorepo markers
		expect(result).toMatch(/monorepo|Monorepo/i);
	}, 10_000);

	it("detects turbo as part of the monorepo", async () => {
		const result = await projectDetect.execute(
			{ include_readme: false },
			CTX,
		);
		expect(result).toContain("turbo");
	}, 10_000);

	it("includes README content when asked", async () => {
		const result = await projectDetect.execute(
			{ include_readme: true },
			CTX,
		);
		expect(result).toContain("README");
		// Our README should mention construye
		expect(result).toMatch(/construye/i);
	}, 10_000);
});

// ═══════════════════════════════════════════════════
// 5. task_memory — Real CRUD across "sessions"
// ═══════════════════════════════════════════════════
describe("REAL: task_memory CRUD", () => {
	it("full lifecycle: write → read → list → delete", async () => {
		const sid = "real-test-" + Date.now();
		const ctx = { workingDir: process.cwd(), sessionId: sid, projectId: "test" };

		// Write
		const w1 = await taskMemory.execute(
			{ action: "write", key: "plan", content: "Step 1: Fetch APIs\nStep 2: Parse HTML\nStep 3: Index codebase" },
			ctx,
		);
		expect(w1).toContain("Saved");

		const w2 = await taskMemory.execute(
			{ action: "write", key: "findings", content: "Brave API works, 2K queries/month free" },
			ctx,
		);
		expect(w2).toContain("Saved");

		// Read
		const r1 = await taskMemory.execute({ action: "read", key: "plan" }, ctx);
		expect(r1).toContain("Step 1: Fetch APIs");
		expect(r1).toContain("Step 3: Index codebase");

		// List
		const list = await taskMemory.execute({ action: "list" }, ctx);
		expect(list).toContain("plan");
		expect(list).toContain("findings");

		// Delete
		const d1 = await taskMemory.execute({ action: "delete", key: "plan" }, ctx);
		expect(d1).toContain("Deleted");

		// Verify deletion
		const r2 = await taskMemory.execute({ action: "read", key: "plan" }, ctx);
		expect(r2).toContain("not found");

		// Other key still exists
		const r3 = await taskMemory.execute({ action: "read", key: "findings" }, ctx);
		expect(r3).toContain("Brave API");

		console.log("  → Full CRUD lifecycle passed for session:", sid);
	});

	it("sessions are isolated from each other", async () => {
		const ctx1 = { workingDir: process.cwd(), sessionId: "session-A-" + Date.now(), projectId: "test" };
		const ctx2 = { workingDir: process.cwd(), sessionId: "session-B-" + Date.now(), projectId: "test" };

		await taskMemory.execute({ action: "write", key: "secret", content: "only for A" }, ctx1);
		await taskMemory.execute({ action: "write", key: "secret", content: "only for B" }, ctx2);

		const a = await taskMemory.execute({ action: "read", key: "secret" }, ctx1);
		const b = await taskMemory.execute({ action: "read", key: "secret" }, ctx2);

		expect(a).toContain("only for A");
		expect(b).toContain("only for B");
		expect(a).not.toContain("only for B");
	});
});

// ═══════════════════════════════════════════════════
// 6. web_search — Multi-provider (skip if no key)
// ═══════════════════════════════════════════════════
describe("REAL: web_search (multi-provider)", () => {
	const hasAnyKey = !!(process.env.SERPER_API_KEY || process.env.BRAVE_API_KEY || process.env.TAVILY_API_KEY);

	it("returns helpful message when no API keys set", async () => {
		if (hasAnyKey) return; // skip — we have a key
		const result = await webSearch.execute({ query: "test" }, CTX);
		expect(result).toContain("No search API key configured");
		expect(result).toContain("SERPER_API_KEY");
		expect(result).toContain("5,500 free searches");
		console.log("  → No search API keys set, got multi-provider setup instructions ✓");
	});

	it.skipIf(!hasAnyKey)("searches for 'TypeScript 5.8 features 2026'", async () => {
		const result = await webSearch.execute(
			{ query: "TypeScript 5.8 features 2026", max_results: 3, format: "detailed" },
			CTX,
		);
		expect(result).not.toContain("No search API key");
		expect(result).toContain("TypeScript");
		expect(result).toContain("URL:");
		console.log("  → 'TypeScript 5.8' search results:\n", result.slice(0, 600));
	}, 20_000);

	it.skipIf(!hasAnyKey)("searches for 'Cloudflare Workers AI pricing april 2026'", async () => {
		const result = await webSearch.execute(
			{ query: "Cloudflare Workers AI pricing april 2026", max_results: 3, format: "concise" },
			CTX,
		);
		expect(result).not.toContain("No search API key");
		console.log("  → Cloudflare pricing search:\n", result.slice(0, 600));
	}, 20_000);
});

// ═══════════════════════════════════════════════════
// 7. web_crawl — Browser Worker proxy
// ═══════════════════════════════════════════════════
describe("REAL: web_crawl (Browser Worker proxy)", () => {
	const hasWorker = !!(process.env.BROWSER_WORKER_URL && process.env.BROWSER_WORKER_KEY);

	it("returns setup instructions when Worker credentials not set", async () => {
		if (hasWorker) return;
		const result = await webCrawl.execute({ url: "https://example.com" }, CTX);
		expect(result).toContain("BROWSER_WORKER_URL");
		expect(result).toContain("BROWSER_WORKER_KEY");
		console.log("  → No Worker credentials, got setup instructions ✓");
	});

	it.skipIf(!hasWorker)("crawls a real site", async () => {
		const result = await webCrawl.execute(
			{ url: "https://developers.cloudflare.com/browser-rendering/", limit: 3 },
			CTX,
		);
		expect(result).toContain("Crawl completed");
		console.log("  → Crawl (first 600 chars):\n", result.slice(0, 600));
	}, 120_000);
});

// ═══════════════════════════════════════════════════
// 8. web_extract — Browser Worker proxy + Workers AI
// ═══════════════════════════════════════════════════
describe("REAL: web_extract (Browser Worker + Workers AI)", () => {
	const hasWorker = !!(process.env.BROWSER_WORKER_URL && process.env.BROWSER_WORKER_KEY);

	it("returns setup instructions when Worker credentials not set", async () => {
		if (hasWorker) return;
		const result = await webExtract.execute(
			{ url: "https://example.com", prompt: "Extract page title" },
			CTX,
		);
		expect(result).toContain("BROWSER_WORKER_URL");
		expect(result).toContain("BROWSER_WORKER_KEY");
		console.log("  → No Worker credentials, got setup instructions ✓");
	});

	it.skipIf(!hasWorker)("extracts structured data from a page", async () => {
		const result = await webExtract.execute(
			{ url: "https://example.com", prompt: "Extract the page title and main heading" },
			CTX,
		);
		expect(result).not.toContain("[web_extract]");
		console.log("  → Extracted data:\n", result.slice(0, 400));
	}, 30_000);
});
