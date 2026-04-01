import type { AgentMode } from "@construye/shared";

const PLAN_BLOCKED = new Set([
	"write_file", "edit_file", "exec", "git", "preview", "code_mode",
]);

const INTERACTIVE_APPROVAL = new Set([
	"write_file", "edit_file", "exec", "git",
]);

const AUTO_APPROVAL = new Set(["git"]);

/** Check if a tool requires user approval in the given mode */
export function shouldRequireApproval(
	toolName: string,
	mode: AgentMode,
): boolean {
	switch (mode) {
		case "plan":
			return PLAN_BLOCKED.has(toolName); // blocked entirely
		case "interactive":
			return INTERACTIVE_APPROVAL.has(toolName);
		case "auto":
			return AUTO_APPROVAL.has(toolName);
		default:
			return false;
	}
}

/** Check if a tool is completely blocked in the given mode */
export function isToolBlocked(toolName: string, mode: AgentMode): boolean {
	if (mode === "plan") return PLAN_BLOCKED.has(toolName);
	return false;
}
