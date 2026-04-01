/** Skill metadata at discovery tier (always in context) */
export interface SkillStub {
	name: string;
	description: string;
	path: string;
}

/** Full skill definition after activation */
export interface SkillDefinition {
	name: string;
	description: string;
	path: string;
	content: string;
	references: string[];
}

/** Skill source for installation */
export type SkillSource =
	| { type: "registry"; name: string }
	| { type: "github"; repo: string }
	| { type: "local"; path: string };
