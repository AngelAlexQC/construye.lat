import type { SkillDefinition, SkillSource } from "@construye/shared";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

/**
 * Load skills from various sources:
 * - local: .construye/skills/ directory or absolute path
 * - registry: remote skill registry (construye.lat API)
 * - github: GitHub repository raw content
 */
export async function loadSkillFromSource(
	source: SkillSource,
	path: string,
): Promise<SkillDefinition | undefined> {
	switch (source.type) {
		case "local":
			return loadLocalSkill(source.path);
		case "registry":
			return loadRegistrySkill(source.name);
		case "github":
			return loadGitHubSkill(source.repo);
	}
}

/**
 * Load a skill from the local filesystem.
 * Expects a directory containing SKILL.md with YAML frontmatter:
 * ---
 * name: my-skill
 * description: What this skill does
 * ---
 * [Skill content/instructions]
 */
async function loadLocalSkill(skillPath: string): Promise<SkillDefinition | undefined> {
	try {
		// Check if path points to a directory or a file
		const stats = await stat(skillPath);

		let skillMdPath: string;
		let skillDir: string;

		if (stats.isDirectory()) {
			skillMdPath = join(skillPath, "SKILL.md");
			skillDir = skillPath;
		} else {
			skillMdPath = skillPath;
			skillDir = join(skillPath, "..");
		}

		const content = await readFile(skillMdPath, "utf-8");
		const parsed = parseSkillMd(content, skillDir);
		if (!parsed) return undefined;

		// Look for referenced files in the same directory
		const references: string[] = [];
		try {
			const files = await readdir(skillDir);
			for (const file of files) {
				if (file !== "SKILL.md" && (file.endsWith(".md") || file.endsWith(".txt"))) {
					const refContent = await readFile(join(skillDir, file), "utf-8");
					references.push(refContent);
				}
			}
		} catch {
			// No additional reference files, that's fine
		}

		return { ...parsed, references };
	} catch {
		return undefined;
	}
}

/**
 * Load a skill from the remote construye.lat registry.
 */
async function loadRegistrySkill(name: string): Promise<SkillDefinition | undefined> {
	try {
		const res = await fetch(`https://construye-worker.quirozai.workers.dev/api/skills/${encodeURIComponent(name)}`);
		if (!res.ok) return undefined;
		const data = (await res.json()) as SkillDefinition;
		return data;
	} catch {
		return undefined;
	}
}

/**
 * Load a skill from a GitHub repository.
 * Expects format: "owner/repo" or "owner/repo/path/to/skill"
 * Fetches SKILL.md from the default branch via GitHub raw content.
 */
async function loadGitHubSkill(repo: string): Promise<SkillDefinition | undefined> {
	try {
		// Parse "owner/repo" or "owner/repo/path"
		const parts = repo.split("/");
		if (parts.length < 2) return undefined;
		const owner = parts[0];
		const repoName = parts[1];
		const subpath = parts.length > 2 ? parts.slice(2).join("/") : "";

		const rawUrl = subpath
			? `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD/${subpath}/SKILL.md`
			: `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD/SKILL.md`;

		const res = await fetch(rawUrl, {
			headers: { "User-Agent": "construye-skill-loader" },
		});
		if (!res.ok) return undefined;

		const content = await res.text();
		return parseSkillMd(content, repo) ?? undefined;
	} catch {
		return undefined;
	}
}

/**
 * Parse a SKILL.md file with optional YAML frontmatter.
 */
function parseSkillMd(
	content: string,
	pathOrRepo: string,
): Omit<SkillDefinition, "references"> | null {
	let name = basename(pathOrRepo);
	let description = "";
	let body = content;

	// Parse YAML frontmatter (---\n...\n---)
	const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (fmMatch) {
		const frontmatter = fmMatch[1];
		body = fmMatch[2];

		// Simple YAML parsing for name and description
		const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
		if (nameMatch) name = nameMatch[1].trim();

		const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
		if (descMatch) description = descMatch[1].trim();
	}

	// If no description from frontmatter, use first paragraph
	if (!description) {
		const firstParagraph = body.trim().split("\n\n")[0];
		description = firstParagraph.slice(0, 200).replace(/\n/g, " ").trim();
	}

	return {
		name,
		description,
		path: pathOrRepo,
		content: body.trim(),
	};
}

/**
 * Discover all skills in a directory (e.g., .construye/skills/).
 * Each subdirectory containing a SKILL.md is treated as a skill.
 */
export async function discoverLocalSkills(
	skillsDir: string,
): Promise<SkillDefinition[]> {
	const skills: SkillDefinition[] = [];

	try {
		const entries = await readdir(skillsDir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const skill = await loadLocalSkill(join(skillsDir, entry.name));
				if (skill) skills.push(skill);
			}
		}
	} catch {
		// Directory doesn't exist = no skills
	}

	return skills;
}
