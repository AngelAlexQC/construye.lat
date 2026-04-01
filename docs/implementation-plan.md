# Plan de Implementación — construye.lat

> Última actualización: julio 2025
> Versión: 0.2.1

---

## Contexto Estratégico

### Visión
Agente de código IA que corre 100% en Cloudflare. Sin dependencia de APIs de terceros.
Primer agente pensado para LatAm — español nativo, precios accesibles, stack edge-first.

### Stack Diferenciador
| Componente | Tecnología | Ventaja |
|---|---|---|
| Modelo Heavy | Kimi K2.5 (Workers AI) | 76.8% SWE-bench Verified, 256K ctx, tool calling |
| Modelo Reasoning | QwQ-32B (Workers AI) | Razonamiento step-by-step, 32K ctx |
| Modelo Fast | Qwen3-Coder-30B-A3B (Workers AI) | Respuesta en <1s, MoE eficiente |
| Sandbox | Dynamic Workers (V8 isolates) | <5ms cold start, aislamiento total |
| Token Savings | @cloudflare/codemode | 99.9% reducción tokens (1K vs 1.17M) |
| Ejecución | Durable Objects + Agent SDK | Estado persistente, WebSocket, scheduled tasks |
| MCP | @modelcontextprotocol/sdk + McpAgent | Cliente y servidor bilateral |

### Benchmarks de Referencia (julio 2025)

**SWE-bench Verified** (500 tareas Python, contaminación confirmada):
| Modelo | Score |
|---|---|
| Claude Opus 4.5 | 80.9% |
| Claude Opus 4.6 | 80.8% |
| MiniMax M2.5 (open-weight) | 80.2% |
| GPT-5.2 | 80.0% |
| Gemini 2.5 Pro | 78.8% |
| **Kimi K2.5 (nuestro)** | **76.8%** |
| Qwen3 Coder Next | 70.6% |

**SWE-bench Pro** (1,865 tareas, multi-lang, anti-contaminación — benchmark fiable):
| Agente + Modelo | Score |
|---|---|
| GPT-5.4 | 57.7% |
| Auggie CLI (Opus 4.5) | 51.8% (#1 de agentes) |
| Cursor (Opus 4.5) | 50.2% |
| Claude Code (Opus 4.5/4.6) | 49.8% |
| Codex CLI | 46.5% |
| SWE-Agent (Opus 4.5) | 45.9% |
| GPT-5 standalone | 23.3% |
| Claude Opus 4.1 | 22.7% |

> **Insight clave**: El harness importa más que el modelo.
> - Auggie (51.8%) vs SWE-Agent (45.9%) = **+6 puntos** con el mismo modelo (Opus 4.5)
> - Un buen harness agrega **+22 puntos** sobre el modelo sin scaffolding
> - Nuestro diferenciador: mejor harness sobre Kimi K2.5 en Workers AI

### Competencia (julio 2025)
| Agente | Maker | Precio | Open Source | LLM | SWE-bench Pro |
|---|---|---|---|---|---|
| Claude Code | Anthropic | $20-200/mo + API | **Sí (recién open-source)** | Claude only | 49.8% |
| Codex CLI | OpenAI | API costs | Sí (Apache 2.0) | OpenAI only | 46.5% |
| Gemini CLI | Google | Free (1K req/day!) | Sí (Apache 2.0) | Gemini only | ~45% est. |
| Cursor | Anysphere | $20-200/mo | No | Multi-model | 50.2% |
| Auggie CLI | Augment | $50/mo + API | No | Multi-model | 51.8% (#1) |
| OpenCode | Independiente | BYOK | Sí | 75+ models | ~40% est. |
| Cline | Independiente | Free + API | Sí | Multi-model | ~38% est. |
| **construye.lat** | **Nosotros** | **FREE → $19/mo** | **Sí** | **Workers AI** | **TBD** |

**Cambios recientes importantes**:
- Claude Code ahora es **open source** — barrera de entrada bajó para competidores
- Gemini CLI ofrece **free tier generoso** (1K requests/día) — presión de precios
- GPT-5.4 llegó a **57.7% SWE-bench Pro** — la brecha entre modelos se cierra
- MiniMax M2.5 alcanzó **80.2% Verified open-weight** — modelos open source compiten
- Cloudflare Code Mode promete **99.9% reducción de tokens** (presentado AWS Summit)

**Métricas de mercado**: Claude Code usado por 75% de devs (Pragmatic Engineer survey).
Cursor creció 35% en 9 meses. 95% de devs usan IA al menos semanalmente.
80% del desarrollo ya es agentic en 2026 (vs 20% en 2025).

---

## Fase 0: Foundation ✅ COMPLETADA

> Semana 1 — Todo lo que ya se implementó

### 0.1 Monorepo & Infraestructura ✅
- [x] 10 paquetes pnpm workspace funcionales
- [x] Turborepo configurado (build, typecheck, test)
- [x] `pnpm turbo typecheck` — 10/10 paquetes verdes (3.2s)
- [x] Vitest configurado en raíz
- [x] Biome para lint/format
- [x] tsconfig.base.json con ES2022 + ESNext modules

### 0.2 @construye/shared — Configuración Central ✅
- [x] `WORKERS_AI_MODEL_MAP` con heavy/reasoning/fast/general
- [x] `DEFAULT_MODELS` por TaskType (coding→heavy, reasoning→QwQ, simple→fast)
- [x] `MODEL_CONTEXT_SIZES` por modelo
- [x] Constantes: `COMPACTION_THRESHOLD=0.80`, `MAX_AGENT_TURNS=30`, `MAX_ERROR_RETRIES=3`
- [x] Token counter: `estimateTokens`, `estimateMessagesTokens`, `wouldExceedBudget`
- [x] Types: `TaskType` expandido con `simple_query` y `compaction`
- [x] 18 tests (constants + token-counter) ✅

### 0.3 @construye/core — Motor del Agente ✅
- [x] `classifyTask()` — clasificación por regex (español + inglés)
- [x] `getModelForTask()` — routing a modelo óptimo con temp/max_tokens por tarea
- [x] Agent loop con `executeWithRetry` — backoff exponencial (500ms→1s→2s)
- [x] Detección de errores transitorios (ETIMEDOUT, ECONNREFUSED, etc.)
- [x] Context engine: carga CONSTRUYE.md + tool stubs + skill stubs
- [x] `FileSessionStore` — persistencia JSONL en `~/.construye/sessions/`
- [x] Sanitización de sessionId contra path traversal
- [x] 25 tests (model-router + context-engine + file-session-store) ✅

### 0.4 @construye/tools — Herramientas Reales ✅
- [x] `git` — execFile real con whitelist (SAFE_COMMANDS + DANGEROUS_COMMANDS)
- [x] `edit_file` — replace único + post-edit typecheck automático
- [x] `search_text` — grep con 18 extensiones, múltiples patrones con `|`
- [x] `read_file`, `write_file`, `list_dir`, `glob` — implementados
- [x] `ToolRegistry` con stubs (30 tokens/herramienta) y definiciones completas
- [x] 7 tests (registry) ✅

### 0.5 @construye/providers — Workers AI ✅
- [x] `WorkersAIProvider` con Kimi K2.5 como default
- [x] Streaming híbrido (non-streaming para tools, streaming para texto)
- [x] Detección de loops (2+ tool calls idénticos consecutivos → forzar texto)
- [x] Parser multi-formato (OpenAI format, nativo, extracción de texto)
- [x] `CostTracker` con pricing real y fallback
- [x] `withRetry` — retry con backoff para rate limits, timeouts, 503, 429
- [x] 11 tests (cost-tracker + retry) ✅

### 0.6 @construye/cli — Interfaz Terminal ✅
- [x] React Ink con header, message, status-bar, tool-call components
- [x] Integración con FileSessionStore (`/resume`, `/sessions`, `/clear`)
- [x] Carga automática de CONSTRUYE.md
- [x] Guardado automático después de cada turno

### Métricas Fase 0
- **Typecheck**: 10/10 paquetes, 0 errores, 3.2s
- **Tests**: 114/114 pasando, 9 archivos, 950ms
- **Benchmarks**: 53/53 pasando (modelo, context, sessions, tokens, costos)
- **Archivos modificados**: 11 (shared, core, tools, providers, cli)
- **Archivos de test**: 9 creados (incluye benchmark suite)
- **Bugs corregidos**: regex `\b` con acentos, token counter overhead, test expectations

### Resultados del Benchmark Suite

**Model Router** (28 test cases EN+ES):
- Accuracy: **100%** (28/28 clasificaciones correctas)
- Speed: **1000 clasificaciones en 0.27ms** (0.27µs/op)
- Cobertura: 6 task types × EN/ES

**Context Engine**:
- System prompt sin proyecto: **378 tokens** (9 tools)
- System prompt con proyecto: **417 tokens** (+39 tokens = 10% overhead)
- Tool stubs: **~9 tokens/tool** (muy compactos)
- Assembly de 50 mensajes: **29µs** (<5ms target cumplido)
- Overhead de system prompt: **0.27%** de 128K (Kimi K2.5)

**Session Persistence (JSONL)**:
- Save 200 mensajes: **2.6ms**
- Load 200 mensajes: **0.9ms**
- Save/Load 50KB payload: **1.3ms / 0.9ms**
- Listar 20 sesiones: **5.2ms** (<100ms target)

**Token Economy**:
- Sesión típica de 10 turnos: **1,432 tokens** (143/turno)
- Con Code Mode estimado (81% saving): **~272 tokens**
- System prompt / contexto: **0.27%** (Kimi) a **1.09%** (QwQ-32B)

**Error Recovery**:
- Retry delays: **500ms → 1s → 2s** (backoff exponencial)
- Max retries: 3 (total wait: 3.5s)

**Cost Efficiency** (sesión típica: 20.5K input + 14K output tokens):
| Servicio | Costo/sesión | Costo/día (50 sesiones) |
|---|---|---|
| construye.lat (smart routing) | **$0.038** | **$1.90** |
| Claude Code (Opus 4.6) | $0.452 | $22.63 |
| **Ahorro** | **91.6%** | |

**Capabilities Scorecard**:
| Capability | Score | Status |
|---|---|---|
| Agent Loop (streaming) | 8/10 | ✅ |
| Multi-model routing | 7/10 | ✅ |
| Tool system (14 tools) | 7/10 | ✅ |
| Context engine | 6/10 | ✅ |
| Compaction | 6/10 | ✅ |
| Session persistence | 7/10 | ✅ |
| Error recovery | 6/10 | ✅ |
| Git integration | 5/10 | ✅ |
| Loop detection | 5/10 | ✅ |
| Post-edit verification | 3/10 | ⚠️ Parcial |
| Code Mode / batching | 0/10 | 📋 Planned |
| RAG / codebase indexing | 0/10 | 📋 Planned |
| Sub-agents | 0/10 | 📋 Planned |
| MCP support | 0/10 | 📋 Planned |
| Extended thinking | 0/10 | 📋 Planned |
| Web UI | 0/10 | ❌ Missing |
| Cloud execution (DO) | 0/10 | ❌ Missing |
| Skills (real loading) | 2/10 | ⚠️ Parcial |
| **TOTAL** | **62/180 (34.4%)** | |

---

## Fase 1: Code Mode + Sandbox Real (Semana 2-3)

> Objetivo: Agent puede ejecutar código en V8 isolate con 99% menos tokens

### 1.1 Dynamic Workers — Sandbox Real
- [ ] Instalar `@cloudflare/codemode` y dependencias
- [ ] Implementar `DynamicWorkerExecutor` en `packages/sandbox/src/dynamic-worker.ts`
- [ ] Configurar `env.LOADER` en wrangler.toml binding
- [ ] V8 isolate con `globalOutbound: null` (aislamiento de red)
- [ ] Ejecutar tools (read_file, write_file, edit_file) dentro del isolate
- [ ] Tests: ejecución aislada, timeout, errores

### 1.2 Code Mode Integration
- [ ] `createCodeTool()` para exponer API completa al agente
- [ ] Integrar con agent loop — detección de Code Mode vs tool calls normales
- [ ] Métricas de token savings (target: >90% reducción)
- [ ] Fallback a tools normales si Code Mode falla
- [ ] Tests: token comparison, error recovery

### 1.3 Tool Execution Router
- [ ] Router que decide: host execution vs dynamic worker vs code mode
- [ ] `host` layer: git, exec (necesitan filesystem real)
- [ ] `dynamic_worker` layer: file ops, search (ejecutar en V8 isolate)
- [ ] `code_mode` layer: batch operations (múltiples ops en una llamada)
- [ ] Tests para routing decisions

### 1.4 Verificación End-to-End
- [ ] Test E2E: "fix the bug in X" → agente usa code mode → edita archivo → typecheck
- [ ] Benchmark: tokens usados con vs sin code mode
- [ ] Benchmark: latencia code mode vs tool calls individuales

---

## Fase 2: Smart Routing + Extended Thinking (Semana 4)

> Objetivo: Modelo correcto para cada tarea, reasoning visible

### 2.1 Model Router Avanzado
- [ ] Routing por análisis semántico (no solo regex) usando Qwen3-Coder
- [ ] Escalamiento automático: fast → heavy si la tarea es compleja
- [ ] De-escalamiento: heavy → fast si el contexto es simple
- [ ] Budget-aware routing: cambiar a modelo más barato si se acerca al límite
- [ ] Métricas de routing: cuántas veces cada modelo es seleccionado
- [ ] Tests con scenarios variados

### 2.2 Extended Thinking
- [ ] QwQ-32B para tareas de reasoning con chain-of-thought visible
- [ ] Parsear `<think>...</think>` tags del output
- [ ] Mostrar thinking en CLI como sección colapsable
- [ ] Aplicar thinking solo para: debugging, architecture, refactoring
- [ ] Tests: parsing de thinking tokens

### 2.3 Prefix Caching + Session Affinity
- [ ] Header `x-session-affinity` en requests a Workers AI
- [ ] Reutilizar system prompt cacheado entre turnos
- [ ] Medir cache hit rate
- [ ] Batch API para tareas async (compaction, indexing)

---

## Fase 3: MCP Bilateral (Semana 5-6)

> Objetivo: construye.lat consume y expone herramientas via MCP

### 3.1 MCP Client — Consumir herramientas externas
- [ ] `@modelcontextprotocol/sdk` integrado como cliente
- [ ] Descubrir y conectar a MCP servers locales (vía stdio)
- [ ] Inyectar tools del MCP server al contexto del agente
- [ ] Soporte para prompts y resources del MCP protocol
- [ ] Tests: mock MCP server, tool discovery, execution

### 3.2 MCP Server — Exponer herramientas de construye
- [ ] `McpAgent` Durable Object que sirve MCP protocol
- [ ] Exponer tools: search_text, read_file, edit_file, git via MCP
- [ ] Exponer Code Mode como MCP tool (`search()` + `execute()`)
- [ ] SSE transport para web clients
- [ ] Tests: MCP protocol compliance

### 3.3 MCP Code Mode Wrapper
- [ ] `codeMcpServer({ server, executor })` para wrappear nuestros tools
- [ ] `openApiMcpServer({ spec, executor })` para APIs externas
- [ ] Reducir tools de N individuales → 1 `code` tool con métodos typed
- [ ] Tests: token comparison

---

## Fase 4: Cloud Deployment + Storage (Semana 7-8)

> Objetivo: `construye.lat` funciona como servicio cloud

### 4.1 Worker + Durable Object
- [ ] Worker entry point con routing (API + WebSocket + MCP)
- [ ] Durable Object con Agent SDK para sesiones persistentes
- [ ] WebSocket handshake para CLI y web clients
- [ ] Scheduled tasks para background jobs (compaction, indexing)
- [ ] Rate limiting por tier con algoritmo sliding window
- [ ] Tests: WebSocket protocol, session lifecycle

### 4.2 Storage Layer
- [ ] D1 schema migrado (users, sessions, projects, messages)
- [ ] R2 para archivos grandes (snapshots, logs)
- [ ] KV para cache (model responses, session metadata)
- [ ] Vectorize para RAG (embeddings del repositorio)
- [ ] Queue para tareas async (indexing, compaction, webhooks)
- [ ] Tests: CRUD operations, migrations

### 4.3 Auth + Billing
- [ ] GitHub OAuth flow completo
- [ ] JWT con crypto.subtle (sign + verify)
- [ ] Tiers: Free (100 msgs/día), Pro ($19/mo, ilimitado), Team ($49/seat)
- [ ] Workers AI está incluido — sin pass-through de costos al usuario
- [ ] Stripe integration para subscripciones
- [ ] Tests: auth flow, token validation, rate limits

---

## Fase 5: Skills + RAG + Sub-Agentes (Semana 9-10)

> Objetivo: Agente que aprende, busca semánticamente, y delega

### 5.1 Skills System
- [ ] Cargar skills desde `.construye/skills/` (SKILL.md format)
- [ ] Matcher semántico (no solo keywords) usando embeddings
- [ ] Auto-inject skills relevantes al contexto del agente
- [ ] Registry remoto para instalar skills de la comunidad
- [ ] Tests: matching, loading, injection

### 5.2 RAG con Vectorize
- [ ] Indexar repositorio al crear/conectar proyecto
- [ ] Embeddings via Workers AI (bge-base-en-v1.5 o similar)
- [ ] `search_semantic` tool funcional con Vectorize
- [ ] Re-indexar incremental en cambios (file watcher)
- [ ] Tests: indexing, search, relevance

### 5.3 Sub-Agentes
- [ ] Tool `delegate` para crear sub-agentes con scope limitado
- [ ] Sub-agente hereda contexto padre pero con budget propio
- [ ] Paralelización: múltiples sub-agentes en Dynamic Workers
- [ ] Agregación de resultados al agente padre
- [ ] Tests: delegation, isolation, aggregation

---

## Fase 6: Web Dashboard + Experiencia (Semana 11-12)

> Objetivo: construye.lat funcional como producto web

### 6.1 Landing + Auth
- [ ] Marketing page en construye.lat (React + Vite + CF Pages)
- [ ] Login con GitHub OAuth
- [ ] Dashboard de proyectos

### 6.2 Session UI
- [ ] Chat interface con WebSocket al Durable Object
- [ ] Streaming de respuestas en tiempo real
- [ ] File diff viewer (Monaco-based)
- [ ] Cost tracker visible por sesión
- [ ] Mobile responsive

### 6.3 Developer Experience
- [ ] `construye init` — configurar proyecto (.construye/)
- [ ] `construye login` — autenticar con construye.lat
- [ ] `construye sync` — sincronizar sesiones local ↔ cloud
- [ ] Autocomplete de comandos en terminal

---

## Post-MVP (Semana 13+)

### Producto
- [ ] Plugin VS Code con chat sidebar
- [ ] Proactive agents via Workflows (linting, tests, security scans)
- [ ] Team collaboration — sesiones compartidas
- [ ] Custom model support (BYOM vía OpenRouter)

### Infraestructura
- [ ] CI/CD con GitHub Actions (lint + typecheck + test + deploy)
- [ ] Monitoring con Workers Analytics
- [ ] Error tracking con Sentry/Cloudflare Logpush
- [ ] Self-hosted deployment guide

### Comunidad
- [ ] Docs site en construye.lat/docs
- [ ] Skills marketplace
- [ ] Contributing guide
- [ ] Discord community para LatAm devs

---

## Métricas de Éxito

### Técnicas
| Métrica | Target | Actual |
|---|---|---|
| Typecheck | 0 errores | ✅ 0 errores (10/10 pkgs) |
| Tests | >100 tests | ✅ 114 tests, 9 archivos |
| Benchmark suite | 100% pass | ✅ 53/53 passing |
| Token savings (Code Mode) | >90% reducción | 📋 Pendiente Fase 1 |
| Latencia (fast model) | <1s p50 | 📋 Pendiente |
| Latencia (heavy model) | <5s p50 | 📋 Pendiente |
| SWE-bench (harness) | >40% Verified | 📋 Pendiente |
| Router accuracy | >90% | ✅ 100% (28/28 EN+ES) |
| System prompt overhead | <1% de context | ✅ 0.27% (Kimi K2.5) |
| Session I/O | <50ms save/load | ✅ 2.6ms / 0.9ms |
| Costo/sesión vs Claude | >80% ahorro | ✅ 91.6% ahorro |

### Producto
| Métrica | Target |
|---|---|
| Users beta | 100 en mes 1 |
| Daily active sessions | 30 |
| Retention D7 | >40% |
| NPS | >50 |

### Negocio
| Métrica | Target |
|---|---|
| MRR mes 3 | $1,900 (100 Pro users) |
| Churn mensual | <5% |
| CAC | <$20 |
| LTV | >$200 |
