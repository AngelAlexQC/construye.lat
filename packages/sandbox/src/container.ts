import type { ContainerExecutor } from "./manager.js";
import type { SandboxResult, SandboxOptions } from "./types.js";

/**
 * Container execution: heavy path for shell commands, builds, tests.
 * Uses Cloudflare Containers (or Sandbox SDK) for full Linux environment.
 */
export class Container implements ContainerExecutor {
	private containerId: string | null = null;

	async run(command: string, options?: SandboxOptions): Promise<SandboxResult> {
		if (!this.containerId) {
			this.containerId = await this.spawn();
		}
		// Placeholder: will exec command inside container
		return {
			output: `[Container ${this.containerId}: ${command}]`,
			exitCode: 0,
			duration: 0,
		};
	}

	async destroy(): Promise<void> {
		if (this.containerId) {
			// Placeholder: will destroy container
			this.containerId = null;
		}
	}

	private async spawn(): Promise<string> {
		// Placeholder: will spawn a Cloudflare Container
		return `container-${Date.now()}`;
	}
}
