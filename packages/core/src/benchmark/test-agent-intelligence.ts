#!/usr/bin/env npx tsx
/**
 * Test: give the agent a REAL debugging task and see if it solves it.
 * Bypasses Ink UI — runs the agent loop directly with Workers AI.
 */
import { runAgentLoop } from "../agent-loop.ts";
import { WorkersAIProvider, WORKERS_AI_MODELS } from "../../../providers/src/index.ts";
import { createDefaultRegistry, type ToolContext } from "../../../tools/src/index.ts";
import type { AgentConfig } from "../types.ts";
import type { ToolCall, StreamChunk, Message } from "../../../shared/src/index.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Read wrangler OAuth token ──────────────────────────
async function getToken(): Promise<{ accountId: string; token: string }> {
	const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const cfToken = process.env.CLOUDFLARE_API_TOKEN;
	if (cfAccountId && cfToken) return { accountId: cfAccountId, token: cfToken };

	const paths = [
		path.join(os.homedir(), ".wrangler", "config", "default.toml"),
		path.join(os.homedir(), ".config", ".wrangler", "config", "default.toml"),
	];
	for (const p of paths) {
		try {
			const content = fs.readFileSync(p, "utf-8");
			const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
			if (match?.[1]) {
				// Auto-detect account ID  
				const resp = await fetch("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5", {
					headers: { Authorization: `Bearer ${match[1]}` },
				});
				const data = await resp.json() as { result?: { id: string }[] };
				return { accountId: data.result?.[0]?.id ?? "", token: match[1] };
			}
		} catch { /* not found */ }
	}
	throw new Error("No Cloudflare credentials found. Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN or run 'npx wrangler login'.");
}

async function main() {
	const { accountId, token } = await getToken();
	const provider = new WorkersAIProvider(accountId, token);
	const modelAlias = process.argv[2] ?? "kimi-k2.5";
	const modelId = WORKERS_AI_MODELS[modelAlias] ?? modelAlias;
	
	// Set up working directory with the challenge
	const workDir = "/tmp/test-construye";
	fs.mkdirSync(workDir, { recursive: true });

	// Create the buggy file
	fs.writeFileSync(path.join(workDir, "challenge.py"), `# BUG: This function should return the longest palindromic substring
# but it has bugs. Fix them all.

def longest_palindrome(s):
    if len(s) == 0:
        return ""
    
    longest = s[0]
    
    for i in range(len(s)):
        for j in range(i, len(s)):
            substr = s[i:j]  # BUG: off-by-one, s[i:j] excludes index j
            if substr == substr[::-1]:
                if len(substr) > len(longest):
                    longest = substr
    
    return longest

# Expected output:
# xracecarx  (the whole string is a palindrome)
# bab  (or aba — both are valid)
# bb
# a
# (empty line)
print(longest_palindrome("xracecarx"))
print(longest_palindrome("babad"))
print(longest_palindrome("abbc"))
print(longest_palindrome("a"))
print(longest_palindrome(""))
`);

	// Set up tool registry
	const registry = createDefaultRegistry();
	const toolContext: ToolContext = {
		workingDir: workDir,
		sessionId: "test-intelligence",
		projectId: "test",
	};

	const tools = registry.list().map((name) => {
		const def = registry.getDefinition(name);
		if (!def) return null;
		return { name: def.name, description: def.description, input_schema: def.parameters };
	}).filter(Boolean);

	const toolExecutor = {
		async execute(call: ToolCall) {
			const handler = registry.get(call.name);
			if (!handler) return { tool_call_id: call.id, content: `Unknown tool: ${call.name}`, is_error: true };
			try {
				const result = await handler.execute(call.arguments, toolContext);
				return { tool_call_id: call.id, content: result };
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return { tool_call_id: call.id, content: `Error: ${msg}`, is_error: true };
			}
		},
		needsApproval() { return false; }, // auto mode
	};

	const skillLoader = {
		getStubs: () => [],
		activate: async () => "Skill not loaded",
		loadReference: async () => "",
	};

	// Stream callback — print everything in real time
	const onStream: (chunk: StreamChunk) => void = (chunk) => {
		if (chunk.type === "text" && chunk.content) {
			process.stdout.write(chunk.content);
		}
		if (chunk.type === "tool_call" && chunk.tool_call) {
			console.log(`\n🔧 Tool: ${chunk.tool_call.name}(${JSON.stringify(chunk.tool_call.arguments).slice(0, 200)})`);
		}
		if (chunk.type === "error") {
			console.error(`\n❌ Error: ${chunk.error}`);
		}
	};

	const config: AgentConfig = {
		provider: {
			chat: (messages: Message[], tools?: unknown[]) =>
				provider.stream(messages, { provider: "workers-ai", model: modelId, max_tokens: 4096 }, tools),
		},
		modelConfig: {
			provider: "workers-ai",
			model: modelId,
			max_tokens: 4096,
		},
		tools,
		toolExecutor,
		skillLoader,
		onStream,
		maxTurns: 10,
	};

	console.log(`\n${"═".repeat(60)}`);
	console.log(`  🧠 construye.lat Intelligence Test`);
	console.log(`  Model: ${modelAlias} (${modelId})`);
	console.log(`  Task: Fix buggy Python code + verify`);
	console.log(`${"═".repeat(60)}\n`);

	const startTime = Date.now();
	
	const prompt = `Read the file challenge.py in the current directory. It has a bug (off-by-one in the slice). Fix the bug, then run 'python3 challenge.py' to verify the output matches the expected comments. Show me the result.`;

	const messages = await runAgentLoop(prompt, [], config);

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

	console.log(`\n\n${"═".repeat(60)}`);
	console.log(`  ⏱  Completed in ${elapsed}s`);
	console.log(`  📊 ${messages.length} messages exchanged`);

	// Verify: did it actually fix the file?
	const finalCode = fs.readFileSync(path.join(workDir, "challenge.py"), "utf-8");
	const hasFixedSlice = finalCode.includes("j+1") || finalCode.includes("j + 1") || !finalCode.includes("s[i:j]  # BUG");
	
	// Run python to verify
	const { execSync } = await import("node:child_process");
	let output = "";
	try {
		output = execSync("python3 challenge.py", { cwd: workDir, encoding: "utf-8", timeout: 5000 });
	} catch (e: unknown) {
		output = e instanceof Error && "stdout" in e ? (e as { stdout: string }).stdout : "EXECUTION FAILED";
	}

	const lines = output.trim().split("\n");
	// xracecarx is itself a palindrome — the correct longest
	const check1 = lines[0] === "xracecarx";
	const check2 = lines[1] === "bab" || lines[1] === "aba";
	const check3 = lines[2] === "bb";
	const check4 = lines[3] === "a";

	console.log(`\n  ✅ File modified: ${hasFixedSlice}`);
	console.log(`  ✅ Output[0]="xracecarx": ${check1}`);
	console.log(`  ✅ Output[1]="bab|aba": ${check2}`);
	console.log(`  ✅ Output[2]="bb": ${check3}`);
	console.log(`  ✅ Output[3]="a": ${check4}`);
	console.log(`  📝 Final output:\n${output}`);
	
	const passed = hasFixedSlice && check1 && check2 && check3 && check4;
	console.log(`\n  ${"═".repeat(56)}`);
	console.log(`  ${passed ? "🏆 PASSED — Agent successfully debugged and fixed the code!" : "❌ FAILED — Agent did not fix the bugs correctly"}`);
	console.log(`  ${"═".repeat(56)}\n`);

	process.exit(passed ? 0 : 1);
}

main().catch(console.error);
