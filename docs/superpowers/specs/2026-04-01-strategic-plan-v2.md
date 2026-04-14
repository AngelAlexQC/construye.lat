# construye.lat — Plan Estratégico v2: Investigación + Web + Distribución

> **Fecha:** 1 Abril 2026 (actualizado 2 Abril 2026)
> **Basado en:** Investigación de mercado con Tavily (Pragmatic Engineer Survey 2026, análisis competitivo, canales distribución)
> **Estado:** EN EJECUCIÓN — Fase 4+6 completadas, Fase 7 siguiente

---

## PROGRESO (2 Abril 2026)

### ✅ Completado desde que se escribió este plan

| Item | Estado | Evidencia |
|---|---|---|
| Worker API desplegado | ✅ | `https://construye-worker.quirozai.workers.dev` — health OK |
| Web Dashboard funcional | ✅ | `https://construye-web.pages.dev` — chat streaming |
| Browser Worker (Puppeteer) | ✅ | `https://construye-browser.quirozai.workers.dev` |
| GitHub OAuth con creds reales | ✅ | 302 redirect a GitHub con client_id real |
| DO con streaming (SSE → WS) | ✅ | Kimi K2.5 streaming chunks vía WebSocket |
| D1 database + migrations | ✅ | `b5a429de-8690-4e96-9e52-2b2d2484af8b` |
| 243 tests (16 archivos) | ✅ | 0 fallas, 9.4s total |
| 18 herramientas reales | ✅ | Incluyendo web_fetch, web_crawl, task_memory |
| WebSocket auth fix | ✅ | Query param + header para browsers |
| Rate limiting | ✅ | Token bucket per-user |
| Cancel support | ✅ | Interrumpir streaming mid-response |

### Tu Posición Real (Actualizada)

| Lo que tienes | Lo que falta |
|---|---|
| ✅ Monorepo funcional (11 paquetes) | Landing page marketing |
| ✅ CLI con React Ink (polished) | npm publish / instalador |
| ✅ Smart model routing (100% accuracy) | 0 usuarios, 0 GitHub stars |
| ✅ Worker desplegado con streaming | Extended thinking (QwQ-32B) |
| ✅ Web dashboard con chat funcional | BYOK providers (Claude/OpenAI) |
| ✅ GitHub OAuth real | MCP support |
| ✅ Browser Worker con Puppeteer | Code Mode / token savings |
| ✅ 243 tests pasando | Contenido público / blog |
| ✅ Narrativa LATAM única | Presencia en comunidades |

### Siguiente: Fase 7 — Landing + Distribución npm

Ver `docs/implementation-plan.md` Fase 7 para detalles.

---

## RESUMEN EJECUTIVO

Tras investigar el mercado actual (abril 2026), el panorama ha cambiado drásticamente desde tu plan refinado de marzo. Estos son los **5 insights más importantes** que cambian tu estrategia:

1. **Claude Code domina con 75% de uso** (Pragmatic Engineer Survey) y $2.5B ARR — pero fue hackeado vía npm el 31 de marzo (RAT en axios). Tu narrativa de seguridad es MÁS relevante que nunca.
2. **Anthropic prohibió legalmente a OpenCode usar tokens de Claude** (enero 2026). OpenCode (117K stars) tuvo que remover OAuth de Claude. Hay una fractura en el ecosistema que tú puedes aprovechar.
3. **Gemini CLI ofrece 1,000 requests/día GRATIS** con cuenta Google. 96.6K stars. La presión de precios hacia abajo es brutal.
4. **Sub-agentes son ahora estándar** — Claude Code, Codex, y Cursor todos soportan agentes paralelos. Esto ya no es diferenciador.
5. **El terminal es el nuevo campo de batalla** — IDEs ya no son la única superficie. CLI-first es la tendencia dominante.

### Tu Posición Real

| Lo que tienes | Lo que falta |
|---|---|
| Monorepo funcional (10 paquetes) | Web = placeholder "en construcción" |
| CLI con React Ink | 0 usuarios, 0 GitHub stars |
| Smart model routing (Kimi K2.5) | Sin distribución npm/instalador |
| Dynamic Workers + Containers | Sin landing page que convierta |
| Plan de seguridad sólido | Sin contenido público |
| Narrativa LATAM única | Sin presencia en comunidades |

---

## PARTE 1: MAPA COMPETITIVO ACTUALIZADO (Abril 2026)

### Tier 1: Los Gigantes (inalcanzables en features, superables en nicho)

| Agente | Uso | Stars | Modelo | Precio | Vulnerabilidad |
|---|---|---|---|---|---|
| Claude Code | 75% devs | N/A | Opus 4.6 | $20-200/mo | Supply chain attack 31 marzo, npm RAT |
| Cursor | 42% devs | N/A | Multi | $20-40/mo | IDE lock-in |
| GitHub Copilot | 35% devs | N/A | Multi | $10-39/mo | Enterprise-only momentum |
| Codex | 26% devs | N/A | GPT-5.3 | $20-200/mo | macOS app focus, no Linux native |

### Tier 2: Challengers Open Source (tu competencia directa)

| Agente | Stars | Modelo | Precio | Canal | Debilidad |
|---|---|---|---|---|---|
| OpenCode | 117K+ | 75+ providers | Free (BYOK) | npm, Zen | Prohibido de Claude OAuth, Go (no TS) |
| Gemini CLI | 96.6K | Gemini 3 | Free (1K/día) | npm | Solo Gemini, sin offline |
| Aider | 41.6K | Multi | Free (BYOK) | pip | Python, no TypeScript nativo |
| Cline | 58.7K | Multi | Free (BYOK) | VS Code | Extension, no CLI standalone |

### Tier 3: Donde construye.lat DEBE posicionarse

**No compites contra Claude Code. Compites contra OpenCode por un segmento que nadie atiende: LATAM + seguridad + edge.**

---

## PARTE 2: CANALES DE DISTRIBUCIÓN — Qué Copiar de Cada Uno

### Claude Code: La Máquina de Revenue ($2.5B ARR)

**Canales:**
1. **npm global install** → `npm i -g @anthropic-ai/claude-code` (AHORA migrado a installer nativo por el hack)
2. **Curl installer** → `curl -fsSL https://... | bash` (nuevo recomendado)
3. **VS Code Extension** → 5.2M installs
4. **Channels** → Telegram + Discord (marzo 2026) para notificaciones async
5. **Enterprise sales** → Deloitte 470K empleados, 300K business customers
6. **Content strategy** → Blog de Anthropic, Pragmatic Engineer features

**Lección para ti:** El hack de npm del 31 de marzo VALIDA tu narrativa. La distribución vía npm es un vector de ataque. Tu installer nativo + sandbox en el edge es la respuesta.

### Gemini CLI: La Máquina de Adopción (96.6K stars, FREE)

**Canales:**
1. **npm** → `npm i -g @google/gemini-cli`
2. **Homebrew** → `brew install gemini-cli`
3. **Free tier agresivo** → 60 req/min, 1K req/día con Google OAuth
4. **Google Cloud Shell** → Pre-instalado
5. **Apache 2.0** → Máxima apertura

**Lección para ti:** El free tier generoso es lo que genera adopción. Tu Workers AI con free tier (10K tokens/día) puede competir. La multi-plataforma install (npm + brew + curl) es mandatory.

### OpenCode: La Máquina Open Source (117K stars)

**Canales:**
1. **npm** → `npm i -g opencode-ai`  
2. **GitHub Copilot partnership** → Suscriptores de Copilot se autentican directamente
3. **Zen** → Pay-as-you-go con 4.4% markup
4. **Go Plan** → $10/mo flat para modelos open source
5. **Provider-agnostic** → 75+ LLM providers
6. **Offline-capable** → Ollama local

**Lección para ti:** OpenCode creció porque no te ata a un vendor. Tu smart routing + Workers AI es una variante de esto. PERO OpenCode fue prohibido de Claude OAuth — esa fractura abre espacio.

---

## PARTE 3: ESTRATEGIA DE DISTRIBUCIÓN PARA construye.lat

### Fase Inmediata (Semana 1-2): Instalable + Visible

```
Prioridad #1: Que alguien pueda instalar y usar construye.lat en 60 segundos.
```

#### 3.1 Distribución técnica

| Canal | Comando | Prioridad |
|---|---|---|
| npm | `npm i -g construye` | P0 (semana 1) |
| npx | `npx construye` | P0 (semana 1) |
| Homebrew tap | `brew install construye-lat/tap/construye` | P1 (semana 2) |
| Curl installer | `curl -fsSL https://construye.lat/install \| sh` | P1 (semana 2) |
| GitHub Releases | Binarios pre-built | P2 (semana 3) |

#### 3.2 Presencia online

| Acción | Canal | Prioridad |
|---|---|---|
| Landing page que convierta | construye.lat | P0 (semana 1) |
| GitHub README profesional | github.com/construye-lat | P0 (semana 1) |
| npm package published | npmjs.com/package/construye | P0 (semana 1) |
| Product Hunt prep | producthunt.com | P2 (semana 4) |

---

## PARTE 4: LA WEB — Diseño y Arquitectura

### 4.1 Stack Confirmado (ya en tu monorepo)

- React 19 + Vite 6 + Tailwind CSS 4
- Deploy en Cloudflare Pages (gratuito, global, <50ms TTFB)
- SSG para landing + SPA para dashboard (futuro)

### 4.2 Dirección Estética

**NO copiar:** El cliché dark-mode + cyan/purple gradients + neon que usa toda herramienta de IA.

**SÍ hacer:** Estética inspirada en **construcción LATAM**. Piensa en:
- Paleta cálida: naranja terracota (#E8622C), concreto gris (#2A2A2E), acero (#8B8D91), verde selva (#1A5D3A)
- Tipografía industrial-moderna: Inter para body, Space Grotesk para headings
- Elementos visuales: grids de plano arquitectónico de fondo, monospace code blocks
- Tono: directo, sin pretensiones, LATAM-first

**Referencia de calidad:** Linear (limpieza), Vercel (densidad de info), Better Stack (credibilidad técnica)

### 4.3 Estructura de Páginas

```
construye.lat/
├── / (Landing Page — conversión)
├── /docs (Documentación — retención)
├── /pricing (Pricing — monetización)
├── /blog (Contenido — SEO/distribución)
└── /dashboard (App — producto, futuro)
```

### 4.4 Landing Page — Secciones

```
┌─────────────────────────────────────────────────────────┐
│ HERO                                                     │
│ "El agente de código IA que corre en el edge."           │
│ Subtítulo: "Open source. Seguro. 91% más barato que     │
│ Claude Code. Construido sobre Cloudflare."               │
│ [CTA: Instalar] [CTA: Ver docs]                         │
│ Terminal animado mostrando `npx construye` en acción     │
│ Social proof: "Powered by Cloudflare Workers AI"         │
├─────────────────────────────────────────────────────────┤
│ PROBLEMA                                                 │
│ "1,184 skills maliciosos en MCP hubs. El 93% de         │
│ instancias son vulnerables. Tu agente ejecuta código     │
│ en TU máquina." → 3 pain points con iconos              │
├─────────────────────────────────────────────────────────┤
│ SOLUCIÓN — 3 columnas                                    │
│ 🔒 Sandbox aislado en V8 isolates                       │
│ ⚡ Dynamic Workers: <5ms cold start                      │
│ 💰 91% más barato: $0.038 vs $0.452 por sesión          │
├─────────────────────────────────────────────────────────┤
│ DEMO INTERACTIVA                                         │
│ Terminal embebido (xterm.js) mostrando una sesión real   │
│ O video de 30 segundos del CLI en acción                 │
├─────────────────────────────────────────────────────────┤
│ FEATURES — Grid 2x3                                      │
│ • Smart Model Router (Kimi K2.5 + QwQ-32B + Qwen3)     │
│ • Code Mode (99% reducción tokens)                       │
│ • Sub-agentes paralelos                                  │
│ • Universal Sessions (CLI ↔ Web ↔ Mobile)               │
│ • Skills marketplace con security scanning               │
│ • Provider-agnostic con Cloudflare AI Gateway            │
├─────────────────────────────────────────────────────────┤
│ COMPARATIVA                                              │
│ Tabla: construye.lat vs Claude Code vs OpenCode          │
│ vs Gemini CLI (precio, seguridad, open source, LATAM)   │
├─────────────────────────────────────────────────────────┤
│ OPEN SOURCE                                              │
│ Badge de GitHub stars, licencia, link al repo            │
│ "MIT License. Auditable. Contribuye."                    │
├─────────────────────────────────────────────────────────┤
│ PRICING                                                  │
│ Free → Pro ($19/mo) → Team ($49/mo) → Enterprise        │
│ (Ajustado a la baja vs plan anterior por presión de      │
│ Gemini free tier)                                        │
├─────────────────────────────────────────────────────────┤
│ FOOTER                                                   │
│ Links a docs, GitHub, Discord, blog                      │
│ "Hecho en LATAM 🌎 para el mundo"                        │
└─────────────────────────────────────────────────────────┘
```

### 4.5 Ajuste de Pricing (Post-Investigación)

Tu plan anterior proponía $29/mo Pro. **Eso es demasiado alto** dado que:
- Gemini CLI es FREE (1K req/día)
- OpenCode es FREE (BYOK)
- Claude Code Pro es $20/mo
- Copilot es $10/mo

**Pricing revisado:**

| Tier | Precio | Qué incluye |
|---|---|---|
| **Free** | $0 | CLI open source + Workers AI free tier (10K tokens/día) + 5 skills |
| **Pro** | $19/mo | 100 sesiones/día + skills premium + modelo routing inteligente |
| **Team** | $49/mo | 1K sesiones/día + audit logs + SSO + custom skills |
| **Enterprise** | Custom | Ilimitado + SLA + compliance + dedicated |

**Justificación:** El free tier DEBE ser generoso para competir. La monetización viene de: (1) empresas que necesitan seguridad/compliance, (2) marketplace de skills con revenue share.

---

## PARTE 5: PLAN DE EJECUCIÓN POR SEMANAS

### Semana 1: Foundation Web + Distribución (TÚ ESTÁS AQUÍ)

**Goal:** Landing page live + CLI instalable vía npm

| Tarea | Paquete | Horas est. | Entregable |
|---|---|---|---|
| Landing page completa | @construye/web | 8h | construye.lat en CF Pages |
| npm publish setup | @construye/cli | 4h | `npx construye` funcional |
| README profesional con GIF | root | 2h | README.md con demo animado |
| GitHub repo público | root | 1h | Repo visible, licencia MIT |

**Landing page - Implementación técnica:**
- React 19 + Tailwind CSS 4 (ya configurado)
- Framer Motion para animaciones sutiles  
- Terminal component con typewriter effect
- Responsive mobile-first
- Lighthouse target: 95+ performance
- Deploy: `wrangler pages deploy` a construye.lat

### Semana 2: Contenido + Comunidad

| Tarea | Canal | Horas est. | Entregable |
|---|---|---|---|
| Blog post: "Claude Code fue hackeado vía npm" | construye.lat/blog | 4h | Artículo viral |
| Blog post: "Por qué los agentes necesitan sandbox" | construye.lat/blog | 4h | Thought leadership |
| Discord server construye.lat | Discord | 1h | Comunidad activa |
| Post en r/LatinoPeopleTech | Reddit | 1h | Presencia LATAM |
| Twitter/X thread sobre seguridad de agentes | Twitter | 1h | Alcance dev |

### Semana 3: Features Diferenciadores

| Tarea | Paquete | Horas est. | Entregable |
|---|---|---|---|
| Secure Skills Runtime MVP | @construye/sandbox | 8h | Skills ejecutándose en Dynamic Workers |
| Skill scanner (básico) | @construye/skills | 4h | Escaneo de shell commands/URLs en skills |
| 5 skills útiles publicados | skills/ | 6h | Skills en npm y listing |
| Provider-agnostic setup | @construye/providers | 4h | BYOK para Claude/OpenAI/Gemini |

### Semana 4: Launch

| Tarea | Canal | Horas est. | Entregable |
|---|---|---|---|
| Product Hunt launch | ProductHunt | 4h | Listing top en AI tools |
| Hacker News post | HN | 1h | Show HN: construye.lat |
| Dev.to en español | Dev.to | 3h | Artículo técnico LATAM |
| YouTube demo (español) | YouTube | 4h | Video de 5 min "setup to shipping" |
| Cloudflare community post | Cloudflare | 2h | Template de Workers |

---

## PARTE 6: DIFERENCIADORES REALES (Post-Investigación)

Después de investigar todo, estos son los **3 diferenciadores reales** que nadie más tiene:

### 1. "Seguridad como feature, no como afterthought"

El hack de Claude Code vía npm (31 marzo 2026) es tu mejor argumento de venta. NADIE más ofrece:
- Skills ejecutándose en V8 isolates aislados del filesystem del usuario
- Security scanning automático de cada skill
- Audit trail de cada acción del agente
- Permisos granulares por skill

**Posicionamiento:** "El único agente de código donde los skills NO acceden a tu máquina."

### 2. "Edge-native: tu agente corre en 300+ ubicaciones globales"

Ningún competidor corre en el edge:
- Claude Code corre local
- Codex corre en cloud centralizada (OpenAI)
- OpenCode corre local
- Gemini CLI corre local

**construye.lat corre en Cloudflare Workers = <5ms cold start, 300+ PoPs, costo mínimo.**

### 3. "LATAM-first: documentación, precios y soporte en español"

- 25M+ devs en LATAM, CERO herramientas nativas en español
- Precios localizados (aceptar MXN, COP, BRL vía Polar.sh/Stripe)
- Documentación bilingüe (español primero, inglés segundo)
- Comunidad Discord en español
- Partnerships con Platzi, Dev.to LATAM, conferencias regionales

---

## PARTE 7: MÉTRICAS DE ÉXITO

### Semana 4 (Launch)

| Métrica | Target | Medición |
|---|---|---|
| GitHub Stars | 500+ | GitHub API |
| npm downloads/semana | 200+ | npm stats |
| Landing page visits | 5,000+ | CF Analytics |
| Discord members | 100+ | Discord count |
| Pro subscribers | 10+ | Polar.sh |

### Mes 3

| Métrica | Target | Medición |
|---|---|---|
| GitHub Stars | 3,000+ | GitHub API |
| npm downloads/semana | 2,000+ | npm stats |
| MAU (CLI) | 500+ | Telemetry (opt-in) |
| MRR | $1,000+ | Polar.sh |
| Blog pageviews/mes | 10,000+ | CF Analytics |

### Mes 6

| Métrica | Target | Medición |
|---|---|---|
| GitHub Stars | 10,000+ | GitHub API |
| MAU (CLI + Web) | 5,000+ | Analytics |
| MRR | $5,000+ | Stripe + Polar |
| Skills en marketplace | 50+ | Registry count |
| Enterprise pilots | 3+ | CRM |

---

## PARTE 8: RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cloudflare cambia pricing de Workers AI | Media | Alto | Mantener provider-agnostic, fallback a APIs directas |
| Gigantes copian tus features de seguridad | Alta | Media | Velocidad. Ship fast. Community moat. LATAM moat. |
| Kimi K2.5 no mejora en benchmarks | Media | Media | Smart routing ya soporta Claude/OpenAI como fallback |
| LATAM no monetiza suficiente | Media | Media | Pricing global + LATAM localizado. No solo LATAM. |
| 0 tracción en mes 1 | Media | Alto | Pivote a consultoría (ya en plan). Content marketing orgánico. |

---

## SIGUIENTE PASO INMEDIATO

**La web es la prioridad #1.** Sin web, no hay distribución. Sin distribución, no hay usuarios. Sin usuarios, no hay revenue.

Lo que necesito de ti para arrancar:

1. **¿Apruebas la dirección estética** (paleta terracota/concreto/selva, no dark-mode genérico)?
2. **¿Pricing $19/mo Pro está bien** o prefieres mantener $29?
3. **¿Repo público ya o esperar a semana 4?**
4. **¿Arranco con landing page ahora?**
