export interface Env {
	DB: D1Database;
	BUCKET: R2Bucket;
	KV: KVNamespace;
	VECTORIZE: VectorizeIndex;
	QUEUE: Queue;
	AI: Ai;
	AGENT: DurableObjectNamespace;
	AI_GATEWAY_URL: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	JWT_SECRET: string;
}

export interface AuthPayload {
	userId: string;
	githubLogin: string;
	exp: number;
}

export interface ApiError {
	error: string;
	code: string;
	status: number;
}
