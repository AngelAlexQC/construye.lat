import type { SkillDefinition, SkillSource } from "@construye/shared";
import type { SkillInstallResult } from "./types.ts";
import { loadSkillFromSource } from "./loader.ts";
import { SkillRegistry } from "./registry.ts";

/**
 * Install a skill from a source into the registry.
 */
export async function installSkill(
	registry: SkillRegistry,
	name: string,
	source: SkillSource,
	path: string,
): Promise<SkillInstallResult> {
	try {
		const skill = await loadSkillFromSource(source, path);
		if (!skill) {
			return { name, source, success: false, error: "Skill not found" };
		}
		await registry.register(skill);
		return { name, source, success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { name, source, success: false, error: message };
	}
}
