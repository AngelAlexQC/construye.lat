import type { ToolHandler } from "../types.ts";

/**
 * Multi-provider web search with automatic fallback.
 *
 * Provider priority (tries first available):
 *  1. Serper  — SERPER_API_KEY  (2,500 free/month, no CC)
 *  2. Brave   — BRAVE_API_KEY   (2,000 free/month)
 *  3. Tavily  — TAVILY_API_KEY  (1,000 free/month)
 *
 * All three have generous free tiers — combined that's 5,500 free searches/month.
 * The tool automatically picks whichever key is available.
 */

const MAX_SNIPPET_CHARS = 3000;

// ─── Shared types ───────────────────────────────────────────────────────────

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

// ─── Serper (Google results, 2500 free/month) ───────────────────────────────

async function serperSearch(
	query: string,
	count: number,
	apiKey: string,
): Promise<SearchResult[]> {
	const res = await fetch("https://google.serper.dev/search", {
		method: "POST",
		headers: {
			"X-API-KEY": apiKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ q: query, num: Math.min(count, 20) }),
		signal: AbortSignal.timeout(15_000),
	});

	if (!res.ok) {
		throw new Error(`Serper API error: ${res.status} ${res.statusText}`);
	}

	const data = await res.json() as {
		organic?: { title: string; link: string; snippet: string }[];
	};
	return (data.organic ?? []).map((r) => ({
		title: r.title,
		url: r.link,
		snippet: r.snippet ?? "",
	}));
}

// ─── Brave (independent index, 2000 free/month) ────────────────────────────

async function braveSearch(
	query: string,
	count: number,
	apiKey: string,
): Promise<SearchResult[]> {
	const url = new URL("https://api.search.brave.com/res/v1/web/search");
	url.searchParams.set("q", query);
	url.searchParams.set("count", String(Math.min(count, 20)));

	const res = await fetch(url.toString(), {
		headers: {
			Accept: "application/json",
			"Accept-Encoding": "gzip",
			"X-Subscription-Token": apiKey,
		},
		signal: AbortSignal.timeout(15_000),
	});

	if (!res.ok) {
		throw new Error(`Brave Search API error: ${res.status} ${res.statusText}`);
	}

	const data = await res.json() as {
		web?: { results?: { title: string; url: string; description: string }[] };
	};
	return (data.web?.results ?? []).map((r) => ({
		title: r.title,
		url: r.url,
		snippet: r.description ?? "",
	}));
}

// ─── Tavily (AI-native search, 1000 free/month) ────────────────────────────

async function tavilySearch(
	query: string,
	count: number,
	apiKey: string,
): Promise<SearchResult[]> {
	const res = await fetch("https://api.tavily.com/search", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			api_key: apiKey,
			query,
			max_results: Math.min(count, 20),
			search_depth: "basic",
		}),
		signal: AbortSignal.timeout(15_000),
	});

	if (!res.ok) {
		throw new Error(`Tavily API error: ${res.status} ${res.statusText}`);
	}

	const data = await res.json() as {
		results?: { title: string; url: string; content: string }[];
	};
	return (data.results ?? []).map((r) => ({
		title: r.title,
		url: r.url,
		snippet: r.content ?? "",
	}));
}

// ─── Provider selection ─────────────────────────────────────────────────────

type SearchProvider = "serper" | "brave" | "tavily";

interface ProviderConfig {
	name: SearchProvider;
	envKey: string;
	fn: (query: string, count: number, key: string) => Promise<SearchResult[]>;
	freeQuota: string;
	signupUrl: string;
}

const PROVIDERS: ProviderConfig[] = [
	{
		name: "serper",
		envKey: "SERPER_API_KEY",
		fn: serperSearch,
		freeQuota: "2,500/month",
		signupUrl: "https://serper.dev",
	},
	{
		name: "brave",
		envKey: "BRAVE_API_KEY",
		fn: braveSearch,
		freeQuota: "2,000/month",
		signupUrl: "https://brave.com/search/api/",
	},
	{
		name: "tavily",
		envKey: "TAVILY_API_KEY",
		fn: tavilySearch,
		freeQuota: "1,000/month",
		signupUrl: "https://tavily.com",
	},
];

function getAvailableProvider(): ProviderConfig | null {
	for (const p of PROVIDERS) {
		if (process.env[p.envKey]) return p;
	}
	return null;
}

// ─── Format results ─────────────────────────────────────────────────────────

function formatResults(
	results: SearchResult[],
	format: "concise" | "detailed",
	provider: string,
): string {
	if (results.length === 0) return "No results found.";

	const header = `*Search results via ${provider}:*\n\n`;
	const body = results
		.map((r, i) => {
			const title = r.title || "(no title)";
			const snippet =
				format === "concise"
					? r.snippet.slice(0, 200)
					: r.snippet.slice(0, MAX_SNIPPET_CHARS);
			return `${i + 1}. **${title}**\n   URL: ${r.url}\n   ${snippet}`;
		})
		.join("\n\n");

	return header + body;
}

// ─── Exported for testing ───────────────────────────────────────────────────

export { serperSearch, braveSearch, tavilySearch, getAvailableProvider, formatResults, PROVIDERS };
export type { SearchResult, ProviderConfig };

// ─── Tool handler ───────────────────────────────────────────────────────────

export const webSearch: ToolHandler = {
	name: "web_search",
	description:
		"Search the internet for current information. Returns results with titles, URLs, and snippets. Supports Serper (free 2500/mo), Brave (free 2000/mo), and Tavily (free 1000/mo) — auto-picks the first available API key.",
	parameters: {
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "What to search for",
			},
			max_results: {
				type: "number",
				description: "Maximum results to return (default 5, max 20)",
			},
			format: {
				type: "string",
				enum: ["concise", "detailed"],
				description: "concise saves tokens, detailed gives more content (default: concise)",
			},
			provider: {
				type: "string",
				enum: ["serper", "brave", "tavily", "auto"],
				description: "Search provider to use (default: auto — picks first available key)",
			},
		},
		required: ["query"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args) {
		const query = args.query as string;
		const maxResults = Math.min((args.max_results as number) ?? 5, 20);
		const format = (args.format as "concise" | "detailed") ?? "concise";
		const requestedProvider = (args.provider as string) ?? "auto";

		// Find provider
		let provider: ProviderConfig | null = null;

		if (requestedProvider === "auto") {
			provider = getAvailableProvider();
		} else {
			provider = PROVIDERS.find((p) => p.name === requestedProvider) ?? null;
			if (provider && !process.env[provider.envKey]) {
				return `[web_search] ${provider.envKey} not set. Get a free key at ${provider.signupUrl}`;
			}
		}

		if (!provider) {
			const hints = PROVIDERS.map(
				(p) => `  • ${p.envKey} → ${p.freeQuota} free (${p.signupUrl})`,
			).join("\n");
			return `[web_search] No search API key configured. Set any of these:\n${hints}\n\nAll have generous free tiers — combined 5,500 free searches/month.`;
		}

		const apiKey = process.env[provider.envKey]!;

		try {
			const results = await provider.fn(query, maxResults, apiKey);
			return formatResults(results, format, provider.name);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return `[web_search] Error (${provider.name}): ${msg}`;
		}
	},
};
