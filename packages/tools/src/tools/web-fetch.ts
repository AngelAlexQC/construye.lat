import type { ToolHandler } from "../types.ts";

/**
 * Fetch a specific URL and return its content as clean text/markdown.
 * Uses native fetch + lightweight HTML → text conversion.
 * No external dependencies required.
 */

const DEFAULT_TOKEN_BUDGET = 8000;
const CHARS_PER_TOKEN = 4;

/**
 * Strip HTML tags and extract readable text content.
 * Lightweight alternative to Turndown — zero dependencies.
 */
export function htmlToText(html: string): string {
	let text = html;

	// Remove script, style, nav, footer, header blocks entirely
	text = text.replace(/<(script|style|nav|footer|header|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

	// Convert common block elements to newlines
	text = text.replace(/<\/?(p|div|section|article|aside|main|br|hr|li|tr|blockquote)\b[^>]*>/gi, "\n");

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

export const webFetch: ToolHandler = {
	name: "web_fetch",
	description:
		"Fetch a specific URL and return its content as clean readable text. Use when you have a URL and need its full content.",
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
		},
		required: ["url"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args) {
		const url = args.url as string;
		const maxTokens = (args.max_tokens as number) ?? DEFAULT_TOKEN_BUDGET;

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
				// Pretty-print JSON
				try {
					text = JSON.stringify(JSON.parse(body), null, 2);
				} catch {
					text = body;
				}
			} else {
				// HTML → clean text
				text = htmlToText(body);
			}

			return truncateToTokenBudget(text, maxTokens);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return `[web_fetch] Error fetching ${url}: ${msg}`;
		}
	},
};
