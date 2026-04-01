import type { SkillDefinition, SkillStub, SkillSource } from "@construye/shared";

export interface SkillStore {
	list(): Promise<SkillStub[]>;
	get(name: string): Promise<SkillDefinition | undefined>;
	save(skill: SkillDefinition): Promise<void>;
	remove(name: string): Promise<void>;
}

export interface SkillMatch {
	skill: SkillStub;
	score: number;
	reason: string;
}

export interface SkillInstallResult {
	name: string;
	source: SkillSource;
	success: boolean;
	error?: string;
}
