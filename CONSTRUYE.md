# CONSTRUYE.md — Identidad del Proyecto

## Proyecto
construye.lat — Framework y suite de agentes de código IA que corren 100% en Cloudflare.

## Arquitectura
- Monorepo TypeScript ESM con pnpm workspaces + Turborepo
- 10 paquetes: shared, core, tools, providers, skills, storage, sandbox, worker, cli, web
- Ejecución híbrida: Dynamic Workers (rápido) + Containers (pesado)
- Agent loop inspirado en Claude Code: while(tool_call)
- Auto-compaction al 80% del contexto
- Smart model routing por tipo de tarea
- Code Mode para batch de operaciones (81% ahorro tokens)

## Stack
- Runtime: Cloudflare Workers + Durable Objects
- IA: AI Gateway → Claude, OpenAI, Workers AI
- Storage: R2 (archivos), D1 (SQL), KV (cache), Vectorize (RAG), Queues (async)
- Sandbox: Dynamic Workers + Containers + Browser Rendering
- CLI: React Ink
- Web: React + Vite + TailwindCSS en CF Pages
- Auth: GitHub OAuth + JWT

## Convenciones
- Archivos < 100 líneas
- TypeScript estricto (ES2022 target, ESNext modules)
- Biome para lint/format (tabs, 100 width)
- Vitest para testing
- Un archivo = una responsabilidad
- Interfaces en types.ts, implementaciones en archivos separados

## Comandos
- `pnpm install` — Instalar dependencias
- `pnpm turbo build` — Build todos los paquetes
- `pnpm turbo test` — Tests todos los paquetes
- `pnpm turbo typecheck` — Type check
- `pnpm --filter @construye/worker dev` — Dev server del worker
- `pnpm --filter @construye/cli dev` — CLI en modo desarrollo
- `pnpm --filter @construye/web dev` — Web UI en modo desarrollo
