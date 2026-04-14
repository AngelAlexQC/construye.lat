# CONSTRUYE.md — Project Identity & Self-Improvement Context

## Proyecto
construye.lat — AI coding agent framework, 100% on Cloudflare. Open source competitor to Claude Code, Cursor, Codex.

## Arquitectura
- Monorepo TypeScript ESM: pnpm workspaces + Turborepo
- 11 paquetes: shared, core, tools, providers, skills, storage, sandbox, worker, cli, web, browser-worker
- Agent loop: while(tool_calls) → execute → observe → self-heal → repeat
- Self-healing: logical errors → LLM reflection, transient errors → retry with backoff
- Auto-compaction al 80% del contexto
- Smart model routing por tipo de tarea (code/reasoning/fast)

## Paquetes Clave
- `packages/shared/` — Types, constants, utilities (zero deps)
- `packages/core/` — Agent loop, context engine, compaction, model router, session manager
- `packages/tools/` — 20 tools: read_file, write_file, edit_file, search_text, search_semantic, list_dir, glob, code_mode, exec, git, preview, browse, ask_user, delegate, web_search, web_fetch, web_crawl, web_extract, project_detect, task_memory
- `packages/providers/` — Anthropic Claude, OpenAI, Workers AI (streaming)
- `packages/skills/` — Skill loader, stub system
- `packages/storage/` — D1, R2, KV, Vectorize adapters
- `packages/sandbox/` — Dynamic Workers + Containers
- `packages/worker/` — Cloudflare Worker + Durable Object gateway
- `packages/cli/` — React Ink terminal UI (bin: `construye`)
- `packages/web/` — Landing page + dashboard (Vite + React)
- `packages/browser-worker/` — Deployed at construye-browser.quirozai.workers.dev

## Stack
- Runtime: Cloudflare Workers + Durable Objects
- AI: Workers AI (Kimi K2.5, QwQ-32B, Qwen3), Anthropic Claude, OpenAI
- Storage: R2 (files), D1 (SQL), KV (cache), Vectorize (embeddings)
- CLI: React Ink | Web: React + Vite + Tailwind on CF Pages
- Build: tsup → ESM | Test: Vitest | Lint: Biome

## Convenciones
- TypeScript estricto, ESM only, `.js` extensions in imports
- Archivos < 100 líneas, un archivo = una responsabilidad
- Interfaces en types.ts, implementaciones en archivos separados
- Biome: tabs, 100 width | Vitest: globals, node env
- workspace:* protocol for internal deps

## Comandos
- `pnpm install` — Install dependencies
- `pnpm turbo build` — Build all (respects dependency graph)
- `pnpm turbo test` — Run all tests
- `pnpm turbo typecheck` — Type check all
- `pnpm --filter @construye/core test` — Test single package
- `pnpm --filter construye build` — Build CLI
- `npx vitest run` — Run tests from root (alternative)

## Estado Actual (v0.2.0)
- ✅ 307+ tests passing, 0 failures
- ✅ CLI installed globally as `construye`
- ✅ Worker deployed: construye-worker.quirozai.workers.dev
- ✅ Self-healing agent loop (executeToolSmart)
- ✅ Intelligence test: agent debugs Python code in 14.7s
- ⚠️ Web package empty (needs landing page)
- ⚠️ Not yet published to npm

## Self-Improvement Log
<!-- The agent updates this section after each improvement cycle -->
| Date | Change | Impact | Tests |
|------|--------|--------|-------|
| 2026-04-02 | Added executeToolSmart self-healing | Logical errors → LLM, transient → retry | 307 pass |
| 2026-04-02 | Enhanced system prompt (3 protocols) | Better planning, verification, self-correction | 307 pass |
| 2026-04-02 | write-file verify-after-edit | Catches syntax errors post-write | 307 pass |
