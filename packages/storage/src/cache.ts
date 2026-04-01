import type { Cache } from "./types.js";

/**
 * KV-backed cache for session metadata, tool stubs, and fast lookups.
 * KV = globally replicated key-value store on Cloudflare.
 */
export class KVCache implements Cache {
	private kv: KVNamespace;
	private prefix: string;

	constructor(kv: KVNamespace, prefix = "cache:") {
		this.kv = kv;
		this.prefix = prefix;
	}

	async get<T>(key: string): Promise<T | null> {
		const value = await this.kv.get(this.prefix + key, "json");
		return value as T | null;
	}

	async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
		const options: KVPutOptions = {};
		if (ttlSeconds) options.expirationTtl = ttlSeconds;
		await this.kv.put(this.prefix + key, JSON.stringify(value), options);
	}

	async delete(key: string): Promise<void> {
		await this.kv.delete(this.prefix + key);
	}
}

// Cloudflare KV binding types (minimal)
interface KVNamespace {
	get(key: string, type: "json"): Promise<unknown>;
	put(key: string, value: string, options?: KVPutOptions): Promise<void>;
	delete(key: string): Promise<void>;
}

interface KVPutOptions {
	expirationTtl?: number;
}
