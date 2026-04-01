import type { FileStore } from "./types.js";

/**
 * R2-backed file store for project files and artifacts.
 * R2 = S3-compatible object storage on Cloudflare.
 */
export class R2FileStore implements FileStore {
	private bucket: R2Bucket;

	constructor(bucket: R2Bucket) {
		this.bucket = bucket;
	}

	async read(key: string): Promise<Uint8Array | null> {
		const obj = await this.bucket.get(key);
		if (!obj) return null;
		return new Uint8Array(await obj.arrayBuffer());
	}

	async write(key: string, data: Uint8Array): Promise<void> {
		await this.bucket.put(key, data);
	}

	async delete(key: string): Promise<void> {
		await this.bucket.delete(key);
	}

	async list(prefix: string): Promise<string[]> {
		const listed = await this.bucket.list({ prefix });
		return listed.objects.map((o) => o.key);
	}

	async exists(key: string): Promise<boolean> {
		const obj = await this.bucket.head(key);
		return obj !== null;
	}
}

// Cloudflare R2 binding type (minimal)
interface R2Bucket {
	get(key: string): Promise<R2Object | null>;
	put(key: string, data: Uint8Array | string): Promise<void>;
	delete(key: string): Promise<void>;
	head(key: string): Promise<R2Object | null>;
	list(options: { prefix: string }): Promise<{ objects: { key: string }[] }>;
}

interface R2Object {
	arrayBuffer(): Promise<ArrayBuffer>;
}
