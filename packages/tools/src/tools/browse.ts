import type { ToolHandler } from "../types.ts";
import { htmlToText, truncateToTokenBudget } from "./web-fetch.ts";

export const browse: ToolHandler = {
	name: "browse",
	description: "Fetch and read a web page, returning clean readable text. Use web_fetch for simpler URL fetching.",
	parameters: {
		type: "object",
		properties: {
			url: { type: "string", description: "URL to visit" },
			action: { type: "string", enum: ["read", "screenshot"], description: "Action to perform" },
		},
		required: ["url", "action"],
	},
	layer: "browser",
	requiresApproval: false,
	async execute(args) {
		const url = args.url as string;
		const action = args.action as string;

		if (action === "screenshot") {
			return `[browse] Screenshots require Browser Rendering API on Cloudflare Workers. Use web_fetch for text content.`;
		}

		// For "read" action: fetch and convert to text
		try {
			const res = await fetch(url, {
				headers: {
					"User-Agent": "construye-agent/0.1 (https://construye.lat)",
					Accept: "text/html, text/plain, text/markdown",
				},
				redirect: "follow",
				signal: AbortSignal.timeout(20_000),
			});

			if (!res.ok) {
				return `[browse] HTTP ${res.status} ${res.statusText} for ${url}`;
			}

			const contentType = res.headers.get("content-type") ?? "";
			const body = await res.text();

			if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
				return truncateToTokenBudget(body, 8000);
			}

			return truncateToTokenBudget(htmlToText(body), 8000);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return `[browse] Error: ${msg}`;
		}
	},
};
