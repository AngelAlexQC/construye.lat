import type { ToolHandler } from "../types.ts";

/**
 * Extract structured data from a webpage using Browser Worker proxy
 * /json endpoint powered by Workers AI.
 *
 * FREE: 10K Workers AI neurons/day + 10 min browser time/day.
 * Requires: BROWSER_WORKER_URL + BROWSER_WORKER_KEY
 */

function getWorkerCredentials(): { workerUrl: string; authKey: string } {
	const workerUrl = process.env.BROWSER_WORKER_URL;
	const authKey = process.env.BROWSER_WORKER_KEY;
	if (!workerUrl || !authKey) {
		throw new Error(
			"BROWSER_WORKER_URL and BROWSER_WORKER_KEY not set.\n" +
				"  These are auto-configured when using the CLI.",
		);
	}
	return { workerUrl, authKey };
}

export const webExtract: ToolHandler = {
	name: "web_extract",
	description:
		"Extract structured data from a webpage using AI. Uses Browser Worker proxy + Workers AI (free tier: 10K neurons/day). Provide a URL and a prompt describing what to extract.",
	parameters: {
		type: "object",
		properties: {
			url: {
				type: "string",
				description: "URL to extract data from",
			},
			prompt: {
				type: "string",
				description: "What to extract, e.g. 'Extract product name, price, and description'",
			},
			response_format: {
				type: "object",
				description: "Optional JSON schema for structured output. Example: { type: 'json_schema', json_schema: { name: 'product', properties: { name: 'string', price: 'number' } } }",
			},
		},
		required: ["url", "prompt"],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args) {
		const url = args.url as string;
		const prompt = args.prompt as string;
		const responseFormat = args.response_format as Record<string, unknown> | undefined;

		// Validate URL
		try {
			const parsed = new URL(url);
			if (!["http:", "https:"].includes(parsed.protocol)) {
				return "[web_extract] Only HTTP/HTTPS URLs are supported";
			}
		} catch {
			return `[web_extract] Invalid URL: ${url}`;
		}

		let creds: { workerUrl: string; authKey: string };
		try {
			creds = getWorkerCredentials();
		} catch (err) {
			return `[web_extract] ${err instanceof Error ? err.message : String(err)}`;
		}

		const endpoint = `${creds.workerUrl}/json`;

		const body: Record<string, unknown> = {
			url,
			prompt,
		};
		if (responseFormat) {
			body.response_format = responseFormat;
		}

		try {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: {
					"X-Auth-Key": creds.authKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(45_000),
			});

			if (!res.ok) {
				const errBody = await res.text().catch(() => "");
				return `[web_extract] Worker error ${res.status}: ${errBody.slice(0, 300)}`;
			}

			const data = await res.json() as { success: boolean; result?: unknown; error?: string };
			if (!data.success) {
				return `[web_extract] Worker error: ${data.error ?? "unknown error"}`;
			}

			// Return formatted JSON
			return JSON.stringify(data.result, null, 2);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return `[web_extract] Error: ${msg}`;
		}
	},
};
