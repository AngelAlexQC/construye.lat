import type { SkillDefinition, SkillSource } from "@construye/shared";

/**
 * Load skills from various sources:
 * - local: .construye/skills/ directory
 * - registry: remote skill registry (future)
 * - github: GitHub repository
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

async function loadLocalSkill(_path: string): Promise<SkillDefinition | undefined> {
	// Placeholder: will read SKILL.md from local filesystem
	return undefined;
}

async function loadRegistrySkill(_name: string): Promise<SkillDefinition | undefined> {
	// Placeholder: will fetch from remote skill registry
	return undefined;
}

async function loadGitHubSkill(_repo: string): Promise<SkillDefinition | undefined> {
	// Placeholder: will clone and load from GitHub
	return undefined;
}
