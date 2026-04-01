import type { SkillStub } from "@construye/shared";
import type { SkillMatch } from "./types.js";

/**
 * Match user message to relevant skills using keyword + description matching.
 * Returns ranked matches above the score threshold.
 */
export function matchSkills(
	message: string,
	skills: SkillStub[],
	threshold = 0.3,
): SkillMatch[] {
	const lower = message.toLowerCase();
	const matches: SkillMatch[] = [];

	for (const skill of skills) {
		const score = computeScore(lower, skill);
		if (score >= threshold) {
			matches.push({
				skill,
				score,
				reason: `Matched "${skill.name}" with score ${score.toFixed(2)}`,
			});
		}
	}

	return matches.sort((a, b) => b.score - a.score);
}

function computeScore(message: string, skill: SkillStub): number {
	let score = 0;
	const name = skill.name.toLowerCase();
	const desc = skill.description.toLowerCase();

	if (message.includes(name)) score += 0.5;

	const words = desc.split(/\s+/).filter((w) => w.length > 3);
	const matched = words.filter((w) => message.includes(w));
	if (words.length > 0) {
		score += (matched.length / words.length) * 0.5;
	}

	return Math.min(score, 1);
}
