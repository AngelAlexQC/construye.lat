import { describe, it, expect } from "vitest";
import { assembleContext, getContextTokenUsage } from "./context-engine.ts";
import type { AgentConfig } from "./types.ts";
import type { Message } from "@construye/shared";

const mockConfig: Partial<AgentConfig> = {
	tools: [
		{ name: "read_file", description: "Reads a file from the filesystem" },
		{ name: "write_file", description: "Writes content to a file" },
	] as unknown as AgentConfig["tools"],
	skillLoader: {
		getStubs: () => [{ name: "typescript", description: "TypeScript conventions" }],
	} as unknown as AgentConfig["skillLoader"],
	projectIdentity: "Project: construye.lat\nType: AI agent framework",
};

describe("context-engine", () => {
	describe("assembleContext", () => {
		it("starts with a system prompt", async () => {
			const messages: Message[] = [{ role: "user", content: "hello" }];
			const context = await assembleContext(messages, mockConfig as AgentConfig);

			expect(context[0].role).toBe("system");
			expect(context[0].content).toContain("construye.lat");
		});

		it("includes project identity when provided", async () => {
			const messages: Message[] = [{ role: "user", content: "hello" }];
			const context = await assembleContext(messages, mockConfig as AgentConfig);

			expect(context[0].content).toContain("Project: construye.lat");
		});

		it("includes tool descriptions in system prompt", async () => {
			const messages: Message[] = [{ role: "user", content: "hello" }];
			const context = await assembleContext(messages, mockConfig as AgentConfig);

			expect(context[0].content).toContain("read_file");
			expect(context[0].content).toContain("write_file");
		});

		it("includes skill stubs in system prompt", async () => {
			const messages: Message[] = [{ role: "user", content: "hello" }];
			const context = await assembleContext(messages, mockConfig as AgentConfig);

			expect(context[0].content).toContain("typescript");
		});

		it("preserves user and assistant messages in order", async () => {
			const messages: Message[] = [
				{ role: "user", content: "first" },
				{ role: "assistant", content: "reply" },
				{ role: "user", content: "second" },
			];
			const context = await assembleContext(messages, mockConfig as AgentConfig);

			// system + 3 messages
			expect(context).toHaveLength(4);
			expect(context[1].content).toBe("first");
			expect(context[2].content).toBe("reply");
			expect(context[3].content).toBe("second");
		});

		it("filters out existing system messages from history", async () => {
			const messages: Message[] = [
				{ role: "system", content: "old system prompt" },
				{ role: "user", content: "hello" },
			];
			const context = await assembleContext(messages, mockConfig as AgentConfig);

			// Only new system + user
			expect(context).toHaveLength(2);
			expect(context[0].role).toBe("system");
			expect(context[0].content).not.toBe("old system prompt");
		});
	});

	describe("getContextTokenUsage", () => {
		it("calculates usage correctly", () => {
			const messages: Message[] = [
				{ role: "user", content: "a".repeat(400) }, // ~100 tokens
			];
			const usage = getContextTokenUsage(messages, "@cf/moonshot/kimi-k2.5");

			expect(usage.used).toBeGreaterThan(0);
			expect(usage.max).toBe(128_000);
			expect(usage.percentage).toBeGreaterThan(0);
			expect(usage.percentage).toBeLessThan(1);
		});

		it("defaults to 128K for unknown models", () => {
			const messages: Message[] = [{ role: "user", content: "test" }];
			const usage = getContextTokenUsage(messages, "unknown-model");
			expect(usage.max).toBe(128_000);
		});
	});
});
