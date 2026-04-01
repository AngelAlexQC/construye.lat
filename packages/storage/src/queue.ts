import type { Queue } from "./types.ts";

/**
 * Queues-backed message queue for async task processing.
 * Queues = durable message queue on Cloudflare.
 */
export class CFQueue implements Queue {
	private queue: QueueBinding;

	constructor(queue: QueueBinding) {
		this.queue = queue;
	}

	async send(message: unknown): Promise<void> {
		await this.queue.send(message);
	}

	async sendBatch(messages: unknown[]): Promise<void> {
		const batch = messages.map((body) => ({ body }));
		await this.queue.sendBatch(batch);
	}
}

// Cloudflare Queue binding type (minimal)
interface QueueBinding {
	send(message: unknown): Promise<void>;
	sendBatch(messages: { body: unknown }[]): Promise<void>;
}
