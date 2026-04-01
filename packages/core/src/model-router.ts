import type { TaskType, ModelConfig, Message } from "@construye/shared";
import { DEFAULT_MODELS, MODEL_CONTEXT_SIZES, WORKERS_AI_MODEL_MAP } from "@construye/shared";

/** Classify a user message into a task type for model routing */
export function classifyTask(message: string, history?: Message[]): TaskType {
	const lower = message.toLowerCase();

	// Simple/short queries — greetings, questions about itself, brief queries
	if (lower.length < 80 && /^(hola|hi|hey|hello|qué|que|who|what are|cómo|como estás|help)(?!\w)/.test(lower)) {
		return "simple_query";
	}

	// Reasoning: debugging, architecture, complex analysis, explanations
	const reasoningPatterns = /\b(debug|why|explain|analy[zs]|analiz|architect|refactor|optimiz|diagnos|invest?ig|compare|evaluat|trade.?off|root cause|por ?qué|razón)/;
	if (reasoningPatterns.test(lower)) return "reasoning";

	// Planning: create plan, break down, steps, strategy, design flows
	const planningPatterns = /\b(plan|steps|break down|how would|approach|strateg|roadmap|design|diseñ[ao]|implementa|migrat)/;
	if (planningPatterns.test(lower)) return "planning";

	// File ops: simple reads, searches, listings
	const fileOpsPatterns = /\b(list|find|search|show|read|cat|where is|busca|muestra|encuentra|what files|ls|tree)\b/;
	if (fileOpsPatterns.test(lower)) return "file_ops";

	// Check history for ongoing coding context
	if (history?.length && history.some(m => m.tool_calls?.some(tc => ["edit_file", "write_file", "code_mode"].includes(tc.name)))) {
		return "coding";
	}

	// Default: coding tasks (most common)
	return "coding";
}

/** Get the recommended model config for a task type */
export function getModelForTask(
	taskType: TaskType,
	overrides?: Partial<Record<TaskType, string>>,
): ModelConfig {
	const modelName = overrides?.[taskType] ?? DEFAULT_MODELS[taskType] ?? WORKERS_AI_MODEL_MAP.heavy;

	return {
		provider: inferProvider(modelName),
		model: modelName,
		temperature: getTemperatureForTask(taskType),
		max_tokens: getMaxTokensForTask(taskType),
	};
}

function getTemperatureForTask(taskType: TaskType): number {
	switch (taskType) {
		case "reasoning": return 0.3;
		case "coding": return 0.1;
		case "planning": return 0.2;
		case "compaction": return 0.0;
		case "simple_query": return 0.4;
		case "file_ops": return 0.0;
		default: return 0.1;
	}
}

function getMaxTokensForTask(taskType: TaskType): number {
	switch (taskType) {
		case "reasoning": return 8192;
		case "coding": return 8192;
		case "planning": return 4096;
		case "compaction": return 2048;
		case "simple_query": return 1024;
		case "file_ops": return 4096;
		default: return 8192;
	}
}

function inferProvider(model: string): import("@construye/shared").ProviderName {
	if (model.startsWith("@cf/") || model.startsWith("@hf/")) return "workers-ai";
	if (model.startsWith("claude")) return "claude";
	if (model.startsWith("gpt") || model.startsWith("codex")) return "openai";
	return "workers-ai";
}
