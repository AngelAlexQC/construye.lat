import type { Session, Project } from "@construye/shared";

export interface FileStore {
	read(key: string): Promise<Uint8Array | null>;
	write(key: string, data: Uint8Array): Promise<void>;
	delete(key: string): Promise<void>;
	list(prefix: string): Promise<string[]>;
	exists(key: string): Promise<boolean>;
}

export interface Database {
	getSession(id: string): Promise<Session | null>;
	saveSession(session: Session): Promise<void>;
	getProject(id: string): Promise<Project | null>;
	saveProject(project: Project): Promise<void>;
	query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Cache {
	get<T>(key: string): Promise<T | null>;
	set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface VectorStore {
	upsert(id: string, vector: number[], metadata: Record<string, string>): Promise<void>;
	query(vector: number[], topK: number): Promise<VectorMatch[]>;
	deleteByFilter(filter: Record<string, string>): Promise<void>;
}

export interface VectorMatch {
	id: string;
	score: number;
	metadata: Record<string, string>;
}

export interface Queue {
	send(message: unknown): Promise<void>;
	sendBatch(messages: unknown[]): Promise<void>;
}
