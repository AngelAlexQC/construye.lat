import type { ToolHandler } from "../types.ts";

/**
 * Crawl a website using Browser Worker proxy for rendering.
 * Fetches the starting page, discovers same-domain links from HTML,
 * then fetches linked pages via Worker — returns combined markdown.
 *
 * FREE: 10 min browser time/day on Workers Free plan.
 * Requires: BROWSER_WORKER_URL + BROWSER_WORKER_KEY
 */

interface PageResult {
	url: string;
	markdown: string;
	error?: string;
}

/**
 * Extract same-origin links from HTML, filtering to content pages.
 */
function extractLinks(html: string, baseUrl: URL): string[] {
	const seen = new Set<string>();
	const linkRe = /<a\b[^>]*href=["']([^"'#]+)/gi;
	let m: RegExpExecArray | null;
	while ((m = linkRe.exec(html)) !== null) {
		try {
			const resolved = new URL(m[1], baseUrl);
			// Same origin only
			if (resolved.origin !== baseUrl.origin) continue;
			// Skip non-content paths
			if (/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|ico|pdf|zip|tar|gz)$/i.test(resolved.pathname)) continue;
			// Normalize — strip hash, keep path+search
			resolved.hash = "";
			const normalized = resolved.href;
			if (!seen.has(normalized) && normalized !== baseUrl.href) {
				seen.add(normalized);
			}
		} catch {
			// ignore invalid URLs
		}
	}
	return [...seen];
}

/**
 * Fetch a single URL via Browser Worker /markdown endpoint.
 */
async function fetchViaWorker(
	url: string,
	workerUrl: string,
	authKey: string,
): Promise<PageResult> {
	try {
		const res = await fetch(`${workerUrl}/markdown`, {
			method: "POST",
			headers: {
				"X-Auth-Key": authKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ url }),
			signal: AbortSignal.timeout(45_000),
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			return { url, markdown: "", error: `HTTP ${res.status}: ${body.slice(0, 100)}` };
		}

		const data = await res.json() as { success: boolean; result?: string; error?: string };
		if (!data.success || !data.result) {
			return { url, markdown: "", error: data.error ?? "empty result" };
		}

		return { url, markdown: data.result };
	} catch (err) {
		return { url, markdown: "", error: err instanceof Error ? err.message : String(err) };
	}
}

function formatResults(pages: PageResult[], maxChars: number): string {
	const lines: string[] = [];
	const successful = pages.filter((p) => p.markdown);
	const failed = pages.filter((p) => p.error);

	lines.push(`**Crawl completed** — ${successful.length}/${pages.length} pages fetched\n`);

	let charCount = lines[0].length;

	for (const page of successful) {
		const entry = `---\n### ${page.url}\n\n${page.markdown}\n`;
		if (charCount + entry.length > maxChars) {
			lines.push(`\n... [${successful.length - lines.length + 1} more pages truncated]`);
			break;
		}
		lines.push(entry);
		charCount += entry.length;
	}

	if (failed.length > 0) {
		lines.push(`\n**Failed pages:** ${failed.map((p) => `${p.url} (${p.error})`).join(", ")}`);
	}

	return lines.join("\n");
}

export const webCrawl: ToolHandler = {
	name: "web_crawl",
	description:
		"Crawl a website and return markdown content from multiple pages. Fetches starting page, discovers same-domain links, then renders each via Browser Worker proxy. Great for researching docs, blogs, and multi-page content.",
	parameters: {
		type: "object",
		properties: {
			url: {
				type: "string",
				description: "Starting URL to crawl",
			},
			limit: {
				type: "number",
				description: "Max pages to crawl including starting page (default 5, max 20)",
			},
		},
		required: ["url"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args) {
		const url = args.url as string;
		const limit = Math.min((args.limit as number) ?? 5, 20);

		// Validate URL
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
			if (!["http:", "https:"].includes(parsedUrl.protocol)) {
				return "[web_crawl] Only HTTP/HTTPS URLs are supported";
			}
		} catch {
			return `[web_crawl] Invalid URL: ${url}`;
		}

		const workerUrl = process.env.BROWSER_WORKER_URL;
		const authKey = process.env.BROWSER_WORKER_KEY;
		if (!workerUrl || !authKey) {
			return "[web_crawl] BROWSER_WORKER_URL and BROWSER_WORKER_KEY not set.\n  These are auto-configured when using the CLI.";
		}

		try {
			// Step 1: Fetch starting page via Worker
			const startPage = await fetchViaWorker(url, workerUrl, authKey);
			const pages: PageResult[] = [startPage];

			if (limit <= 1 || startPage.error) {
				return formatResults(pages, 32_000);
			}

			// Step 2: Discover links via basic HTML fetch
			let discoveredLinks: string[] = [];
			try {
				const htmlRes = await fetch(url, {
					headers: { "User-Agent": "construye-agent/0.1" },
					signal: AbortSignal.timeout(15_000),
					redirect: "follow",
				});
				if (htmlRes.ok) {
					const html = await htmlRes.text();
					discoveredLinks = extractLinks(html, parsedUrl);
				}
			} catch {
				// Link discovery failed — return just the starting page
			}

			// Step 3: Fetch discovered links via Worker (up to limit - 1)
			const linksToFetch = discoveredLinks.slice(0, limit - 1);

			// Fetch 3 at a time to avoid overwhelming the Worker
			const BATCH_SIZE = 3;
			for (let i = 0; i < linksToFetch.length; i += BATCH_SIZE) {
				const batch = linksToFetch.slice(i, i + BATCH_SIZE);
				const results = await Promise.all(
					batch.map((link) => fetchViaWorker(link, workerUrl, authKey)),
				);
				pages.push(...results);
			}

			return formatResults(pages, 32_000);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return `[web_crawl] Error: ${msg}`;
		}
	},
};
