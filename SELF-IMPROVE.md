# Self-Improvement Prompt for construye.lat

Copia y pega esto en el CLI:

```
construye --provider workers-ai --model kimi-k2.5 --mode auto
```

Luego pega este prompt:

---

You are working on your OWN codebase — construye.lat, an AI coding agent. Your job is to make yourself better. This is a self-improvement cycle inspired by SICA (Self-Improving Coding Agent, arxiv 2504.15228).

STEP 1 — EXPLORE: Read CONSTRUYE.md to understand the project. Then read packages/core/src/agent-loop.ts and packages/core/src/context-engine.ts. These files ARE you — they control how you think, act, and recover from errors.

STEP 2 — IDENTIFY: Find ONE concrete improvement. Pick the highest-impact change from this list:
- Detect infinite tool loops (same tool called 3+ times with same args = stuck, inject a "try something different" nudge)
- Add token usage tracking in the agent loop (count input/output tokens per turn, log totals at end)
- Truncate large tool results (if a read_file returns 5000+ chars, summarize to save context window)
- Add per-tool execution timing (track ms per tool call, useful for profiling)
- Improve compaction to preserve the first user message and last 3 tool results (critical context)

STEP 3 — IMPLEMENT: Make the change. Rules:
- Only edit files in packages/core/src/ or packages/shared/src/
- Keep it under 50 lines of new code
- Do NOT break existing interfaces or exports
- Simple, correct code > clever abstractions

STEP 4 — VERIFY: Run `npx vitest run` from the project root. ALL tests must pass. If any fail, fix them immediately. Do not stop until tests are green.

STEP 5 — DOCUMENT: Edit CONSTRUYE.md and append a new row to the Self-Improvement Log table at the bottom with today's date (2026-04-03), what you changed, the impact, and test count.

Start now. Read CONSTRUYE.md first.
