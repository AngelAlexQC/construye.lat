import type { ToolHandler } from "../types.ts";
import { readFile, access, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

/**
 * Auto-detect project type, frameworks, build/test commands.
 * The agent uses this to understand the project context.
 */

interface ProjectInfo {
	name: string;
	type: string;
	framework?: string;
	language: string;
	packageManager?: string;
	scripts: Record<string, string>;
	dependencies: string[];
	testCommand?: string;
	buildCommand?: string;
	devCommand?: string;
	readme?: string;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function readJSON(path: string): Promise<Record<string, unknown> | null> {
	try {
		const content = await readFile(path, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

async function readHead(path: string, maxChars = 2000): Promise<string> {
	try {
		const content = await readFile(path, "utf-8");
		return content.slice(0, maxChars);
	} catch {
		return "";
	}
}

async function detectPackageManager(dir: string): Promise<string> {
	if (await fileExists(join(dir, "pnpm-lock.yaml"))) return "pnpm";
	if (await fileExists(join(dir, "yarn.lock"))) return "yarn";
	if (await fileExists(join(dir, "bun.lockb"))) return "bun";
	if (await fileExists(join(dir, "package-lock.json"))) return "npm";
	return "npm";
}

async function detectNodeProject(dir: string): Promise<ProjectInfo | null> {
	const pkg = await readJSON(join(dir, "package.json"));
	if (!pkg) return null;

	const deps = {
		...(pkg.dependencies as Record<string, string> ?? {}),
		...(pkg.devDependencies as Record<string, string> ?? {}),
	};
	const depNames = Object.keys(deps);
	const scripts = (pkg.scripts as Record<string, string>) ?? {};

	let framework: string | undefined;
	if (depNames.includes("next")) framework = "Next.js";
	else if (depNames.includes("nuxt")) framework = "Nuxt";
	else if (depNames.includes("@sveltejs/kit")) framework = "SvelteKit";
	else if (depNames.includes("remix")) framework = "Remix";
	else if (depNames.includes("astro")) framework = "Astro";
	else if (depNames.includes("vite")) framework = "Vite";
	else if (depNames.includes("express")) framework = "Express";
	else if (depNames.includes("fastify")) framework = "Fastify";
	else if (depNames.includes("hono")) framework = "Hono";
	else if (depNames.includes("react")) framework = "React";
	else if (depNames.includes("vue")) framework = "Vue";

	const isTS = depNames.includes("typescript") || await fileExists(join(dir, "tsconfig.json"));
	const pm = await detectPackageManager(dir);

	return {
		name: (pkg.name as string) ?? "unknown",
		type: "node",
		framework,
		language: isTS ? "TypeScript" : "JavaScript",
		packageManager: pm,
		scripts,
		dependencies: depNames.slice(0, 30),
		testCommand: scripts.test ? `${pm} test` : undefined,
		buildCommand: scripts.build ? `${pm} run build` : undefined,
		devCommand: scripts.dev ? `${pm} run dev` : undefined,
	};
}

async function detectPythonProject(dir: string): Promise<ProjectInfo | null> {
	const hasPyproject = await fileExists(join(dir, "pyproject.toml"));
	const hasRequirements = await fileExists(join(dir, "requirements.txt"));
	if (!hasPyproject && !hasRequirements) return null;

	return {
		name: "python-project",
		type: "python",
		language: "Python",
		scripts: {},
		dependencies: [],
		testCommand: "pytest",
		buildCommand: "pip install -e .",
	};
}

async function detectRustProject(dir: string): Promise<ProjectInfo | null> {
	const cargoToml = await readJSON(join(dir, "Cargo.toml"));
	if (!cargoToml) return null;
	const pkg = cargoToml.package as Record<string, string> | undefined;

	return {
		name: pkg?.name ?? "rust-project",
		type: "rust",
		language: "Rust",
		scripts: {},
		dependencies: [],
		testCommand: "cargo test",
		buildCommand: "cargo build",
		devCommand: "cargo run",
	};
}

async function detectGoProject(dir: string): Promise<ProjectInfo | null> {
	if (!(await fileExists(join(dir, "go.mod")))) return null;

	return {
		name: "go-project",
		type: "go",
		language: "Go",
		scripts: {},
		dependencies: [],
		testCommand: "go test ./...",
		buildCommand: "go build",
	};
}

function formatProjectInfo(info: ProjectInfo): string {
	const lines: string[] = [
		`## Project: ${info.name}`,
		`- **Type**: ${info.type}`,
		`- **Language**: ${info.language}`,
	];
	if (info.framework) lines.push(`- **Framework**: ${info.framework}`);
	if (info.packageManager) lines.push(`- **Package Manager**: ${info.packageManager}`);
	if (info.testCommand) lines.push(`- **Test**: \`${info.testCommand}\``);
	if (info.buildCommand) lines.push(`- **Build**: \`${info.buildCommand}\``);
	if (info.devCommand) lines.push(`- **Dev**: \`${info.devCommand}\``);

	if (Object.keys(info.scripts).length > 0) {
		lines.push("\n### Scripts");
		for (const [name, cmd] of Object.entries(info.scripts).slice(0, 15)) {
			lines.push(`- \`${name}\`: ${cmd}`);
		}
	}

	if (info.dependencies.length > 0) {
		lines.push(`\n### Key Dependencies (${info.dependencies.length})`);
		lines.push(info.dependencies.slice(0, 20).join(", "));
	}

	if (info.readme) {
		lines.push("\n### README (preview)");
		lines.push(info.readme);
	}

	return lines.join("\n");
}

export const projectDetect: ToolHandler = {
	name: "project_detect",
	description:
		"Auto-detect project type, framework, build/test/dev commands, dependencies, and README. Use at the start of a session to understand the project.",
	parameters: {
		type: "object",
		properties: {
			include_readme: {
				type: "boolean",
				description: "Include README preview (default true)",
			},
		},
		required: [],
	},
	layer: "none",
	requiresApproval: false,
	async execute(args, context) {
		const dir = context.workingDir;
		const includeReadme = (args.include_readme as boolean) ?? true;

		// Try each detector
		const detectors = [
			detectNodeProject,
			detectPythonProject,
			detectRustProject,
			detectGoProject,
		];

		let info: ProjectInfo | null = null;
		for (const detect of detectors) {
			info = await detect(dir);
			if (info) break;
		}

		if (!info) {
			// Fallback: list directory contents
			try {
				const entries = await readdir(dir);
				return `Could not detect project type.\nDirectory contents: ${entries.slice(0, 30).join(", ")}`;
			} catch {
				return `Could not detect project type in ${dir}`;
			}
		}

		// Check for monorepo markers
		const isMonorepo = await fileExists(join(dir, "pnpm-workspace.yaml"))
			|| await fileExists(join(dir, "turbo.json"))
			|| await fileExists(join(dir, "lerna.json"))
			|| await fileExists(join(dir, "nx.json"));

		if (isMonorepo) {
			info.type += " (monorepo)";
		}

		// Add README
		if (includeReadme) {
			for (const name of ["CONSTRUYE.md", "README.md", "readme.md"]) {
				const readme = await readHead(resolve(dir, name), 2000);
				if (readme) {
					info.readme = readme;
					break;
				}
			}
		}

		return formatProjectInfo(info);
	},
};