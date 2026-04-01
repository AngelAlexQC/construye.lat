import type { ExecutionLayer } from "@construye/shared";

const FAST_TOOLS = new Set([
	"read_file", "write_file", "edit_file", "search_text",
	"search_semantic", "list_dir", "glob", "code_mode",
]);

const HEAVY_TOOLS = new Set(["exec", "git", "preview"]);
const BROWSER_TOOLS = new Set(["browse"]);

/** Determine which execution layer a tool should run on */
export function routeExecution(toolName: string): ExecutionLayer {
	if (FAST_TOOLS.has(toolName)) return "dynamic_worker";
	if (HEAVY_TOOLS.has(toolName)) return "sandbox";
	if (BROWSER_TOOLS.has(toolName)) return "browser";
	return "none";
}
