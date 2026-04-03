# 🏗️ construye.lat

**Framework de agentes de código IA que corre 100% en Cloudflare.**

Framework open-source para construir agentes de código IA — CLI local, ejecución en la nube en el edge de Cloudflare, soporte multi-modelo, y sistema de skills extensible.

## Live Demo

| Servicio | URL |
|----------|-----|
| Web Dashboard | https://construye-web.pages.dev |
| Worker API | https://construye-worker.quirozai.workers.dev |
| Browser Worker | https://construye-browser.quirozai.workers.dev |

## Arquitectura

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  CLI (Ink)   │───▶│  CF Worker    │───▶│  Browser Worker  │
│  Web (React) │    │  + Durable    │    │  (Puppeteer)     │
└─────────────┘    │  Object       │    └─────────────────┘
                   └──────┬───────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
          ┌───▼──┐   ┌───▼──┐   ┌───▼───┐
          │  D1  │   │  AI  │   │  KV   │
          │  SQL │   │ bind │   │ Cache │
          └──────┘   └──────┘   └───────┘
```

## Paquetes

| Paquete | Descripción |
|---------|-------------|
| `@construye/shared` | Tipos, constantes, utilidades |
| `@construye/core` | Agent loop, compaction, model router |
| `@construye/tools` | 18 herramientas + registry |
| `@construye/providers` | AI Gateway, Claude, OpenAI, Workers AI |
| `@construye/skills` | Matching, carga, instalación de skills |
| `@construye/storage` | D1, KV, cache, vector store |
| `@construye/sandbox` | Dynamic Workers + Container execution |
| `@construye/worker` | Cloudflare Worker + Durable Object |
| `@construye/browser-worker` | Proxy Puppeteer + Workers AI |
| `@construye/cli` | App terminal (React Ink) |
| `@construye/web` | Web dashboard (React + Vite + Tailwind) |

## Quick Start

```bash
# Instalar dependencias
pnpm install

# Build todos los paquetes
pnpm turbo build

# Correr CLI
pnpm --filter @construye/cli dev

# Correr worker local
pnpm --filter @construye/worker dev

# Correr web local
pnpm --filter @construye/web dev

# Correr tests
pnpm turbo test
```

## Deploy

```bash
# Worker principal (requiere secrets configurados)
cd packages/worker
wrangler secret put JWT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler deploy

# Browser worker
cd packages/browser-worker
wrangler secret put AUTH_KEY
wrangler deploy

# Web dashboard
cd packages/web
VITE_API_URL=https://tu-worker.workers.dev npx vite build
wrangler pages deploy dist --project-name construye-web
```

## Modelos IA

Usa Workers AI con modelos gratuitos:

| Tipo | Modelo | Uso |
|------|--------|-----|
| Heavy | `@cf/moonshot/kimi-k2.5` | Código complejo, arquitectura |
| Reasoning | `@cf/qwen/qwq-32b` | Análisis, debugging |
| Fast | `@cf/qwen/qwen3-coder-30b-a3b` | Completions rápidos |
| General | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Tareas generales |

## Features

- **Streaming en WebSocket**: Respuestas incrementales via Durable Objects
- **18 Herramientas**: file_read, file_write, exec, web_fetch, web_search, task_memory, etc.
- **Smart Model Routing**: Modelo correcto para cada tipo de tarea
- **Auto-Compaction**: Resume historial al 80% de capacidad de contexto
- **Sistema de Skills**: Extensible con skills específicos por proyecto
- **Multi-Provider**: Claude, OpenAI, Workers AI via AI Gateway
- **Auth**: GitHub OAuth + JWT
- **Rate Limiting**: Token bucket per-user
- **Cloud-Native**: Todo en el edge de Cloudflare

## Tests

```
243 tests passing | 16 test files | 0 failures
```

## Stack Técnico

- **Runtime**: Cloudflare Workers + Durable Objects
- **IA**: Workers AI (Kimi K2.5, QwQ-32B, Qwen3) + AI Gateway
- **Storage**: D1 (SQL), KV (cache)
- **Browser**: Puppeteer via @cloudflare/puppeteer
- **CLI**: React Ink + TypeScript
- **Web**: React 19 + Vite 6 + Tailwind CSS 4
- **Build**: pnpm + Turborepo
- **Test**: Vitest
- **Lint**: Biome

## Licencia

MIT
