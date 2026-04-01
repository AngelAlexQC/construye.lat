import { describe, it, expect } from "vitest";
import { classifyTask, getModelForTask } from "./model-router.ts";
import { WORKERS_AI_MODEL_MAP, DEFAULT_MODELS } from "@construye/shared";

describe("model-router", () => {
	describe("classifyTask", () => {
		it("classifies short greetings as simple_query", () => {
			expect(classifyTask("hola")).toBe("simple_query");
			expect(classifyTask("hello")).toBe("simple_query");
			expect(classifyTask("hey")).toBe("simple_query");
			expect(classifyTask("qué puedes hacer?")).toBe("simple_query");
		});

		it("classifies debugging requests as reasoning", () => {
			expect(classifyTask("debug the authentication error in login.ts")).toBe("reasoning");
			expect(classifyTask("why is this failing?")).toBe("reasoning");
			expect(classifyTask("explain how this algorithm works")).toBe("reasoning");
			expect(classifyTask("por qué no funciona este código?")).toBe("reasoning");
		});

		it("classifies planning requests as planning", () => {
			expect(classifyTask("plan the implementation of the new API")).toBe("planning");
			expect(classifyTask("break down this feature into steps")).toBe("planning");
			expect(classifyTask("diseña la arquitectura del sistema")).toBe("planning");
		});

		it("classifies file search requests as file_ops", () => {
			expect(classifyTask("list the files in src/")).toBe("file_ops");
			expect(classifyTask("find all test files")).toBe("file_ops");
			expect(classifyTask("busca errores en el código")).toBe("file_ops");
			expect(classifyTask("show me the package.json")).toBe("file_ops");
		});

		it("defaults to coding for ambiguous requests", () => {
			expect(classifyTask("add a login form with validation")).toBe("coding");
			expect(classifyTask("create a REST API endpoint for users")).toBe("coding");
		});

		it("classifies coding based on history context", () => {
			const history = [
				{ role: "assistant" as const, content: "", tool_calls: [{ id: "1", name: "edit_file", arguments: {} }] },
			];
			expect(classifyTask("now fix the tests too", history)).toBe("coding");
		});
	});

	describe("getModelForTask", () => {
		it("returns fast model for simple queries", () => {
			const config = getModelForTask("simple_query");
			expect(config.model).toBe(WORKERS_AI_MODEL_MAP.fast);
			expect(config.temperature).toBe(0.4);
			expect(config.max_tokens).toBe(1024);
		});

		it("returns heavy model for coding", () => {
			const config = getModelForTask("coding");
			expect(config.model).toBe(WORKERS_AI_MODEL_MAP.heavy);
			expect(config.temperature).toBe(0.1);
		});

		it("returns reasoning model for reasoning tasks", () => {
			const config = getModelForTask("reasoning");
			expect(config.model).toBe(WORKERS_AI_MODEL_MAP.reasoning);
		});

		it("respects overrides", () => {
			const config = getModelForTask("coding", { coding: "custom-model" });
			expect(config.model).toBe("custom-model");
		});

		it("infers provider from model name", () => {
			const wai = getModelForTask("coding");
			expect(wai.provider).toBe("workers-ai");

			const claude = getModelForTask("coding", { coding: "claude-sonnet-4" });
			expect(claude.provider).toBe("claude");
		});
	});
});
