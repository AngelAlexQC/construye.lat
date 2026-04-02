# construye.lat — AI Coding Agent Framework

> 100% Cloudflare · Monorepo · pnpm + Turborepo

## What Is construye.lat

construye.lat is an AI coding agent framework built entirely on the Cloudflare stack. It provides a CLI (local) and a SaaS platform (browser) for AI-assisted coding with pluggable providers, real tool execution, and persistent storage — all running on Workers, D1, R2, KV, and Vectorize.

**Core stats:**
- **Monorepo:** pnpm workspaces + Turborepo
- **Packages:** 11 (shared, core, tools, providers, skills, storage, sandbox, worker, cli, web, browser-worker)
- **LOC:** 14,795 across 96 files
- **Tools:** 20 real, implemented tools
- **Providers:** Claude (Anthropic API) + Workers AI
- **Tests:** 114 tests across 12 files, ~950ms (Vitest)
- **CLI:** React Ink interface, works locally today

## Market

| Metric | Value |
|---|---|
| AI Coding Tools market (2026) | $8.5B |
| Projected (2032) | $30B+ |
| Claude Code ARR | $2.5B |
| Cursor valuation | $2B+ |

**Key players:** GitHub Copilot (Microsoft), Cursor (Anysphere), Claude Code (Anthropic), Windsurf (Codeium), Devin (Cognition).

## Differentiator

### Cloudflare-Native = 91.6% Cheaper

| Metric | Claude Code | construye.lat (Workers AI) |
|---|---|---|
| Per-request cost | ~$0.012 | ~$0.001 |
| Cost reduction | — | **91.6%** |
| Infrastructure | Anthropic servers | Cloudflare edge (300+ cities) |
| Latency | Single region | Edge-local |
| Lock-in | Anthropic only | Multi-provider (Claude + Workers AI + extensible) |

**Why construye.lat wins:**
1. **Cost:** Workers AI models at fraction of API costs. Pass savings to users or keep as margin.
2. **Edge:** Code runs on Cloudflare's edge network — lower latency worldwide.
3. **Multi-provider:** Not locked to one AI vendor. Claude for quality, Workers AI for cost, swap freely.
4. **Cloudflare primitives:** D1, R2, KV, Vectorize, Durable Objects — no external infra to manage.
5. **LATAM focus:** `construye.lat` domain, Spanish-first positioning, underserved market.

## Architecture

```
packages/
├── shared/          # Types, constants, utilities
├── core/            # Agent loop, message handling, orchestration
├── tools/           # 20 implemented tools (file ops, search, shell, etc.)
├── providers/       # Claude (Anthropic) + Workers AI
├── skills/          # Skill system (stubs — needs runtime)
├── storage/         # D1, R2, KV, Vectorize adapters
├── sandbox/         # Code execution sandbox (placeholder)
├── worker/          # Cloudflare Worker gateway + Durable Object
├── cli/             # React Ink CLI interface
├── web/             # Web frontend (empty)
└── browser-worker/  # Deployed at construye-browser.quirozai.workers.dev
```

## Pricing Concept

| Tier | Price | Target |
|---|---|---|
| **Free CLI** | $0 | Developers, local use with own API keys |
| **Pro** | $19/mo | Individual devs, SaaS access, 500K tokens/mo Workers AI included |
| **Team** | $49/mo per seat | Teams, shared context, admin controls, 2M tokens/mo per seat |

**Margin model:** Workers AI cost ~$0.001/request. At Pro $19/mo with average 5K requests/mo = $5 cost, **73% margin**.

## Current Status

| Component | Status | Readiness |
|---|---|---|
| CLI (local) | Works with Claude + Workers AI | 70% |
| Core agent loop | Functional | 75% |
| Tools (20) | Implemented, tested | 80% |
| Providers | Claude + Workers AI working | 80% |
| Storage adapters | D1/R2/KV/Vectorize coded | 60% |
| Tests | 114 passing, ~950ms | 80% |
| browser-worker | Deployed | 90% |
| Worker (gateway DO) | NOT deployed (D1/KV IDs empty) | 20% |
| Skills runtime | Stubs only | 10% |
| Billing | None | 0% |
| Web frontend | Empty | 0% |
| npm published | No | 0% |

**Overall: CLI 70%, SaaS 20%**

## Blockers

1. **npm publish:** CLI package not published. Need package.json cleanup, README, `npx construye` entry point.
2. **Worker deployment:** D1 database and KV namespace IDs are empty in wrangler.toml. Need `wrangler d1 create` + `wrangler kv:namespace create`.
3. **Skills runtime:** Only stubs exist. Need skill loading, execution, and context injection.
4. **Billing:** Zero billing code. Need Stripe integration for Pro/Team tiers.
5. **Landing page:** `construye.lat` domain exists but web package is empty.
6. **No .github/ directory:** No CI/CD, no issue templates, no copilot instructions.

## Key Metrics to Track

- npm weekly installs (CLI)
- Active CLI sessions / commands per day
- SaaS MAU
- Free → Pro conversion rate (target: 4–6%)
- Workers AI cost per user per month
- Token usage per session
- MRR
