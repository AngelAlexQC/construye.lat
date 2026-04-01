export { ToolRegistry } from "./registry.ts";
export { routeExecution } from "./router.ts";
export { shouldRequireApproval, isToolBlocked } from "./approval.ts";
export type { ToolHandler, ToolContext } from "./types.ts";

export { readFile } from "./tools/read-file.ts";
export { writeFile } from "./tools/write-file.ts";
export { editFile } from "./tools/edit-file.ts";
export { searchText } from "./tools/search-text.ts";
export { searchSemantic } from "./tools/search-semantic.ts";
export { listDir } from "./tools/list-dir.ts";
export { glob } from "./tools/glob.ts";
export { codeMode } from "./tools/code-mode.ts";
export { exec } from "./tools/exec.ts";
export { git } from "./tools/git.ts";
export { preview } from "./tools/preview.ts";
export { browse } from "./tools/browse.ts";
export { askUser } from "./tools/ask-user.ts";
export { delegate } from "./tools/delegate.ts";
export { webSearch } from "./tools/web-search.ts";
export { webFetch } from "./tools/web-fetch.ts";
export { projectDetect } from "./tools/project-detect.ts";
export { taskMemory } from "./tools/task-memory.ts";

import type { ToolHandler } from "./types.ts";
import { ToolRegistry } from "./registry.ts";
import { readFile } from "./tools/read-file.ts";
import { writeFile } from "./tools/write-file.ts";
import { editFile } from "./tools/edit-file.ts";
import { searchText } from "./tools/search-text.ts";
import { searchSemantic } from "./tools/search-semantic.ts";
import { listDir } from "./tools/list-dir.ts";
import { glob } from "./tools/glob.ts";
import { codeMode } from "./tools/code-mode.ts";
import { exec } from "./tools/exec.ts";
import { git } from "./tools/git.ts";
import { preview } from "./tools/preview.ts";
import { browse } from "./tools/browse.ts";
import { askUser } from "./tools/ask-user.ts";
import { delegate } from "./tools/delegate.ts";
import { webSearch } from "./tools/web-search.ts";
import { webFetch } from "./tools/web-fetch.ts";
import { projectDetect } from "./tools/project-detect.ts";
import { taskMemory } from "./tools/task-memory.ts";

const ALL_TOOLS: ToolHandler[] = [
	readFile, writeFile, editFile, searchText, searchSemantic,
	listDir, glob, codeMode, exec, git, preview, browse,
	askUser, delegate, webSearch, webFetch, projectDetect, taskMemory,
];

export function createDefaultRegistry(): ToolRegistry {
	const registry = new ToolRegistry();
	for (const tool of ALL_TOOLS) {
		registry.register(tool);
	}
	return registry;
}
