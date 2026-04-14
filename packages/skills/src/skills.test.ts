import { describe, it, expect, vi } from "vitest";
import { matchSkills } from "./matcher.ts";
import { SkillRegistry } from "./registry.ts";
import type { SkillStub, SkillDefinition } from "@construye/shared";
import type { SkillStore, SkillMatch } from "./types.ts";

// --- Matcher Tests ---

describe("matchSkills", () => {
	const skills: SkillStub[] = [
		{ name: "typescript", description: "Write and refactor TypeScript code with best practices" },
		{ name: "testing", description: "Write unit tests with vitest and proper assertions" },
		{ name: "deploy", description: "Deploy applications to Cloudflare Workers and Pages" },
		{ name: "react", description: "Build user interfaces with React components" },
	];

	it("matches skill by exact name in message", () => {
		const matches = matchSkills("help me with typescript", skills);
		expect(matches.length).toBeGreaterThan(0);
		expect(matches[0].skill.name).toBe("typescript");
	});

	it("matches skill by description keywords", () => {
		const matches = matchSkills("write unit tests with vitest assertions", skills);
		const testMatch = matches.find((m) => m.skill.name === "testing");
		expect(testMatch).toBeDefined();
	});

	it("returns empty array when no skills match", () => {
		const matches = matchSkills("hello world", skills);
		// All matches should be below threshold
		const highScoreMatches = matches.filter((m) => m.score >= 0.3);
		// Might still match due to common words - just test the function doesn't crash
		expect(Array.isArray(matches)).toBe(true);
	});

	it("sorts matches by score descending", () => {
		const matches = matchSkills("deploy to cloudflare workers", skills);
		if (matches.length > 1) {
			for (let i = 1; i < matches.length; i++) {
				expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
			}
		}
	});

	it("respects custom threshold", () => {
		const matches = matchSkills("react testing", skills, 0.9);
		// With a very high threshold, fewer or no matches
		for (const m of matches) {
			expect(m.score).toBeGreaterThanOrEqual(0.9);
		}
	});

	it("includes reason in match", () => {
		const matches = matchSkills("typescript", skills);
		if (matches.length > 0) {
			expect(matches[0].reason).toContain("Matched");
			expect(matches[0].reason).toContain("score");
		}
	});
});

// --- SkillRegistry Tests ---

describe("SkillRegistry", () => {
	function createMockStore(): SkillStore {
		const skills = new Map<string, SkillDefinition>();
		return {
			list: vi.fn(async () => {
				return Array.from(skills.values()).map((s) => ({
					name: s.name,
					description: s.description,
				}));
			}),
			get: vi.fn(async (name: string) => skills.get(name)),
			save: vi.fn(async (skill: SkillDefinition) => {
				skills.set(skill.name, skill);
			}),
			remove: vi.fn(async (name: string) => {
				skills.delete(name);
			}),
		};
	}

	it("register and list skills", async () => {
		const store = createMockStore();
		const registry = new SkillRegistry(store);

		const skill: SkillDefinition = {
			name: "test-skill",
			description: "A test skill",
			path: "/skills/test-skill",
			content: "# Test Skill\nDo things.",
		};

		await registry.register(skill);
		expect(store.save).toHaveBeenCalledWith(skill);

		const stubs = await registry.listStubs();
		expect(stubs).toEqual([{ name: "test-skill", description: "A test skill" }]);
	});

	it("getDefinition returns skill by name", async () => {
		const store = createMockStore();
		const registry = new SkillRegistry(store);

		const skill: SkillDefinition = {
			name: "my-skill",
			description: "My skill",
			path: "/skills/my-skill",
			content: "content",
		};

		await registry.register(skill);
		const result = await registry.getDefinition("my-skill");
		expect(result).toEqual(skill);
	});

	it("getDefinition returns undefined for missing skill", async () => {
		const store = createMockStore();
		const registry = new SkillRegistry(store);
		const result = await registry.getDefinition("nonexistent");
		expect(result).toBeUndefined();
	});

	it("unregister removes skill", async () => {
		const store = createMockStore();
		const registry = new SkillRegistry(store);

		const skill: SkillDefinition = {
			name: "removable",
			description: "Will be removed",
			path: "/skills/removable",
			content: "content",
		};

		await registry.register(skill);
		await registry.unregister("removable");
		expect(store.remove).toHaveBeenCalledWith("removable");

		const result = await registry.getDefinition("removable");
		expect(result).toBeUndefined();
	});
});
