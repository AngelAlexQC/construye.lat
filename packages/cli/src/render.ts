import chalk from "chalk";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { highlight } from "cli-highlight";

// ── Layout constants ──────────────────────────────────
export const TERM_WIDTH = Math.min(process.stdout.columns || 80, 100);
const INNER_WIDTH = TERM_WIDTH - 6;

// ── Unicode symbols ───────────────────────────────────
export const S = {
	topLeft: "╭", topRight: "╮",
	bottomLeft: "╰", bottomRight: "╯",
	horizontal: "─", vertical: "│",
	teeRight: "├", teeLeft: "┤",
	bullet: "●",
	check: "✔", cross: "✘",
	bolt: "⚡", clock: "⏱",
	chart: "📊", dot: "·", arrow: "→",
	search: "🔍", globe: "🌐", brain: "🧠",
	folder: "📁", file: "📄",
};

// ── Spinner frames ────────────────────────────────────
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function spinnerFrame(idx: number): string {
	return SPINNER[idx % SPINNER.length];
}

// ── Syntax highlighting ───────────────────────────────
const LANG_ALIASES: Record<string, string> = {
	ts: "typescript", js: "javascript", tsx: "typescript", jsx: "javascript",
	py: "python", rb: "ruby", sh: "bash", zsh: "bash", yml: "yaml",
	md: "markdown", rs: "rust", tf: "hcl", toml: "ini",
};

export function highlightCode(code: string, lang?: string): string {
	const language = lang ? (LANG_ALIASES[lang] ?? lang) : undefined;
	try {
		return highlight(code, { language, ignoreIllegals: true });
	} catch {
		return code;
	}
}

// ── Markdown renderer ─────────────────────────────────
const md = new Marked(
	markedTerminal({
		reflowText: true,
		width: INNER_WIDTH,
		tab: 2,
		showSectionPrefix: false,
		code: (code: string, lang?: string) => {
			const highlighted = highlightCode(code, lang);
			const langLabel = lang ? chalk.dim(` ${lang}`) : "";
			const border = chalk.dim("│");
			const lines = highlighted.split("\n").map((l: string) => `  ${border} ${l}`).join("\n");
			return `\n  ${chalk.dim("┌──")}${langLabel}\n${lines}\n  ${chalk.dim("└──")}\n`;
		},
	}) as any,
);

export function renderMarkdown(text: string): string {
	if (!text.trim()) return "";
	try {
		const rendered = md.parse(text) as string;
		return rendered.replace(/\n+$/, "");
	} catch {
		return text;
	}
}

// ── Box drawing helpers ───────────────────────────────
function hLine(w: number): string {
	return S.horizontal.repeat(Math.max(w, 0));
}

function stripAnsi(str: string): string {
	return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(str: string): number {
	// Strip ANSI, approximate emoji as 2 chars
	return stripAnsi(str).length;
}

// ── Banner ────────────────────────────────────────────
export interface BannerOpts {
	provider: string;
	model: string;
	modeLabel: string;
	tools: number;
	dir: string;
	isDemo: boolean;
}

export function banner(opts: BannerOpts): string {
	const w = Math.min(TERM_WIDTH - 4, 56);
	const hr = hLine(w);

	const row = (label: string, value: string) => {
		const content = `${chalk.dim(label.padEnd(10))} ${value}`;
		const pad = Math.max(w - visibleLength(content) - 2, 0);
		return `  ${chalk.cyan(S.vertical)}  ${content}${" ".repeat(pad)}${chalk.cyan(S.vertical)}`;
	};

	const titleRow = (content: string) => {
		const pad = Math.max(w - visibleLength(content) - 2, 0);
		return `  ${chalk.cyan(S.vertical)}  ${content}${" ".repeat(pad)}${chalk.cyan(S.vertical)}`;
	};

	const shortModel = opts.model.length > w - 16
		? opts.model.slice(0, w - 19) + "..."
		: opts.model;

	const lines: string[] = [
		"",
		`  ${chalk.cyan(S.topLeft + hr + S.topRight)}`,
		titleRow(`🏗  ${chalk.bold("construye.lat")}`),
		titleRow(chalk.dim("AI coding agent")),
		`  ${chalk.cyan(S.teeRight + hr + S.teeLeft)}`,
		row("Provider", opts.provider),
		row("Model", shortModel),
		row("Mode", opts.modeLabel),
		row("Tools", String(opts.tools)),
		row("Dir", opts.dir),
		`  ${chalk.cyan(S.bottomLeft + hr + S.bottomRight)}`,
	];

	if (opts.isDemo) {
		lines.push(
			"",
			`  ${chalk.yellow("⚠  Running in demo mode. To use real AI:")}`,
			`  ${chalk.dim("   Cloudflare: npx wrangler login  (auto-detects credentials)")}`,
			`  ${chalk.dim("   or set:     CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN")}`,
			`  ${chalk.dim("   Anthropic:  ANTHROPIC_API_KEY")}`,
		);
	}

	lines.push(
		"",
		`  ${chalk.dim("Escribe tu solicitud. Ctrl+C para salir.")}`,
		`  ${chalk.dim("/clear  /history  /sessions  /resume [id]  /usage")}`,
		"",
	);

	return lines.join("\n");
}

// ── Thinking / Receiving indicators ───────────────────
export function thinkingLine(frame: string, elapsed: string): string {
	return `\r  ${chalk.cyan(frame)} ${chalk.dim("Pensando...")} ${chalk.dim.italic(elapsed + "s")}     `;
}

export function receivingLine(frame: string, words: number): string {
	const bar = chalk.cyan("█".repeat(Math.min(Math.floor(words / 5), 20)));
	const empty = chalk.dim("░".repeat(Math.max(20 - Math.floor(words / 5), 0)));
	return `\r  ${chalk.cyan(frame)} ${chalk.dim("Recibiendo...")} ${bar}${empty} ${chalk.dim(words + " palabras")}  `;
}

// ── Assistant header ──────────────────────────────────
export function assistantHeader(): string {
	return `\n  ${chalk.cyan(S.bullet)} ${chalk.bold.cyan("Asistente")}\n`;
}

// ── Render indented markdown ──────────────────────────
export function indentedMarkdown(text: string): string {
	const rendered = renderMarkdown(text);
	return rendered
		.split("\n")
		.map((line) => `    ${line}`)
		.join("\n");
}

// ── Tool call rendering ───────────────────────────────
const TOOL_ICONS: Record<string, string> = {
	web_search: S.search,
	web_fetch: S.globe,
	browse: S.globe,
	search_semantic: S.brain,
	search_text: S.search,
	read_file: S.file,
	write_file: S.file,
	edit_file: S.file,
	glob: S.folder,
	list_dir: S.folder,
	exec: S.bolt,
	git: S.bolt,
};

function toolIcon(name: string): string {
	return TOOL_ICONS[name] ?? S.bolt;
}

export function toolCallHeader(name: string, args: string): string {
	const shortArgs = args.length > 70 ? args.slice(0, 67) + "..." : args;
	const icon = toolIcon(name);
	const labelLen = name.length + 6;
	const remaining = Math.max(TERM_WIDTH - labelLen - 8, 1);

	return [
		"",
		`  ${chalk.dim(S.teeRight + S.horizontal)} ${chalk.yellow(icon)} ${chalk.bold.yellow(name)} ${chalk.dim(hLine(remaining))}`,
		`  ${chalk.dim(S.vertical)}  ${chalk.dim(shortArgs)}`,
	].join("\n");
}

/** Activity line shown during long-running tools */
export function toolCallActivity(name: string, frame: string): string {
	const labels: Record<string, string> = {
		web_search: "buscando en internet...",
		web_fetch: "descargando página...",
		browse: "navegando...",
		search_semantic: "buscando en codebase...",
		exec: "ejecutando comando...",
	};
	const label = labels[name] ?? "ejecutando...";
	return `\n  ${chalk.dim(S.vertical)}  ${chalk.cyan(frame)} ${chalk.dim(label)}`;
}

export function toolCallExecuting(): string {
	return `\n  ${chalk.dim(S.vertical)}  ${chalk.dim("⏳ ejecutando...")}`;
}

export function toolCallDone(success: boolean, elapsed: string, preview?: string): string {
	const lines: string[] = [];
	if (preview) {
		// Truncate long previews to 3 lines
		const previewLines = preview.split("\n");
		const short = previewLines.length > 3
			? previewLines.slice(0, 3).join("\n") + chalk.dim(` ... (+${previewLines.length - 3} líneas)`)
			: preview;
		for (const l of short.split("\n")) {
			lines.push(`  ${chalk.dim(S.vertical)}  ${chalk.dim(l)}`);
		}
	}
	if (success) {
		lines.push(`  ${chalk.dim(S.bottomLeft + S.horizontal)} ${chalk.green(S.check + " " + elapsed + "s")}`);
	} else {
		lines.push(`  ${chalk.dim(S.bottomLeft + S.horizontal)} ${chalk.red(S.cross + " error")} ${chalk.dim("(" + elapsed + "s)")}`);
	}
	return lines.join("\n");
}

// ── Turn metrics ──────────────────────────────────────
export function fmtTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

export function fmtCost(cents: number): string {
	if (cents <= 0) return "";
	if (cents < 1) return `$${(cents / 100).toFixed(5)}`;
	return `$${(cents / 100).toFixed(4)}`;
}

export interface MetricsOpts {
	elapsed: string;
	tokensIn?: number;
	tokensOut?: number;
	costCents?: number;
	turn: number;
}

export function turnMetrics(opts: MetricsOpts): string {
	const parts = [chalk.cyan(`${S.clock} ${opts.elapsed}s`)];
	if (opts.tokensIn !== undefined && opts.tokensOut !== undefined) {
		parts.push(chalk.blue(`${S.chart} ${fmtTokens(opts.tokensIn)}${S.arrow}${fmtTokens(opts.tokensOut)}`));
	}
	if (opts.costCents !== undefined && opts.costCents > 0) {
		parts.push(chalk.green(fmtCost(opts.costCents)));
	}
	parts.push(chalk.dim(`turno ${opts.turn}`));

	const sep = chalk.dim(`  ${S.dot}  `);
	return `\n  ${chalk.dim("──")} ${parts.join(sep)} ${chalk.dim("──")}`;
}

// ── Usage table ───────────────────────────────────────
export function usageTable(stats: {
	tokensIn: number;
	tokensOut: number;
	costCents: number;
	turns: number;
	messages: number;
	sessionId: string;
}): string {
	const lines = [
		"",
		`  ${chalk.cyan.bold("📊 Uso de la sesión")}`,
		`  ${chalk.dim("─────────────────────────────")}`,
		`  ${chalk.dim("Tokens entrada:")}  ${fmtTokens(stats.tokensIn)}`,
		`  ${chalk.dim("Tokens salida:")}   ${fmtTokens(stats.tokensOut)}`,
		`  ${chalk.dim("Total tokens:")}    ${fmtTokens(stats.tokensIn + stats.tokensOut)}`,
	];
	if (stats.costCents > 0) {
		lines.push(`  ${chalk.dim("Costo:")}           ${fmtCost(stats.costCents)}`);
	}
	lines.push(
		`  ${chalk.dim("Turnos:")}          ${stats.turns}`,
		`  ${chalk.dim("Mensajes:")}        ${stats.messages}`,
		`  ${chalk.dim("Sesión:")}          ${stats.sessionId}`,
		"",
	);
	return lines.join("\n");
}

// ── Prompt ────────────────────────────────────────────
export const PROMPT = `${chalk.green.bold(" ❯ ")}`;

// ── Misc messages ─────────────────────────────────────
export function successMsg(text: string): string {
	return `  ${chalk.green(S.check)} ${chalk.dim(text)}`;
}

export function errorMsg(text: string): string {
	return `  ${chalk.red(S.cross)} ${text}`;
}

export function dimMsg(text: string): string {
	return `  ${chalk.dim(text)}`;
}

// ── Approval prompt ───────────────────────────────────
export function approvalPrompt(toolName: string): string {
	return `\n  ${chalk.dim(S.vertical)}  ${chalk.yellow("¿Permitir")} ${chalk.bold.yellow(toolName)}${chalk.yellow("?")} ${chalk.dim("[Y]es / [A]lways / [n]o")} `;
}

export function approvalResult(result: "approved" | "always" | "denied"): string {
	if (result === "denied") {
		return `  ${chalk.dim(S.vertical)}  ${chalk.red(S.cross + " denegado")}`;
	}
	if (result === "always") {
		return `  ${chalk.dim(S.vertical)}  ${chalk.green(S.check + " aprobado siempre para esta sesión")}`;
	}
	return `  ${chalk.dim(S.vertical)}  ${chalk.green(S.check + " aprobado")}`;
}

export function autoApproved(): string {
	return `\n  ${chalk.dim(S.vertical)}  ${chalk.green(S.check + " auto-aprobado")}`;
}

// ── Goodbye ───────────────────────────────────────────
export function goodbye(): string {
	return `\n  ${chalk.dim("¡Hasta luego! 👋")}\n`;
}
