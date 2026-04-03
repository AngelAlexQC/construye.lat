# construye.lat — Roadmap

> Última actualización: 7 de Abril 2026
> Stack: Turborepo + Cloudflare Workers + D1 + KV + R2 + Hono v4
> Pago: **Stripe** (primario) + **PayPhone** (LATAM opcional) — `@quirozai/payphone`
> Dominio: construye.lat

---

## M0: Ship the CLI (Abr 7 → May 18, 2026)

**Goal:** `npx construye` works for any developer. First external users.

### npm Publish
- [ ] Clean up `packages/cli/package.json`: name `construye`, bin entry, description, keywords
- [ ] Add `packages/cli/README.md`: installation, usage, examples, provider setup
- [ ] Set up npm org `@construye` or publish as `construye`
- [ ] Verify `npx construye` works on clean machine (macOS, Linux, Windows via WSL)
- [ ] Add `--version`, `--help`, `--provider` flags
- [ ] Provider setup wizard: `construye init` (configure API keys, default provider)

### README & Docs
- [ ] Root `README.md`: project overview, architecture diagram, quickstart
- [ ] Each package: one-paragraph README with purpose, API surface, usage
- [ ] `CONTRIBUTING.md`: setup guide, PR conventions, test requirements

### CI/CD
- [ ] GitHub Actions: lint + test on push/PR
- [ ] GitHub Actions: npm publish on tag
- [ ] Turborepo remote caching (Cloudflare R2 or Vercel)

### Polish
- [ ] Review all 20 tools: error messages, edge cases
- [ ] CLI loading states and progress indicators
- [ ] `construye doctor`: check environment, API keys, connectivity

**Revenue target M0:** $0 (free CLI, build user base, target 100 installs)

---

## M1: Deploy the Platform (May 19 → Jul 13, 2026)

**Goal:** SaaS backend running, Skills system functional.

### Worker Deployment
- [ ] Create D1 database: `wrangler d1 create construye-db`
- [ ] Create KV namespace: `wrangler kv:namespace create CONSTRUYE_KV`
- [ ] Create R2 bucket: `wrangler r2 bucket create construye-storage`
- [ ] Update `wrangler.toml` with real resource IDs
- [ ] Deploy worker: `wrangler deploy` (gateway Durable Object)
- [ ] Verify storage adapters work against real D1/R2/KV/Vectorize
- [ ] Set up staging + production environments

### Skills Runtime
- [ ] Design skill manifest format (name, description, tools, prompts)
- [ ] Skill loader: read from R2 or bundled
- [ ] Skill executor: inject skill context into agent loop
- [ ] 3 built-in skills: `refactor`, `test-writer`, `reviewer`
- [ ] Skill marketplace concept: community skill registry

### API
- [ ] REST API: `/v1/agent/run`, `/v1/agent/stream` (SSE)
- [ ] API key generation and validation
- [ ] Rate limiting per tier (KV-based counters)
- [ ] Usage tracking (tokens, requests, cost)

### Sandbox
- [ ] Evaluate options: Cloudflare Workers for Platforms, containers, or browser-based
- [ ] Implement basic code execution sandbox
- [ ] Security: resource limits, timeout, no network access by default

**Revenue target M1:** $0 → first beta users on SaaS, 500 CLI installs

---

## M2: Billing & Growth (Jul 14 → Oct 2026)

**Goal:** First paying customers, landing page live.

### Billing (Stripe)
- [ ] Stripe Checkout for Pro ($19/mo) and Team ($49/seat/mo)
- [ ] Customer Portal for self-service management
- [ ] Webhook handler: subscription lifecycle events
- [ ] Usage-based billing for overage (tokens beyond plan limit)
- [ ] Worker middleware: check subscription status on every API request
- [ ] Free tier: 50 requests/day, 1 provider (Workers AI only)
- [ ] Pro tier: 500K tokens/mo, all providers, all skills
- [ ] Team tier: 2M tokens/seat/mo, shared context, admin dashboard

### Landing Page (construye.lat)
- [ ] Build `packages/web`: Astro or Next.js on Cloudflare Pages
- [ ] Hero: "Tu agente de código AI. 91% más barato que Claude Code."
- [ ] Feature sections: CLI, SaaS, Skills, multi-provider
- [ ] Pricing page with tier comparison
- [ ] Blog: launch post, "Cloudflare vs traditional infra" cost breakdown
- [ ] SEO: target "AI coding agent", "alternativa Claude Code", "agente programación IA"

### Growth
- [ ] Product Hunt launch (English)
- [ ] Dev.to / Hashnode launch posts (English + Spanish)
- [ ] Twitter/X dev community engagement
- [ ] r/programming, HN Show submissions
- [ ] YouTube: 5-min demo video
- [ ] LATAM dev communities: meetups, Discord servers

**Revenue target M2:** $0 → $500 MRR (25 Pro users)

---

## Revenue Trajectory

| Month | CLI Installs | Pro Users | Team Seats | MRR |
|---|---|---|---|---|
| M0 | 100 | 0 | 0 | $0 |
| M1 | 500 | 0 | 0 | $0 |
| M2 | 1,000 | 25 | 0 | $475 |
| M3 | 2,500 | 60 | 10 | $1,630 |
| M6 | 10,000 | 200 | 50 | $6,250 |
| M12 | 50,000 | 1,000 | 300 | $33,700 |

**Break-even:** ~$200 MRR covers Cloudflare costs (Workers, D1, R2, KV are extremely cheap). Target by M2.

**Cost model at scale (M12):**
- Cloudflare Workers: ~$50/mo (paid plan)
- D1: ~$10/mo
- R2: ~$15/mo
- Workers AI: ~$1,300/mo (1,000 Pro users × ~$1.30 avg)
- Stripe fees: ~$1,000/mo
- **Total cost: ~$2,375/mo against $33,700 MRR = 93% gross margin**
