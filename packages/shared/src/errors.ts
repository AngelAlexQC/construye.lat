/** Base error class for all construye errors */
export class ConstruyeError extends Error {
	constructor(
		message: string,
		public code: ErrorCode,
		public statusCode = 500,
	) {
		super(message);
		this.name = "ConstruyeError";
	}
}

export type ErrorCode =
	| "AUTH_REQUIRED"
	| "AUTH_INVALID"
	| "RATE_LIMITED"
	| "BUDGET_EXCEEDED"
	| "SESSION_NOT_FOUND"
	| "PROJECT_NOT_FOUND"
	| "TOOL_NOT_FOUND"
	| "TOOL_EXECUTION_FAILED"
	| "SANDBOX_TIMEOUT"
	| "MODEL_UNAVAILABLE"
	| "COMPACTION_FAILED"
	| "SKILL_NOT_FOUND"
	| "APPROVAL_DENIED"
	| "INTERNAL_ERROR";

export class AuthError extends ConstruyeError {
	constructor(message = "Authentication required") {
		super(message, "AUTH_REQUIRED", 401);
	}
}

export class RateLimitError extends ConstruyeError {
	constructor(message = "Rate limit exceeded") {
		super(message, "RATE_LIMITED", 429);
	}
}

export class BudgetError extends ConstruyeError {
	constructor(message = "Token budget exceeded") {
		super(message, "BUDGET_EXCEEDED", 402);
	}
}

export class ToolError extends ConstruyeError {
	constructor(tool: string, message: string) {
		super(`Tool '${tool}': ${message}`, "TOOL_EXECUTION_FAILED", 500);
	}
}
