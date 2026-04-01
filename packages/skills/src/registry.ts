import type { SkillDefinition, SkillStub } from "@construye/shared";
import type { SkillStore } from "./types.js";

export class SkillRegistry {
	private store: SkillStore;

	constructor(store: SkillStore) {
		this.store = store;
	}

	async listStubs(): Promise<SkillStub[]> {
		return this.store.list();
	}

	async getDefinition(name: string): Promise<SkillDefinition | undefined> {
		return this.store.get(name);
	}

	async register(skill: SkillDefinition): Promise<void> {
		await this.store.save(skill);
	}

	async unregister(name: string): Promise<void> {
		await this.store.remove(name);
	}
}
