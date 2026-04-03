import type { ContainerExecutor } from "./manager.ts";
import type { SandboxResult, SandboxOptions } from "./types.ts";

/**
 * Container execution: heavy path for shell commands, builds, tests.
 * Uses Cloudflare Containers when available, falls back to local execution.
 */
export class Container implements ContainerExecutor {
	private containerId: string | null = null;
	private containerUrl: string | null = null;
	private containerBinding: ContainerBinding | null;

	constructor(containerBinding?: ContainerBinding) {
		this.containerBinding = containerBinding ?? null;
	}

	async run(command: string, options?: SandboxOptions): Promise<SandboxResult> {
		const startTime = Date.now();

		// If we have a container binding (CF Containers), use it
		if (this.containerBinding) {
			return this.runInContainer(command, options, startTime);
		}

		// Fallback: execute locally via child_process (for CLI mode)
		return this.runLocally(command, options, startTime);
	}

	async destroy(): Promise<void> {
		if (this.containerId && this.containerBinding) {
			try {
				await this.containerBinding.destroy(this.containerId);
			} catch {
				// Already destroyed or timeout
			}
		}
		this.containerId = null;
		this.containerUrl = null;
	}

	private async runInContainer(
		command: string,
		options: SandboxOptions | undefined,
		startTime: number,
	): Promise<SandboxResult> {
		try {
			// Ensure container is running
			if (!this.containerId) {
				const spawned = await this.containerBinding!.spawn({
					image: "node:22-slim",
					env: options?.env,
				});
				this.containerId = spawned.id;
				this.containerUrl = spawned.url;
			}

			// Execute command in the container
			const res = await fetch(`${this.containerUrl}/exec`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					command,
					workingDir: options?.workingDir ?? "/workspace",
					timeout: options?.timeout ?? 60_000,
				}),
			});

			const data = (await res.json()) as { output: string; exitCode: number };
			return {
				output: data.output,
				exitCode: data.exitCode,
				duration: Date.now() - startTime,
			};
		} catch (err) {
			return {
				output: `Container error: ${err instanceof Error ? err.message : String(err)}`,
				exitCode: 1,
				duration: Date.now() - startTime,
			};
		}
	}

	private async runLocally(
		command: string,
		options: SandboxOptions | undefined,
		startTime: number,
	): Promise<SandboxResult> {
		try {
			const { exec } = await import("node:child_process");
			const { promisify } = await import("node:util");
			const execAsync = promisify(exec);

			const result = await execAsync(command, {
				cwd: options?.workingDir,
				timeout: options?.timeout ?? 60_000,
				env: options?.env ? { ...process.env, ...options.env } : undefined,
				maxBuffer: 5 * 1024 * 1024, // 5MB for heavy commands
			});

			return {
				output: (result.stdout + result.stderr).trim(),
				exitCode: 0,
				duration: Date.now() - startTime,
			};
		} catch (err) {
			const execErr = err as { code?: number; stdout?: string; stderr?: string; message?: string };
			return {
				output: (execErr.stderr || execErr.stdout || execErr.message || String(err)).trim(),
				exitCode: typeof execErr.code === "number" ? execErr.code : 1,
				duration: Date.now() - startTime,
			};
		}
	}
}

/** Cloudflare Container binding (minimal type) */
interface ContainerBinding {
	spawn(options: { image: string; env?: Record<string, string> }): Promise<{ id: string; url: string }>;
	destroy(id: string): Promise<void>;
}
