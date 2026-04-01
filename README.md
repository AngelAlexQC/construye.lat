# 🏗️ construye.lat

**AI coding agent framework that runs 100% on Cloudflare.**

Open-source framework for building AI coding agents — local CLI, cloud execution on Cloudflare's edge, multi-model support, and a skills system for extensibility.

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  CLI (Ink)   │───▶│  CF Worker    │───▶│  Dynamic Worker  │ fast path
│  Web (React) │    │  + Durable    │    │  Container       │ heavy path
└─────────────┘    │  Object       │    │  Browser         │ browser
                   └──────┬───────┘    └─────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
          ┌───▼──┐   ┌───▼──┐   ┌───▼───┐
          │  D1  │   │  R2  │   │  KV   │
          │  SQL │   │ Files│   │ Cache │
          └──────┘   └──────┘   └───────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@construye/shared` | Types, constants, utilities |
| `@construye/core` | Agent loop, compaction, model router |
| `@construye/tools` | 14 tool handlers + registry |
| `@construye/providers` | AI Gateway, Claude, OpenAI, Workers AI |
| `@construye/skills` | Skill matching, loading, installation |
| `@construye/storage` | R2, D1, KV, Vectorize, Queues |
| `@construye/sandbox` | Dynamic Workers + Container execution |
| `@construye/worker` | Cloudflare Worker + Durable Object |
| `@construye/cli` | Terminal app (React Ink) |
| `@construye/web` | Web dashboard (React + Vite) |

## Quick Start

```bash
# Install
pnpm install

# Build all packages
pnpm turbo build

# Run CLI
pnpm --filter @construye/cli dev

# Run worker locally
pnpm --filter @construye/worker dev

# Run web locally
pnpm --filter @construye/web dev

# Run tests
pnpm turbo test
```

## Key Features

- **Hybrid Execution**: 70% ops on Dynamic Workers (<5ms), 30% on Containers
- **Code Mode**: Batch file operations in one round-trip (81% token savings)
- **Smart Model Routing**: Right model for each task type
- **Auto-Compaction**: Summarizes history at 80% context capacity
- **Skills System**: Extensible with project-specific skills
- **Multi-Provider**: Claude, OpenAI, Workers AI via AI Gateway
- **Cloud-Native**: Everything on Cloudflare's edge

## License

MIT
