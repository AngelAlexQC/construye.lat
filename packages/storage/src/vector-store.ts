import type { VectorStore, VectorMatch } from "./types.js";

/**
 * Vectorize-backed vector store for semantic search / RAG indexing.
 * Vectorize = managed vector database on Cloudflare.
 */
export class VectorizeStore implements VectorStore {
	private index: VectorizeIndex;

	constructor(index: VectorizeIndex) {
		this.index = index;
	}

	async upsert(
		id: string,
		vector: number[],
		metadata: Record<string, string>,
	): Promise<void> {
		await this.index.upsert([{ id, values: vector, metadata }]);
	}

	async query(vector: number[], topK: number): Promise<VectorMatch[]> {
		const results = await this.index.query(vector, { topK });
		return results.matches.map((m) => ({
			id: m.id,
			score: m.score,
			metadata: (m.metadata ?? {}) as Record<string, string>,
		}));
	}

	async deleteByFilter(filter: Record<string, string>): Promise<void> {
		await this.index.deleteByMetadata(filter);
	}
}

// Cloudflare Vectorize binding types (minimal)
interface VectorizeIndex {
	upsert(vectors: { id: string; values: number[]; metadata?: Record<string, string> }[]): Promise<void>;
	query(vector: number[], options: { topK: number }): Promise<{
		matches: { id: string; score: number; metadata?: Record<string, string> }[];
	}>;
	deleteByMetadata(filter: Record<string, string>): Promise<void>;
}
