# construye.lat — Estrategia para Producto Superior y Nuevo Mercado AGI

> Fecha: 2 abril 2026
> Fuente: Investigación exhaustiva (9 búsquedas Tavily + análisis codebase)
> Status: ESTRATEGIA — Para decisión del fundador

---

## 0. Resumen Ejecutivo

construye.lat tiene una ventaja arquitectónica única: **100% Cloudflare stack a 91% menos costo** que Claude Code, con sesiones universales multi-superficie que nadie más ofrece. Para crear un **nuevo mercado de AGI accesible**, necesitamos ejecutar en 3 fases: (1) igualar features de los líderes, (2) diferenciar con lo que ellos no pueden copiar, (3) crear la categoría "agente de equipo" LATAM-first.

---

## 1. Mapa Competitivo Completo (Abril 2026)

### 1.1 Los Incumbentes

| Producto | ARR | Precio | Fortaleza | Debilidad Explotable |
|---|---|---|---|---|
| **Cursor** | $2B | $20/mo | IDE-native, 8 agents paralelos, Tab autocomplete | Atado a VS Code fork. Sin CLI. Sin mobile. Sin governance. $29.3B valuation = presión de márgenes |
| **Claude Code** | $2.5B | $100-200/mo Max | Terminal-first, 1M ctx, Agent Teams (16 paralelos), 80.8% SWE-bench | **Carísimo**. $20K para compilar un kernel. Sin web dashboard. Sin mobile. Lock-in Anthropic |
| **GitHub Copilot** | ~$1B+ | $10-39/mo | 4.7M subs, 37-42% enterprise, integrado en GitHub | Autocomplete, no agente autónomo. Agent mode naciente. Sin multi-agent |
| **Devin** | N/A | $20/mo + $2.25/ACU | Full autonomía, sandbox, web-first | Opaco. Caro en uso real. Adquirió Windsurf por $250M (distracción) |
| **OpenCode** | $0 (OSS) | Gratis | 95K+ stars, 2.5M devs/mes, MIT, 75+ providers, LSP | Sin empresa detrás = sin enterprise sales. Sin multi-agent. Sin sesiones persistentes |

### 1.2 Lo Que NADIE Está Haciendo Bien

Según la investigación, los **gaps reales del mercado** son:

1. **Sesiones universales multi-superficie** → NADIE las tiene. construye.lat ya lo diseñó.
2. **Governance + audit trail enterprise** → Gartner: 40% proyectos agentic AI cancelados por falta de controles.
3. **Precios accesibles para LATAM** → Todo está pensado para devs de $150K+/año. 600M personas online en LATAM sin producto.
4. **Modo offline con modelos locales** → Gemma 4 E4B/E2B lo hacen posible. Nadie lo integra nativamente.
5. **Harness engineering integrado** → La "configuration layer" es el nuevo cuello de botella (ECC tiene 118K stars por resolver esto).
6. **Memoria de 3 capas verificable** → Claude Code la tiene (filtrada), nadie más la implementa bien.

---

## 2. Sizing del Mercado

| Métrica | Valor | Fuente |
|---|---|---|
| AI Code Generation global | $5.7B (2024) → $45.5B (2030) | Multiple analysts |
| CAGR | ~41% | Consistent across sources |
| Vibe Coding específico | $4.7B (2026 est) | Industry reports |
| Empresas usando GenAI | 65% | McKinsey 2026 |
| Empresas desplegando/evaluando agentes | 44% | McKinsey 2026 |
| Código generado por AI (fin 2026) | 60% | Gartner prediction |
| Proyectos agentic AI cancelados (2027) | 40% | Gartner (por costos/controles) |
| LATAM online | 600M personas | Regional data |
| Startups LATAM usando AI | 90% | LATAM startup surveys |
| MCP SDK monthly downloads | 97M | npm/pypi data |

### 2.1 El TAM Real para construye.lat

- **Mercado primario**: Devs individuales + startups LATAM = ~5M desarrolladores activos
- **Mercado secundario**: Empresas LATAM que quieren AI pero no pueden pagar $200/mo/dev
- **Mercado terciario**: Devs globales que buscan alternativa open-source competitiva
- **Blue ocean**: "Agente de equipo" = no compites con Cursor (IDE) ni Claude Code (terminal). Compites en la categoría de **plataforma de agentes de desarrollo**.

---

## 3. Arquitectura de Producto Superior — Lo Que Hay Que Construir

### 3.1 FASE 1: Paridad de Features Críticos (2-4 semanas)

Estas son las features que los líderes tienen y que son table-stakes:

#### A. Sistema de Memoria de 3 Capas
```
┌─────────────────────────────────────┐
│       CAPA 3: Memoria de Proyecto   │  ← D1 + Vectorize
│  Convenciones, patrones, decisiones │
│  Persiste indefinidamente           │
├─────────────────────────────────────┤
│       CAPA 2: Memoria de Sesión     │  ← Durable Object state
│  Contexto actual, plan, progreso    │
│  Duración de la sesión              │
├─────────────────────────────────────┤
│       CAPA 1: Memoria de Trabajo    │  ← Context window
│  Mensajes recientes, tool results   │
│  Ventana deslizante + compactación  │
└─────────────────────────────────────┘
```

**Disciplina de escritura estricta** (copiado del leak de Claude Code):
- Solo actualizar memory index después de escritura confirmada exitosa
- Tratar memoria propia como "hint" — SIEMPRE verificar contra codebase real
- Previene contaminación de contexto con intentos fallidos

#### B. Sub-Agentes con Roles Especializados
El patrón **Explorer/Worker/Orchestrator** es ahora estándar de la industria:

| Rol | Modelo | Permisos | Función |
|---|---|---|---|
| **Explorer** | fast (Qwen3-Coder) | Read-only | Mapea codebase, busca código, retorna resumen |
| **Worker** | heavy (Kimi K2.5) | Read-write | Implementa cambios en archivos asignados |
| **Tester** | fast (Qwen3-Coder) | Read + exec | Escribe y ejecuta tests |
| **Reviewer** | reasoning (QwQ-32B) | Read-only | Valida cambios, detecta regresiones |
| **Orchestrator** | heavy (Kimi K2.5) | Full | Planea, delega, sintetiza, maneja fallos |

**Reglas críticas**:
- Máximo 6-10 sub-agentes paralelos (más = rendimientos decrecientes)
- Cada sub-agente en su propio V8 isolate (Dynamic Workers)
- Sub-agentes retornan **resúmenes estructurados**, no output raw
- Guard de recursión: límite de profundidad para evitar agente→agente→agente infinito
- Scope de archivos por sub-agente (seguridad contra prompt injection)

#### C. Sandbox de Ejecución Persistente
```
Sandbox (Dynamic Worker V8 Isolate)
├── Filesystem virtual (R2-backed)
├── npm/package install capability
├── Test runner integrado
├── Output capture (stdout/stderr/return)
├── Timeout + memory limits
├── Resume < 25ms desde standby
└── Estado persiste entre iteraciones
```

Ventaja Cloudflare: Dynamic Workers = V8 isolates **100x más rápido que containers**, $0.002/worker/day.

#### D. MCP Nativo
- MCP client integrado para conectar con cualquier herramienta externa
- MCP server para que otros agentes se conecten a construye.lat
- Soporte para MCP Server Cards (discovery)
- Session-scoped authorization (tokens temporales por sesión)

### 3.2 FASE 2: Diferenciadores Únicos (4-8 semanas)

Estas features son lo que nos separa de TODOS:

#### E. Sesiones Universales (ya diseñado — IMPLEMENTAR)
```
construye task "migrate auth to OAuth2" \  # Inicia en CLI
  --team coder,tester                       # Con 2 sub-agentes
  --watch                                   # Modo live

# → Web dashboard muestra progreso en tiempo real
# → Manager aprueba tool call desde su teléfono
# → CI pipeline recibe webhook al completar
```

**Esto es EL MOAT.** Nadie lo tiene. Nadie lo está construyendo.

#### F. Modo Offline con Modelos Locales
```
construye --local                    # Usa Gemma 4 E4B via Ollama
construye --local --model gemma4-26b # MoE más potente
construye --local --model kimi-k2.5  # Si tiene GPU
```

- Gemma 4 E4B: 128K ctx, multimodal, Apache 2.0, funciona en laptop
- Gemma 4 26B MoE: Solo ~4B params activos, 256K ctx (cuando llegue a Ollama)
- Detección automática de hardware → sugiere modelo óptimo
- Sync de sesión cuando vuelve online

#### G. Harness Engineering Integrado
Concepto de Mitchell Hashimoto: "Engineer the ENVIRONMENT so the agent can't make mistakes."

```yaml
# .construye/harness.yaml
hooks:
  pre_write:
    - lint: "biome check --apply"
    - type_check: "tsc --noEmit"
  post_write:
    - format: "biome format --write"
    - test: "vitest run --changed"
  pre_deploy:
    - security: "npm audit"
    - coverage: "vitest run --coverage --threshold 80"

guards:
  blocked_commands:
    - "rm -rf /"
    - "DROP DATABASE"
    - "git push --force"
  
  require_approval:
    - pattern: "*.env"
    - pattern: "migration/*"
    - command: "npm publish"

memory:
  learn_from_errors: true      # Cuando el agente falla, guarda la lección
  strict_write_discipline: true # Solo actualiza memory tras write exitoso
  verify_before_trust: true     # Verifica facts contra codebase, no confía en memory
```

#### H. Agent Teams (Peer-to-Peer, no solo Orchestrator-Worker)

Ir más allá que Codex (solo manager→worker):
```
┌─────────────────────────────────────────┐
│            Team Lead (Orchestrator)       │
│  Crea plan, asigna tasks, monitorea     │
├─────────────┬───────────┬───────────────┤
│  Coder A    │  Coder B  │   Tester      │
│  (módulo X) │  (módulo Y)│  (tests E2E) │
│             │           │               │
│  ←── Mailbox P2P Communication ───→     │
│  Coder A descubre API change            │
│  → Notifica a Coder B directamente      │
│  → Tester actualiza test plan           │
└─────────────┴───────────┴───────────────┘
```

- Comunicación P2P via Durable Object mailboxes (ventaja arquitectónica)
- File-locked task list compartida (previene conflictos)
- Cada teammate en su propio Dynamic Worker
- Dashboard web muestra todos los agentes trabajando en tiempo real

### 3.3 FASE 3: Crear la Categoría (8-12 semanas)

#### I. Marketplace de Skills
```
construye install skill:react-19      # Skills de la comunidad
construye install skill:nextjs-15     # Siempre updated
construye install skill:cloudflare    # Context oficial
construye publish skill:my-company    # Skills privados enterprise
```

- Skills = documentación + prompts + scripts + tests empaquetados
- Registry en D1/R2, versionado
- Skills de comunidad (open) + enterprise (privados)
- Auto-activación por contexto del proyecto

#### J. Protocolo A2A (Agent-to-Agent)
```
construye.lat agents hablan con otros agentes:
- Agent de QA externo verifica el code
- Agent de deploy hace el push a producción
- Agent de monitoring alerta si hay regresión
- Agent de diseño genera componentes UI
```

#### K. "construye teams" — El Producto Enterprise
```
Enterprise Dashboard
├── Team management (quién puede qué)
├── Cost allocation (por proyecto/equipo/dev)
├── Audit trail exportable (SOC 2 ready)
├── Custom model routing (elige providers)
├── Skills corporativos (knowledge base privada)
├── SSO + RBAC + API keys con scopes
└── SLA monitoring + usage analytics
```

---

## 4. Estrategia de Pricing — Sobrevivir al "Race to Zero"

### 4.1 Contexto del Mercado de Pricing

La investigación muestra:
- **Pricing collapse**: Los precios de AI tools caen rápidamente. Per-seat está muriendo.
- **Consumo-based gana**: 74% de software companies usan usage-based pricing
- **Credits = abstracción ganadora**: Permite pricing flexible sin confundir al usuario
- **Outcome-based emerge**: Intercom cobra $0.99 per resolved conversation
- **Solo 3% de consumidores AI pagan premium**: La base free es esencial

### 4.2 Modelo de Pricing Propuesto

```
┌──────────────────────────────────────────────────────────────┐
│  GRATIS (Construye Free)                                      │
│  • 100 créditos/día (~20 sesiones simples)                    │
│  • Workers AI models (Qwen3-Coder, QwQ-32B)                  │
│  • 1 sub-agente paralelo                                      │
│  • Sesiones solo CLI                                          │
│  • Skills de comunidad                                        │
│  • Modo offline con modelos locales (ilimitado)               │
│  → HOOK: Modo offline gratis = adopción masiva LATAM          │
├──────────────────────────────────────────────────────────────┤
│  PRO ($9/mo — precio LATAM-first)                             │
│  • 2,000 créditos/mes (~400 sesiones)                         │
│  • Kimi K2.5 + todos los Workers AI models                    │
│  • 6 sub-agentes paralelos (Agent Teams)                      │
│  • Sesiones universales (CLI + Web + Mobile)                  │
│  • Memoria de proyecto persistente                            │
│  • Skills premium                                             │
│  • MCP integrations                                           │
│  → El "Spotify de coding agents": accesible, invaluable       │
├──────────────────────────────────────────────────────────────┤
│  TEAM ($25/dev/mo)                                            │
│  • 10,000 créditos/dev/mes                                    │
│  • Todos los modelos incluyendo Claude/GPT-5 via AI Gateway   │
│  • 10 sub-agentes paralelos + Agent Teams P2P                 │
│  • Dashboard de equipo + cost allocation                      │
│  • Audit trail + governance                                   │
│  • Skills corporativos privados                               │
│  • SSO (SAML/OIDC)                                            │
│  → Compite con Cursor Teams ($40) a 37% menos                 │
├──────────────────────────────────────────────────────────────┤
│  ENTERPRISE (custom)                                          │
│  • Créditos ilimitados (fair use)                             │
│  • Custom model routing + BYOM (bring your own model)         │
│  • SLA + dedicated support                                    │
│  • SOC 2 audit export                                         │
│  • On-prem option via Cloudflare for Platforms                │
│  • Custom skills + knowledge base                             │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Burn Table (Créditos por Acción)

| Acción | Créditos | Racional |
|---|---|---|
| Mensaje simple (fast model) | 1 | Barato, alta frecuencia |
| Tarea de coding (heavy model) | 5 | Kimi K2.5, más costoso |
| Reasoning extendido | 8 | QwQ-32B con thinking |
| Sub-agente spawn | 3 | Dynamic Worker overhead |
| Agent Team (5 agentes, 1 task) | 20 | Parallelism premium |
| Embedding búsqueda | 0.1 | Casi gratis en Workers AI |
| Modo offline | 0 | GRATIS — adopción driver |

### 4.4 Por Qué $9/mo Funciona

- **Costo por sesión**: $0.038 (vs $0.452 Claude Code)
- **Sesiones por mes a $9**: ~237 sesiones
- **Margen bruto**: ~60% incluso a $9/mo
- **Comparable LATAM**: Netflix = $7/mo, Spotify = $5/mo → $9 es "impulse buy"
- **Cuota Workers AI**: First 10K neurons/day FREE, luego pricing predecible

---

## 5. Modelo Mental: Los 5 Moats Que Sobreviven al Race to Zero

De la investigación sobre pricing collapse, los únicos moats sostenibles son:

### Moat 1: Datos Propietarios → **Memoria de Proyecto**
Cada sesión aprende del codebase del usuario. Más uso = mejor agente para ESE proyecto.
Los modelos son commodity. Tu memoria del proyecto del usuario no lo es.

### Moat 2: Workflow Lock-in → **Sesiones Universales**
Empiezas en CLI, revisas en web, apruebas desde móvil. Tu workflow VIVE en construye.lat.
Cambiar = perder toda tu configuración, memoria, y flujo.

### Moat 3: Network Effects → **Skills Marketplace**
Cada skill publicado hace la plataforma más valiosa para todos.
OpenCode tiene esto con 95K stars. Nosotros lo monetizamos.

### Moat 4: Distribución → **LATAM-First**
Primer mover en 600M personas. Pricing en pesos/reales = barrera psicológica removida.
Copilot no localiza pricing. Claude Code no tiene Spanish support.

### Moat 5: Velocidad de Infra → **Cloudflare Edge**
V8 isolates: 0ms cold start. Dynamic Workers: 100x más rápido que containers.
Competidores en AWS/GCP no pueden igualar latency ni cost structure.

---

## 6. Lo Que Los Competidores No Pueden Copiar (Y Por Qué)

| Ventaja | Por Qué No Copian |
|---|---|
| **100% edge Cloudflare** | Cursor/Claude Code son AWS-heavy. Migrar = rewrite total. Latencia de edge imposible de igualar desde us-east-1 |
| **$0.038/sesión** | Dependencia de Claude Opus/Sonnet → $0.45+ por sesión. No pueden bajar sin cambiar proveedor |
| **Sesiones universales** | Requiere Durable Objects o equivalente. AWS no tiene análogo directo de este nivel |
| **Modo offline nativo** | Son cloud-dependent by design. Claude Code requiere API de Anthropic. OpenCode sí puede pero no lo prioriza |
| **Pricing LATAM** | Márgenes de Claude Code/Cursor no soportan $9/mo. Su cost structure no lo permite |
| **Agent Teams P2P via DO** | Durable Objects + WebSocket + mailbox = comunicación P2P sin servidor central. Reimplementar en K8s es meses de trabajo |

---

## 7. Pain Points Reales de los Developers (2026) → Features Que Construir

### Las 5 quejas más documentadas:

| Pain Point | Evidencia | Nuestra Solución |
|---|---|---|
| **1. Alucinaciones sobre APIs** | 96% devs no confían en código AI (Sonar 2026). Agents inventan métodos que no existen | MCP + skill system: siempre docs actualizados. Harness hooks validan imports/types |
| **2. Context decay en sesiones largas** | Sesiones >30 min degradan calidad. El agente "olvida" decisiones previas | Memoria de 3 capas + compactación inteligente (ya tenemos threshold 80%) |
| **3. Configuración repetitiva** | ECC (118K stars) existe porque Claude Code necesita re-configurarse en cada proyecto | `.construye/harness.yaml` + Skills auto-detectados + memoria de proyecto persistente |
| **4. Sin visibilidad de lo que hace el agente** | Agents corren en "black box". No sabes qué archivos tocó ni por qué | Dashboard web tiempo real + audit trail + diff viewer por acción |
| **5. Caro para uso real** | Claude Code Max: $200/mo. Cursor: $20/mo + overages. Devin: $2.25/ACU | $9/mo con 60% margen gracias a Workers AI |

---

## 8. Plan de Ejecución — Roadmap Priorizado

### Sprint 1 (Semanas 1-2): Foundation
- [ ] Sistema de memoria de 3 capas (D1 + Durable Object + context window)
- [ ] Sub-agentes Explorer/Worker con Dynamic Workers
- [ ] MCP client básico (connect a herramientas externas)
- [ ] Harness hooks (pre_write, post_write guards)

### Sprint 2 (Semanas 3-4): Diferenciación
- [ ] Sesiones universales: WebSocket sync CLI ↔ Web
- [ ] Agent Teams con mailbox P2P
- [ ] Web dashboard MVP (React + Vite, ya hay /packages/web)
- [ ] Modo offline con Ollama integration (Gemma 4 E4B)

### Sprint 3 (Semanas 5-6): Monetización
- [ ] Sistema de créditos + burn table
- [ ] Tiers: Free / Pro ($9) / Team ($25)
- [ ] Stripe integration para pagos
- [ ] Dashboard de uso y costos

### Sprint 4 (Semanas 7-8): Escala
- [ ] Skills marketplace MVP (registry en D1/R2)
- [ ] Más modelos en model router (Llama 4 Scout, GPT-OSS-20B)
- [ ] Session affinity header para prefix caching
- [ ] PWA mobile para aprobar/monitorear sesiones

### Sprint 5 (Semanas 9-12): Enterprise + Launch
- [ ] RBAC + SSO (SAML/OIDC)
- [ ] Audit trail exportable
- [ ] Cost allocation por equipo
- [ ] Launch público: Product Hunt + LATAM dev communities
- [ ] A2A protocol para inter-agent communication

---

## 9. Modelos AI — Actualización Inmediata al Stack

### 9.1 Cambios Inmediatos en `constants.ts`

```typescript
export const WORKERS_AI_MODEL_MAP = {
  heavy: "@cf/moonshot/kimi-k2.5",        // Mantener — mejor open coding model
  reasoning: "@cf/qwen/qwq-32b",          // Mantener — buen reasoning dedicado
  fast: "@cf/qwen/qwen3-coder-30b-a3b",   // Mantener — ultra rápido MoE
  general: "@cf/meta/llama-4-scout-17b-16e-instruct", // UPGRADE: Llama 4 Scout
  cheap: "@cf/openai/gpt-oss-20b",        // NUEVO: ultra-cheap para simple_query
} as const;
```

### 9.2 Nuevos Modelos a Monitorear

| Modelo | Cuando | Impact |
|---|---|---|
| Gemma 4 26B MoE | Cuando llegue a Workers AI | Reemplazar `fast` (4B active, 256K ctx) |
| Gemma 4 E4B | Ya disponible (Ollama) | Modo offline — 128K ctx, multimodal |
| GPT-OSS-20B | Ya en Workers AI | `cheap` role para compactación |
| Llama 4 Scout | Ya en Workers AI | `general` más barato que Llama 3.3-70B |

### 9.3 Optimizaciones de Costo Inmediatas

1. **`x-session-affinity` header** en Workers AI calls → prefix caching → ~30% reducción
2. **GPT-OSS-20B para compactación** → Tarea de resumen no necesita Kimi K2.5
3. **Batch API para operaciones masivas** → Durable inference, más barato
4. **AI Gateway como proxy** → Caching, rate limiting, logging gratis

---

## 10. Cómo Crear el "Nuevo Mercado AGI"

### La Tesis

No compites en "AI coding assistant" (Cursor gana en IDE, Claude Code gana en terminal).

Compites en: **"Plataforma de equipos de agentes AI para desarrollo"**.

### El Posicionamiento

> "Cursor es un IDE con AI. Claude Code es un terminal con AI.
> construye.lat es un EQUIPO de agentes AI que trabaja para ti —
> desde tu terminal, tu browser, o tu teléfono.
> Y cuesta $9/mes."

### Los Pilares del Nuevo Mercado

1. **Multi-superficie** (no estás atado a UN tool)
2. **Multi-agente** (no es UN asistente, es un EQUIPO)
3. **Multi-modelo** (usa el mejor modelo para cada tarea, no el más caro)
4. **Edge-native** (ms de latencia, no segundos)
5. **LATAM-accessible** ($9, no $200)
6. **Offline-capable** (funciona sin internet con Gemma 4)

### El Flywheel

```
Pricing accesible ($9) 
  → Más usuarios LATAM
    → Más skills publicados
      → Mejor plataforma para todos
        → Devs globales adoptan
          → Enterprise nota adopción
            → Revenue enterprise ($25-custom/dev)
              → Reinversión en producto
                → Repeat
```

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Workers AI no soporta Gemma 4 pronto | Media | Ollama local ya funciona. No dependemos de CF para esto |
| Claude Code baja precios agresivamente | Alta | Nuestro cost structure es 91% menor. $200→$50 aún es 5x nuestro precio |
| OpenCode copia sesiones universales | Baja | Requiere rewrite de infraestructura. Son open-source puro, sin edge infra |
| Pricing collapse hace $9 muy caro | Baja | Modo offline GRATIS como fallback. Free tier generoso |
| Kimi K2.5 degradado en Workers AI | Media | Multi-model routing. Siempre tenemos fallback a Llama 4 Scout + QwQ-32B |
| LATAM no paga | Media | $9 USD = impulse buy. Local payment methods (Mercado Pago, PIX) |

---

## 12. Métricas de Éxito

| Métrica | M1 | M3 | M6 | M12 |
|---|---|---|---|---|
| Users registrados | 1K | 10K | 50K | 200K |
| Users pagos (Pro) | 50 | 500 | 5K | 25K |
| MRR | $450 | $4.5K | $45K | $225K+ |
| Sessions/día | 500 | 5K | 50K | 200K |
| Skills publicados | 10 | 50 | 200 | 1K |
| Costo/sesión promedio | $0.04 | $0.035 | $0.03 | $0.025 |
| NPS | 50+ | 60+ | 65+ | 70+ |
| LATAM % users | 80% | 60% | 40% | 30% |

---

## 13. Conclusión

construye.lat no necesita ser "mejor que Claude Code en coding".
Necesita ser **la plataforma donde equipos de agentes AI trabajan juntos, accesible desde cualquier superficie, a un precio que LATAM puede pagar**.

Los modelos son commodity (Kimi K2.5, Gemma 4, Llama 4 — todos open/accesibles).
La infraestructura edge es el moat real (Cloudflare no tiene equivalente en el mercado).
El pricing LATAM-first es la distribución.
Las sesiones universales son el product-market fit.

**Ejecutar Sprint 1 esta semana.**
