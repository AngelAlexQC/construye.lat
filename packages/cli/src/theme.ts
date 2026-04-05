/**
 * construye CLI Theme — Design tokens and color semantics
 * Follows: ux-color-semantics, tuicomp-border-styles
 */

export const theme = {
	// ── Brand ─────────────────────────────────────────
	brand: "cyan" as const,
	brandBold: "cyanBright" as const,

	// ── Semantic colors ───────────────────────────────
	success: "green" as const,
	error: "red" as const,
	warning: "yellow" as const,
	info: "blue" as const,
	muted: "gray" as const,

	// ── UI Elements ───────────────────────────────────
	prompt: "cyan" as const,
	userText: "white" as const,
	assistantText: "white" as const,

	// ── Status ────────────────────────────────────────
	thinking: "cyan" as const,
	streaming: "blue" as const,
	toolRunning: "yellow" as const,
	toolDone: "green" as const,
	toolError: "red" as const,
	toolDenied: "yellow" as const,

	// ── Borders ───────────────────────────────────────
	border: "gray" as const,
	borderActive: "cyan" as const,
} as const;

// ── Unicode symbols ───────────────────────────────────
export const sym = {
	// Structural
	topLeft: "╭",
	topRight: "╮",
	bottomLeft: "╰",
	bottomRight: "╯",
	horizontal: "─",
	vertical: "│",
	teeRight: "├",
	teeLeft: "┤",
	dot: "·",
	arrow: "→",
	arrowRight: "▸",

	// Status
	check: "✔",
	cross: "✘",
	bullet: "●",
	circle: "○",
	spinner: "◌",
	block: "█",
	blockLight: "░",

	// Icons
	bolt: "⚡",
	clock: "⏱",
	chart: "📊",
	search: "🔍",
	globe: "🌐",
	brain: "🧠",
	folder: "📁",
	file: "📄",
	lock: "🔒",
	key: "🔑",
	gear: "⚙",
	pen: "✎",
	build: "🏗",
} as const;

// ── Spinner frames ────────────────────────────────────
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export function spinnerFrame(idx: number): string {
	return SPINNER_FRAMES[idx % SPINNER_FRAMES.length];
}

// ── Tool icons ────────────────────────────────────────
const TOOL_ICONS: Record<string, string> = {
	web_search: sym.search,
	web_fetch: sym.globe,
	browse: sym.globe,
	search_semantic: sym.brain,
	search_text: sym.search,
	read_file: sym.file,
	write_file: sym.pen,
	edit_file: sym.pen,
	glob: sym.folder,
	list_dir: sym.folder,
	exec: sym.bolt,
	git: sym.bolt,
};

export function toolIcon(name: string): string {
	return TOOL_ICONS[name] ?? sym.gear;
}

// ── Formatting ────────────────────────────────────────
export function fmtTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

export function fmtCost(cents: number): string {
	if (cents <= 0) return "";
	if (cents < 1) return `$${(cents / 100).toFixed(5)}`;
	return `$${(cents / 100).toFixed(4)}`;
}

export function fmtElapsed(ms: number): string {
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)}s`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	return `${m}m${rem.toFixed(0)}s`;
}

// ── Terminal width ────────────────────────────────────
export function getTermWidth(): number {
	return Math.min(process.stdout.columns || 80, 120);
}
