import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";

const CONFIG_PATH = path.join(os.homedir(), ".construye", "config.json");

export interface ConstruyeConfig {
	provider: "workers-ai" | "anthropic" | "openai";
	cloudflare?: {
		accountId: string;
		apiToken: string;
	};
	anthropic?: {
		apiKey: string;
	};
}

export interface CloudflareCredentials {
	accountId: string;
	apiToken: string;
}

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadConfig(): ConstruyeConfig | null {
	try {
		const content = fs.readFileSync(CONFIG_PATH, "utf-8");
		return JSON.parse(content) as ConstruyeConfig;
	} catch {
		return null;
	}
}

export function saveConfig(config: ConstruyeConfig): void {
	const dir = path.dirname(CONFIG_PATH);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ── Credential detection ──────────────────────────────────────────────────────

function readWranglerToken(): string | null {
	const candidates = [
		path.join(os.homedir(), ".wrangler", "config", "default.toml"),
		path.join(os.homedir(), ".config", ".wrangler", "config", "default.toml"),
	];
	for (const p of candidates) {
		try {
			const content = fs.readFileSync(p, "utf-8");
			const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
			if (match?.[1]) return match[1];
			const apiMatch = content.match(/api_token\s*=\s*"([^"]+)"/);
			if (apiMatch?.[1]) return apiMatch[1];
		} catch {
			/* not found */
		}
	}
	return null;
}

async function detectAccountId(token: string): Promise<string | null> {
	try {
		const resp = await fetch(
			"https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5",
			{ headers: { Authorization: `Bearer ${token}` } },
		);
		if (!resp.ok) return null;
		const data = (await resp.json()) as { result?: { id: string; name: string }[] };
		return data.result?.[0]?.id ?? null;
	} catch {
		return null;
	}
}

// ── Wrangler login ────────────────────────────────────────────────────────────

async function runWranglerLogin(): Promise<boolean> {
	return new Promise((resolve) => {
		console.log(
			"\n  Abriendo el navegador para autenticarte con Cloudflare...\n" +
			"  (Si no se abre automáticamente, sigue las instrucciones en la terminal)\n",
		);

		const child = spawn("npx", ["--yes", "wrangler", "login"], {
			stdio: "inherit",
			shell: process.platform === "win32",
		});

		child.on("close", (code) => resolve(code === 0));
		child.on("error", () => resolve(false));
	});
}

/** Poll wrangler config file until a token appears (max 60s) */
async function waitForWranglerToken(timeoutMs = 60_000): Promise<string | null> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const token = readWranglerToken();
		if (token) return token;
		await new Promise((r) => setTimeout(r, 500));
	}
	return null;
}

// ── Banner ────────────────────────────────────────────────────────────────────

function printBanner(): void {
	console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║   construye  —  agente de código en Cloudflare        ║
  ║   100% gratuito · sin configuración · open source     ║
  ╚═══════════════════════════════════════════════════════╝
`);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Ensure Cloudflare credentials are available.
 *
 * Priority:
 *   1. Env vars (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
 *   2. ~/.construye/config.json saved config
 *   3. ~/.wrangler/config/default.toml (already logged in via wrangler)
 *   4. Auto-launch `wrangler login` to authenticate via browser
 *
 * Returns null only if the user explicitly cancels or login fails.
 */
export async function ensureCloudflareSetup(
	options: { silent?: boolean } = {},
): Promise<CloudflareCredentials | null> {
	const { silent = false } = options;

	// 1. Env vars — highest priority, no prompts
	if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
		return {
			accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
			apiToken: process.env.CLOUDFLARE_API_TOKEN,
		};
	}

	// 2. Saved config
	const saved = loadConfig();
	if (saved?.cloudflare?.apiToken && saved.cloudflare.accountId) {
		const valid = await detectAccountId(saved.cloudflare.apiToken);
		if (valid) {
			if (valid !== saved.cloudflare.accountId) {
				saved.cloudflare.accountId = valid;
				saveConfig(saved);
			}
			return { accountId: saved.cloudflare.accountId, apiToken: saved.cloudflare.apiToken };
		}
		// Token expired — fall through to re-auth
	}

	// 3. Wrangler OAuth token (user already did `wrangler login` manually)
	const existingToken = readWranglerToken();
	if (existingToken) {
		const accountId = await detectAccountId(existingToken);
		if (accountId) {
			saveConfig({
				provider: "workers-ai",
				cloudflare: { accountId, apiToken: existingToken },
			});
			return { accountId, apiToken: existingToken };
		}
	}

	// 4. No credentials found — auto-launch wrangler login
	if (!silent) {
		printBanner();
		console.log("  Primera vez que usas construye. Vamos a configurar todo automáticamente.");
		console.log("  Solo necesitas una cuenta de Cloudflare (gratis).\n");
	}

	const loginOk = await runWranglerLogin();

	if (!loginOk) {
		console.error("\n  Login cancelado o fallido.");
		console.error("  Puedes intentar de nuevo con: npx wrangler login\n");
		return null;
	}

	// Read the token written by wrangler
	const newToken = await waitForWranglerToken();
	if (!newToken) {
		console.error("\n  No se encontró el token después del login.");
		console.error("  Intenta exportar: export CLOUDFLARE_API_TOKEN=tu_token\n");
		return null;
	}

	const accountId = await detectAccountId(newToken);
	if (!accountId) {
		console.error("\n  No se pudo detectar tu cuenta de Cloudflare.");
		console.error("  Verifica tu conexión a internet e intenta de nuevo.\n");
		return null;
	}

	saveConfig({
		provider: "workers-ai",
		cloudflare: { accountId, apiToken: newToken },
	});

	console.log(`\n  ✓ Configurado correctamente`);
	console.log(`  ✓ Cuenta: ${accountId}`);
	console.log(`  ✓ Config guardada en ~/.construye/config.json\n`);

	return { accountId, apiToken: newToken };
}
