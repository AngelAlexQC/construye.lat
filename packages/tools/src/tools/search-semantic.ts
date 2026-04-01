import type { ToolHandler } from "../types.ts";
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";

/**
 * TF-IDF based semantic search over project files.
 * Zero dependencies — uses term frequency / inverse document frequency.
 */

const SEARCHABLE_EXTS = new Set([
	".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css",
	".html", ".yaml", ".yml", ".toml", ".py", ".go", ".rs",
	".sql", ".sh", ".graphql", ".txt", ".env",
]);

const IGNORE_DIRS = new Set([
	"node_modules", ".git", "dist", ".turbo", "coverage",
	".next", ".output", ".wrangler", "__pycache__",
]);

const MAX_FILE_SIZE = 100_000; // 100KB
const MAX_FILES = 500;

/** Tokenize text into words for TF-IDF */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9_\-]/g, " ")
		.split(/\s+/)
		.filter((w) => w.length >= 2 && w.length <= 50);
}

interface IndexedFile {
	path: string;
	content: string;
	tokens: string[];
	tf: Map<string, number>;
}

interface SearchResult {
	path: string;
	score: number;
	preview: string;
}

/** Build TF for a document */
function buildTF(tokens: string[]): Map<string, number> {
	const tf = new Map<string, number>();
	for (const token of tokens) {
		tf.set(token, (tf.get(token) ?? 0) + 1);
	}
	// Normalize by document length
	const len = tokens.length || 1;
	for (const [key, val] of tf) {
		tf.set(key, val / len);
	}
	return tf;
}

/** Compute IDF across all documents */
function buildIDF(docs: IndexedFile[]): Map<string, number> {
	const docCount = docs.length || 1;
	const df = new Map<string, number>();
	for (const doc of docs) {
		const seen = new Set<string>();
		for (const token of doc.tokens) {
			if (!seen.has(token)) {
				df.set(token, (df.get(token) ?? 0) + 1);
				seen.add(token);
			}
		}
	}
	const idf = new Map<string, number>();
	for (const [term, count] of df) {
		idf.set(term, Math.log(docCount / count));
	}
	return idf;
}

/** Score documents against query using TF-IDF cosine similarity */
function searchTFIDF(
	query: string,
	docs: IndexedFile[],
	maxResults: number,
): SearchResult[] {
	const queryTokens = tokenize(query);
	if (queryTokens.length === 0) return [];

	const idf = buildIDF(docs);

	// Query vector
	const queryTF = buildTF(queryTokens);

	const results: SearchResult[] = [];

	for (const doc of docs) {
		let score = 0;
		for (const qToken of queryTokens) {
			const qWeight = (queryTF.get(qToken) ?? 0) * (idf.get(qToken) ?? 0);
			const dWeight = (doc.tf.get(qToken) ?? 0) * (idf.get(qToken) ?? 0);
			score += qWeight * dWeight;
		}

		// Boost: exact substring match in path or content
		const queryLower = query.toLowerCase();
		if (doc.path.toLowerCase().includes(queryLower)) {
			score += 0.5;
		}
		if (doc.content.toLowerCase().includes(queryLower)) {
			score += 0.3;
		}

		if (score > 0) {
			// Extract preview: find best matching line
			const contentLines = doc.content.split("\n");
			let bestLine = 0;
			let bestLineScore = 0;
			for (let i = 0; i < contentLines.length; i++) {
				const lineTokens = tokenize(contentLines[i]);
				let ls = 0;
				for (const qt of queryTokens) {
					if (lineTokens.includes(qt)) ls++;
				}
				if (ls > bestLineScore) {
					bestLineScore = ls;
					bestLine = i;
				}
			}
			const start = Math.max(0, bestLine - 1);
			const end = Math.min(contentLines.length, bestLine + 4);
			const preview = contentLines
				.slice(start, end)
				.map((l, i) => `${start + i + 1}: ${l}`)
				.join("\n");

			results.push({ path: doc.path, score, preview });
		}
	}

	return results
		.sort((a, b) => b.score - a.score)
		.slice(0, maxResults);
}

/** Recursively collect searchable files */
async function collectFiles(dir: string, base: string): Promise<{ path: string; fullPath: string }[]> {
	const files: { path: string; fullPath: string }[] = [];
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (IGNORE_DIRS.has(entry.name)) continue;
			const fullPath = resolve(dir, entry.name);
			const relPath = relative(base, fullPath);
			if (entry.isDirectory()) {
				const subFiles = await collectFiles(fullPath, base);
				files.push(...subFiles);
			} else if (SEARCHABLE_EXTS.has(extname(entry.name))) {
				files.push({ path: relPath, fullPath });
			}
			if (files.length >= MAX_FILES) break;
		}
	} catch {
		// Ignore permission errors
	}
	return files;
}

export const searchSemantic: ToolHandler = {
	name: "search_semantic",
	description:
		"Semantic search across project codebase using TF-IDF. Finds files and code related to a natural language query.",
	parameters: {
		type: "object",
		properties: {
			query: { type: "string", description: "Natural language search query" },
			max_results: { type: "number", description: "Max results (default 10)" },
		},
		required: ["query"],
	},
	layer: "dynamic_worker",
	requiresApproval: false,
	async execute(args, context) {
		const query = args.query as string;
		const maxResults = (args.max_results as number) ?? 10;

		try {
			// Collect files
			const fileEntries = await collectFiles(context.workingDir, context.workingDir);

			// Index files
			const docs: IndexedFile[] = [];
			for (const entry of fileEntries) {
				try {
					const content = await readFile(entry.fullPath, "utf-8");
					if (content.length > MAX_FILE_SIZE) continue;
					const tokens = tokenize(content);
					docs.push({
						path: entry.path,
						content,
						tokens,
						tf: buildTF(tokens),
					});
				} catch {
					// Skip unreadable files
				}
			}

			// Search
			const results = searchTFIDF(query, docs, maxResults);

			if (results.length === 0) {
				return `No results found for "${query}" across ${docs.length} files.`;
			}

			return results
				.map(
					(r, i) =>
						`${i + 1}. **${r.path}** (score: ${r.score.toFixed(3)})\n${r.preview}`,
				)
				.join("\n\n");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return `[search_semantic] Error: ${msg}`;
		}
	},
};
