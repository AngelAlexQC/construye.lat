import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node22",
	platform: "node",
	outDir: "dist",
	clean: true,
	splitting: false,
	sourcemap: true,
	// Bundle all workspace packages into the CLI
	noExternal: [/^@construye\//],
	// Keep third-party deps as external (installed via npm)
	external: [
		"ink",
		"react",
		"chalk",
		"cli-highlight",
		"marked",
		"marked-terminal",
	],
	esbuildOptions(options) {
		options.jsx = "automatic";
	},
});
