import type { ToolHandler } from "../types.ts";

/**
 * Fetch a specific URL and return its content as clean text/markdown.
 *
 * Primary: Browser Worker proxy /markdown endpoint (FREE 10 min/day)
 *   → Renders JavaScript, strips nav/sidebar, returns clean Markdown
 *   → Requires BROWSER_WORKER_URL + BROWSER_WORKER_KEY env vars
 *
 * Fallback: native fetch + lightweight HTML → text conversion (zero-dep)
 */

const DEFAULT_TOKEN_BUDGET = 8000;
const CHARS_PER_TOKEN = 4;

/**
 * Extract the most relevant content area from HTML.
 * Prefers <main> or <article> over full document to skip nav/sidebar noise.
 */
function extractContentArea(html: string): string {
	// Try <main> first, then <article>
	for (const tag of ["main", "article"]) {
		const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
		const m = html.match(re);
		if (m && m[1].length > 200) return m[1];
	}
	// Fallback: try role="main"
	const roleMain = html.match(/<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/\w+>/i);
	if (roleMain && roleMain[1].length > 200) return roleMain[1];
	return html;
}

/**
 * Strip HTML tags and extract readable text content.
 * Lightweight alternative to Turndown — zero dependencies.
 */
export function htmlToText(html: string): string {
	// Focus on main content area when available
	let text = extractContentArea(html);

	// Remove script, style, nav, footer, header, aside blocks entirely
	text = text.replace(/<(script|style|nav|footer|header|aside|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

	// Convert common block elements to newlines
	text = text.replace(/<\/?(p|div|section|article|main|br|hr|li|tr|blockquote)\b[^>]*>/gi, "\n");

	// Convert headers to markdown-style
	text = text.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, content) => {
		const hashes = "#".repeat(Number(level));
		return `\n${hashes} ${content.replace(/<[^>]+>/g, "").trim()}\n`;
	});

	// Convert links to markdown-style
	text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, content) => {
		const cleanContent = content.replace(/<[^>]+>/g, "").trim();
		if (!cleanContent || href.startsWith("#") || href.startsWith("javascript:")) {
			return cleanContent;
		}
		return `[${cleanContent}](${href})`;
	});

	// Convert bold/strong
	text = text.replace(/<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");

	// Convert italic/em
	text = text.replace(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

	// Convert code blocks
	text = text.replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n");
	text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

	// Convert list items
	text = text.replace(/<li\b[^>]*>/gi, "- ");

	// Strip remaining tags
	text = text.replace(/<[^>]+>/g, "");

	// Decode HTML entities
	text = text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));

	// Clean up whitespace: collapse multiple blank lines, trim lines
	text = text
		.split("\n")
		.map((line) => line.trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	return text;
}

/**
 * Truncate text to stay within token budget.
 */
export function truncateToTokenBudget(
	text: string,
	maxTokens: number,
): string {
	const maxChars = maxTokens * CHARS_PER_TOKEN;
	if (text.length <= maxChars) return text;
	return text.slice(0, maxChars) + "\n\n... [truncated to ~" + maxTokens + " tokens]";
}

// ─── Cloudflare Browser Rendering ───────────────────────────────────────────

/**
 * Check if Browser Worker proxy credentials are available.
 */
export function hasCfBrowserRendering(): boolean {
	return !!(process.env.BROWSER_WORKER_URL && process.env.BROWSER_WORKER_KEY);
}

/**
 * Fetch URL via Browser Worker proxy /markdown endpoint.
 * Returns clean Markdown with JS rendered and nav/sidebar stripped.
 * Uses deployed Puppeteer Worker — FREE: 10 min browser time/day.
 */
async function cfMarkdownFetch(url: string): Promise<string> {
	const workerUrl = process.env.BROWSER_WORKER_URL;
	const authKey = process.env.BROWSER_WORKER_KEY;
	if (!workerUrl || !authKey) throw new Error("BROWSER_WORKER_URL or BROWSER_WORKER_KEY not set");

	const endpoint = `${workerUrl}/markdown`;

	const res = await fetch(endpoint, {
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
		throw new Error(`Browser Worker ${res.status}: ${body.slice(0, 200)}`);
	}

	const data = await res.json() as { success: boolean; result?: string; error?: string };
	if (!data.success || !data.result) {
		throw new Error(`Browser Worker: ${data.error ?? "empty result"}`);
	}

	return data.result;
}

// ─── Tool handler ───────────────────────────────────────────────────────────

export const webFetch: ToolHandler = {
	name: "web_fetch",
	description:
		"Fetch a URL and return its content as clean readable text/markdown. Uses Browser Worker proxy (Puppeteer, renders JS) when BROWSER_WORKER_URL + BROWSER_WORKER_KEY are set, otherwise falls back to basic HTML extraction.",
	parameters: {
		type: "object",
		properties: {
			url: {
				type: "string",
				description: "URL to fetch",
			},
			selector: {
				type: "string",
				description: "CSS-like keyword to focus extraction (e.g. 'main', 'article'). Optional.",
			},
			max_tokens: {
				type: "number",
				description: "Maximum tokens in response (default 8000)",
			},
			method: {
				type: "string",
				enum: ["auto", "cloudflare", "basic"],
				description: "Extraction method: auto (CF if available, else basic), cloudflare (force CF), basic (force local HTML parsing). Default: auto",
			},
		},
		required: ["url"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args) {
		const url = args.url as string;
		const maxTokens = (args.max_tokens as number) ?? DEFAULT_TOKEN_BUDGET;
		const method = (args.method as string) ?? "auto";

		// Validate URL
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			return `[web_fetch] Invalid URL: ${url}`;
		}

		// Only allow http/https
		if (!["http:", "https:"].includes(parsedUrl.protocol)) {
			return `[web_fetch] Only HTTP/HTTPS URLs are supported`;
		}

		// Try Cloudflare Browser Rendering first (auto or explicit)
		const useCf = method === "cloudflare" || (method === "auto" && hasCfBrowserRendering());
		if (useCf) {
			try {
				const markdown = await cfMarkdownFetch(url);
				return truncateToTokenBudget(markdown, maxTokens);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				if (method === "cloudflare") {
					return `[web_fetch] Cloudflare Browser Rendering error: ${msg}`;
				}
				// auto mode: fall through to basic
			}
		}

		// Fallback: basic fetch + htmlToText
		try {
			const res = await fetch(url, {
				headers: {
					"User-Agent": "construye-agent/0.1 (https://construye.lat)",
					Accept: "text/html, text/plain, application/json, text/markdown",
				},
				redirect: "follow",
				signal: AbortSignal.timeout(20_000),
			});

			if (!res.ok) {
				return `[web_fetch] HTTP ${res.status} ${res.statusText} for ${url}`;
			}

			const contentType = res.headers.get("content-type") ?? "";
			const body = await res.text();

			let text: string;
			if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
				text = body;
			} else if (contentType.includes("application/json")) {
				try {
					text = JSON.stringify(JSON.parse(body), null, 2);
				} catch {
					text = body;
				}
			} else {
				text = htmlToText(body);
			}

			return truncateToTokenBudget(text, maxTokens);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return `[web_fetch] Error fetching ${url}: ${msg}`;
		}
	},
};
