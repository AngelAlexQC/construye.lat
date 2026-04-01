/**
 * Construye Browser Rendering Proxy Worker
 *
 * Exposes /markdown, /json, /crawl endpoints backed by
 * Puppeteer browser binding + Workers AI.
 *
 * Deployed via wrangler (no separate API token needed).
 * Protected by AUTH_KEY secret.
 */
import puppeteer from "@cloudflare/puppeteer";

interface Env {
	BROWSER: Fetcher;
	AI: Ai;
	AUTH_KEY: string;
}

interface RequestBody {
	url: string;
	prompt?: string;
	response_format?: unknown;
	rejectResourceTypes?: string[];
	limit?: number;
	depth?: number;
}

const BLOCKED_RESOURCES = new Set(["image", "media", "font", "stylesheet"]);

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Auth check
		const authKey = request.headers.get("X-Auth-Key");
		if (env.AUTH_KEY && authKey !== env.AUTH_KEY) {
			return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
		}

		if (request.method !== "POST") {
			return Response.json({
				success: true,
				endpoints: ["POST /markdown", "POST /json"],
				usage: "Send { url } in body",
			});
		}

		const url = new URL(request.url);
		const path = url.pathname;

		try {
			const body = (await request.json()) as RequestBody;
			if (!body.url) {
				return Response.json({ success: false, error: "url required" }, { status: 400 });
			}

			// Validate URL
			const parsedUrl = new URL(body.url);
			if (!["http:", "https:"].includes(parsedUrl.protocol)) {
				return Response.json({ success: false, error: "Only HTTP/HTTPS URLs" }, { status: 400 });
			}

			if (path === "/markdown") {
				return await handleMarkdown(body, env);
			}
			if (path === "/json") {
				return await handleJson(body, env);
			}

			return Response.json({ success: false, error: `Unknown endpoint: ${path}` }, { status: 404 });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ success: false, error: message }, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;

async function handleMarkdown(body: RequestBody, env: Env): Promise<Response> {
	const browser = await puppeteer.launch(env.BROWSER);
	try {
		const page = await browser.newPage();

		// Block heavy resources
		await page.setRequestInterception(true);
		page.on("request", (req) => {
			if (BLOCKED_RESOURCES.has(req.resourceType())) {
				req.abort();
			} else {
				req.continue();
			}
		});

		await page.goto(body.url, { waitUntil: "networkidle0", timeout: 25_000 });

		// Extract clean content as markdown-like text
		const markdown = await page.evaluate(() => {
			// Remove non-content elements
			const removeSelectors = [
				"script", "style", "nav", "footer", "header",
				"aside", "noscript", "svg", "iframe", "[role='navigation']",
				"[role='banner']", "[role='contentinfo']",
			];
			for (const sel of removeSelectors) {
				document.querySelectorAll(sel).forEach((el) => el.remove());
			}

			// Get main content area or body
			const main = document.querySelector("main, article, [role='main']") || document.body;

			function nodeToMarkdown(node: Node): string {
				if (node.nodeType === Node.TEXT_NODE) {
					return node.textContent?.trim() || "";
				}
				if (node.nodeType !== Node.ELEMENT_NODE) return "";

				const el = node as Element;
				const tag = el.tagName.toLowerCase();
				const children = Array.from(el.childNodes).map(nodeToMarkdown).join("");

				switch (tag) {
					case "h1": return `\n# ${children}\n`;
					case "h2": return `\n## ${children}\n`;
					case "h3": return `\n### ${children}\n`;
					case "h4": return `\n#### ${children}\n`;
					case "h5": return `\n##### ${children}\n`;
					case "h6": return `\n###### ${children}\n`;
					case "p": return `\n${children}\n`;
					case "br": return "\n";
					case "hr": return "\n---\n";
					case "strong": case "b": return `**${children}**`;
					case "em": case "i": return `*${children}*`;
					case "code": return `\`${children}\``;
					case "pre": return `\n\`\`\`\n${el.textContent}\n\`\`\`\n`;
					case "a": {
						const href = el.getAttribute("href");
						if (!href || href.startsWith("#") || href.startsWith("javascript:")) return children;
						return `[${children}](${href})`;
					}
					case "li": return `\n- ${children}`;
					case "blockquote": return `\n> ${children}\n`;
					default: return children;
				}
			}

			return nodeToMarkdown(main).replace(/\n{3,}/g, "\n\n").trim();
		});

		return Response.json({ success: true, result: markdown });
	} finally {
		await browser.close();
	}
}

async function handleJson(body: RequestBody, env: Env): Promise<Response> {
	if (!body.prompt) {
		return Response.json({ success: false, error: "prompt required for /json" }, { status: 400 });
	}

	const browser = await puppeteer.launch(env.BROWSER);
	try {
		const page = await browser.newPage();

		await page.setRequestInterception(true);
		page.on("request", (req) => {
			if (BLOCKED_RESOURCES.has(req.resourceType())) {
				req.abort();
			} else {
				req.continue();
			}
		});

		await page.goto(body.url, { waitUntil: "networkidle0", timeout: 25_000 });

		// Extract page text
		const pageText = await page.evaluate(() => {
			const removeSelectors = ["script", "style", "nav", "footer", "header", "aside", "noscript", "svg"];
			for (const sel of removeSelectors) {
				document.querySelectorAll(sel).forEach((el) => el.remove());
			}
			const main = document.querySelector("main, article, [role='main']") || document.body;
			return main.textContent?.trim().slice(0, 16000) || "";
		});

		// Use Workers AI to extract structured data
		const messages = [
			{
				role: "system" as const,
				content: "You are a data extraction assistant. Extract structured data from the provided webpage text. Return ONLY valid JSON, no explanation.",
			},
			{
				role: "user" as const,
				content: `Webpage text:\n${pageText}\n\nExtract: ${body.prompt}`,
			},
		];

		const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as Parameters<typeof env.AI.run>[0], { messages });

		let result: unknown;
		try {
			const responseText = typeof aiResponse === "string" ? aiResponse : (aiResponse as { response?: string }).response || "";
			result = JSON.parse(responseText);
		} catch {
			result = aiResponse;
		}

		return Response.json({ success: true, result });
	} finally {
		await browser.close();
	}
}
