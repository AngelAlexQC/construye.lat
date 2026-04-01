import type { TaskType, ModelConfig } from "@construye/shared";
import { DEFAULT_MODELS } from "@construye/shared";

/** Classify a user message into a task type for model routing */
export function classifyTask(message: string): TaskType {
	const lower = message.toLowerCase();

	// Reasoning: debugging, architecture, complex analysis
	const reasoningPatterns = /\b(debug|why|explain|architect|design|refactor|optimize|analyze)\b/;
	if (reasoningPatterns.test(lower)) return "reasoning";

	// File ops: simple reads, searches, listings
	const fileOpsPatterns = /\b(list|find|search|show|read|what files|where is)\b/;
	if (fileOpsPatterns.test(lower)) return "file_ops";

	// Planning: create plan, break down, steps
	const planningPatterns = /\b(plan|steps|break down|how would|approach|strategy)\b/;
	if (planningPatterns.test(lower)) return "planning";

	// Default: coding tasks (most common)
	return "coding";
}

/** Get the recommended model config for a task type */
export function getModelForTask(
	taskType: TaskType,
	overrides?: Partial<Record<TaskType, string>>,
): ModelConfig {
	const modelName = overrides?.[taskType] ?? DEFAULT_MODELS[taskType] ?? DEFAULT_MODELS.coding;

	return {
		provider: inferProvider(modelName),
		model: modelName,
		temperature: taskType === "reasoning" ? 0.3 : 0.1,
		max_tokens: taskType === "planning" ? 4096 : 8192,
	};
}

function inferProvider(model: string): import("@construye/shared").ProviderName {
	if (model.startsWith("claude")) return "claude";
	if (model.startsWith("gpt") || model.startsWith("codex")) return "openai";
	if (model.startsWith("llama") || model.startsWith("qwen") || model.startsWith("bge")) return "workers-ai";
	return "ai_gateway";
}
