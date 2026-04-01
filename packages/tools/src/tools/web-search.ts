import type { ToolHandler } from "../types.ts";

/**
 * Brave Search API client.
 * Requires BRAVE_API_KEY environment variable.
 * Free tier: 2,000 queries/month.
 */

const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";
const MAX_SNIPPET_CHARS = 3000;

interface BraveResult {
	title: string;
	url: string;
	description: string;
}

interface BraveResponse {
	web?: { results?: BraveResult[] };
}

export async function braveSearch(
	query: string,
	count: number,
	apiKey: string,
): Promise<BraveResult[]> {
	const url = new URL(BRAVE_API);
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

	const data = (await res.json()) as BraveResponse;
	return data.web?.results ?? [];
}

function formatResults(
	results: BraveResult[],
	format: "concise" | "detailed",
): string {
	if (results.length === 0) return "No results found.";

	return results
		.map((r, i) => {
			const title = r.title || "(no title)";
			const desc = r.description || "";
			const snippet =
				format === "concise"
					? desc.slice(0, 200)
					: desc.slice(0, MAX_SNIPPET_CHARS);
			return `${i + 1}. **${title}**\n   URL: ${r.url}\n   ${snippet}`;
		})
		.join("\n\n");
}

export const webSearch: ToolHandler = {
	name: "web_search",
	description:
		"Search the internet for current information. Returns results with titles, URLs, and content snippets. Requires BRAVE_API_KEY env var.",
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
		},
		required: ["query"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args) {
		const apiKey = process.env.BRAVE_API_KEY;
		if (!apiKey) {
			return "[web_search] BRAVE_API_KEY not set. Set it to enable internet search.\n  Get a free key at https://brave.com/search/api/";
		}

		const query = args.query as string;
		const maxResults = Math.min((args.max_results as number) ?? 5, 20);
		const format = (args.format as "concise" | "detailed") ?? "concise";

		try {
			const results = await braveSearch(query, maxResults, apiKey);
			return formatResults(results, format);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return `[web_search] Error: ${msg}`;
		}
	},
};
