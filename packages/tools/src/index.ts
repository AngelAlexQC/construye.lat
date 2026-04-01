export { ToolRegistry } from "./registry.js";
export { routeExecution } from "./router.js";
export { shouldRequireApproval, isToolBlocked } from "./approval.js";
export type { ToolHandler, ToolContext } from "./types.js";

export { readFile } from "./tools/read-file.js";
export { writeFile } from "./tools/write-file.js";
export { editFile } from "./tools/edit-file.js";
export { searchText } from "./tools/search-text.js";
export { searchSemantic } from "./tools/search-semantic.js";
export { listDir } from "./tools/list-dir.js";
export { glob } from "./tools/glob.js";
export { codeMode } from "./tools/code-mode.js";
export { exec } from "./tools/exec.js";
export { git } from "./tools/git.js";
export { preview } from "./tools/preview.js";
export { browse } from "./tools/browse.js";
export { askUser } from "./tools/ask-user.js";
export { delegate } from "./tools/delegate.js";

import type { ToolHandler } from "./types.js";
import { ToolRegistry } from "./registry.js";
import { readFile } from "./tools/read-file.js";
import { writeFile } from "./tools/write-file.js";
import { editFile } from "./tools/edit-file.js";
import { searchText } from "./tools/search-text.js";
import { searchSemantic } from "./tools/search-semantic.js";
import { listDir } from "./tools/list-dir.js";
import { glob } from "./tools/glob.js";
import { codeMode } from "./tools/code-mode.js";
import { exec } from "./tools/exec.js";
import { git } from "./tools/git.js";
import { preview } from "./tools/preview.js";
import { browse } from "./tools/browse.js";
import { askUser } from "./tools/ask-user.js";
import { delegate } from "./tools/delegate.js";

const ALL_TOOLS: ToolHandler[] = [
	readFile, writeFile, editFile, searchText, searchSemantic,
	listDir, glob, codeMode, exec, git, preview, browse,
	askUser, delegate,
];

export function createDefaultRegistry(): ToolRegistry {
	const registry = new ToolRegistry();
	for (const tool of ALL_TOOLS) {
		registry.register(tool);
	}
	return registry;
}
