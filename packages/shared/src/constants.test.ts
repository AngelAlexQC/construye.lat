import { describe, it, expect } from "vitest";
import {
	VERSION,
	MODEL_CONTEXT_SIZES,
	COMPACTION_THRESHOLD,
	MAX_AGENT_TURNS,
	MAX_ERROR_RETRIES,
	WORKERS_AI_MODEL_MAP,
	DEFAULT_MODELS,
	CHARS_PER_TOKEN,
	BROWSER_WORKER_DEFAULTS,
} from "./constants.ts";

describe("constants", () => {
	it("exports a valid semver VERSION", () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("defines context sizes for all WORKERS_AI_MODEL_MAP models", () => {
		for (const model of Object.values(WORKERS_AI_MODEL_MAP)) {
			expect(MODEL_CONTEXT_SIZES[model]).toBeGreaterThan(0);
		}
	});

	it("COMPACTION_THRESHOLD is between 0 and 1", () => {
		expect(COMPACTION_THRESHOLD).toBeGreaterThan(0);
		expect(COMPACTION_THRESHOLD).toBeLessThanOrEqual(1);
	});

	it("MAX_AGENT_TURNS is a positive integer", () => {
		expect(MAX_AGENT_TURNS).toBeGreaterThanOrEqual(1);
		expect(Number.isInteger(MAX_AGENT_TURNS)).toBe(true);
	});

	it("MAX_ERROR_RETRIES is a positive integer", () => {
		expect(MAX_ERROR_RETRIES).toBeGreaterThanOrEqual(1);
		expect(Number.isInteger(MAX_ERROR_RETRIES)).toBe(true);
	});

	it("CHARS_PER_TOKEN is positive", () => {
		expect(CHARS_PER_TOKEN).toBeGreaterThan(0);
	});

	it("WORKERS_AI_MODEL_MAP has all required roles", () => {
		expect(WORKERS_AI_MODEL_MAP.heavy).toBeDefined();
		expect(WORKERS_AI_MODEL_MAP.reasoning).toBeDefined();
		expect(WORKERS_AI_MODEL_MAP.fast).toBeDefined();
		expect(WORKERS_AI_MODEL_MAP.general).toBeDefined();
	});

	it("all WORKERS_AI_MODEL_MAP values start with @cf/", () => {
		for (const model of Object.values(WORKERS_AI_MODEL_MAP)) {
			expect(model).toMatch(/^@cf\//);
		}
	});

	it("DEFAULT_MODELS covers all task types", () => {
		const expectedTypes = ["reasoning", "coding", "file_ops", "planning", "compaction", "simple_query", "embedding"];
		for (const t of expectedTypes) {
			expect(DEFAULT_MODELS[t]).toBeDefined();
		}
	});

	it("BROWSER_WORKER_DEFAULTS has valid url and key", () => {
		expect(BROWSER_WORKER_DEFAULTS.url).toMatch(/^https:\/\//);
		expect(BROWSER_WORKER_DEFAULTS.key).toBeTruthy();
		expect(BROWSER_WORKER_DEFAULTS.key.length).toBeGreaterThan(10);
	});
});
