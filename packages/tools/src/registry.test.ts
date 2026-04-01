import { describe, it, expect } from "vitest";
import { ToolRegistry } from "./registry.ts";
import type { ToolHandler } from "./types.ts";

function makeTool(name: string, description = `Tool ${name}`): ToolHandler {
	return {
		name,
		description,
		parameters: { type: "object", properties: {} },
		layer: "none" as const,
		requiresApproval: false,
		execute: async () => "ok",
	};
}

describe("ToolRegistry", () => {
	it("registers and retrieves tools", () => {
		const reg = new ToolRegistry();
		const tool = makeTool("test_tool");
		reg.register(tool);
		expect(reg.get("test_tool")).toBe(tool);
	});

	it("returns undefined for unregistered tool", () => {
		const reg = new ToolRegistry();
		expect(reg.get("nope")).toBeUndefined();
	});

	it("lists registered tool names", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool("a"));
		reg.register(makeTool("b"));
		reg.register(makeTool("c"));
		expect(reg.list()).toEqual(["a", "b", "c"]);
	});

	it("getStubs returns name + description only", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool("git", "Execute git"));
		const stubs = reg.getStubs();
		expect(stubs).toEqual([{ name: "git", description: "Execute git" }]);
	});

	it("getDefinition includes full parameters", () => {
		const reg = new ToolRegistry();
		const tool = makeTool("edit_file");
		tool.parameters = { type: "object", properties: { path: { type: "string" } } };
		tool.requiresApproval = true;
		tool.layer = "dynamic_worker";
		reg.register(tool);

		const def = reg.getDefinition("edit_file");
		expect(def).toEqual({
			name: "edit_file",
			description: "Tool edit_file",
			parameters: { type: "object", properties: { path: { type: "string" } } },
			layer: "dynamic_worker",
			requires_approval: true,
		});
	});

	it("getDefinition returns undefined for missing tool", () => {
		const reg = new ToolRegistry();
		expect(reg.getDefinition("missing")).toBeUndefined();
	});

	it("overwrites tool on re-register", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool("tool", "v1"));
		reg.register(makeTool("tool", "v2"));
		expect(reg.getStubs()).toEqual([{ name: "tool", description: "v2" }]);
	});
});
