# construye.lat — El Ecosistema Completo para Construir Productos

> Fecha: Julio 2026
> Status: VISIÓN ESTRATÉGICA — Para decisión del fundador
> Premisa: "Con todo lo que nos da Cloudflare podemos tener un ecosistema completo para construir productos"

---

## 0. El Cambio de Paradigma

construye **no es un agente de código**. Es una **fábrica de productos**.

Hoy el mercado está lleno de herramientas que te ayudan a escribir código: Cursor, Claude Code, Copilot, Devin. Todas compiten en lo mismo: "te ayudo a codear más rápido". Ese mercado ya está comoditizado.

**La pregunta correcta no es "¿cómo escribo código más rápido?" sino "¿cómo paso de una idea a un producto en producción?"**

Construir un producto requiere mucho más que código:
- Necesitas **infraestructura** (servidores, bases de datos, storage)
- Necesitas **deployment** (CI/CD, staging, production)
- Necesitas **observabilidad** (logs, analytics, métricas)
- Necesitas **comunicación** (emails transaccionales, notificaciones)
- Necesitas **seguridad** (secrets, auth, compliance)
- Necesitas **colaboración** (tiempo real, voz, video)
- Necesitas **datos** (pipelines, data lakes, reportes)

Cloudflare es la ÚNICA plataforma que provee **TODO esto** bajo un mismo techo, con pricing predecible, sin egress fees, en 330+ ciudades globales. Y nosotros tenemos acceso programático a cada uno de esos servicios.

**construye.lat = el ecosistema donde un agente (o equipo de agentes) no solo escribe tu código, sino que provisiona tu infraestructura, despliega tu producto, monitorea tu sistema, maneja tu data pipeline, y opera tu producto en producción.**

---

## 1. El Mapa del Ecosistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    construye.lat ECOSYSTEM                       │
│                                                                  │
│   "De la idea al producto en producción"                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   THINK  │  │   BUILD  │  │   RUN    │  │  OPERATE │       │
│  │          │  │          │  │          │  │          │       │
│  │ Planear  │→│ Codear   │→│ Ejecutar │→│ Operar   │       │
│  │ Diseñar  │  │ Testear  │  │ Desplegar│  │ Observar │       │
│  │ Decidir  │  │ Revisar  │  │ Migrar   │  │ Escalar  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│       │              │              │              │             │
│       ▼              ▼              ▼              ▼             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            CLOUDFLARE PRIMITIVES (25+ servicios)         │   │
│  │                                                          │   │
│  │  Compute:  Workers · DO · Containers · Sandbox SDK       │   │
│  │  AI:       Workers AI · AI Gateway · Vectorize · Agents  │   │
│  │  Storage:  R2 · D1 · KV · Queues                        │   │
│  │  Data:     Pipelines · Analytics Engine                  │   │
│  │  Web:      Pages · Browser Rendering                     │   │
│  │  Realtime: SFU · RealtimeKit · TURN                     │   │
│  │  Comms:    Email Workers · Notifications                 │   │
│  │  Security: Secrets Store · Access · Zero Trust           │   │
│  │  Network:  Tunnel · Spectrum · DNS                       │   │
│  │  Orchestr: Workflows · Queues · Cron Triggers            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SUPERFICIES (cómo accedes)                   │   │
│  │  CLI (terminal) · Web (dashboard) · API · CI/CD · MCP    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Los 7 Pilares del Ecosistema

### Pilar 1: THINK — Agentes que Piensan

**Servicios CF**: Workers AI (modelos de reasoning), AI Gateway (multi-provider), Agents SDK (orquestación)

Lo que existe hoy en la industria es un chatbot que responde preguntas. construye va más allá:

```
Usuario: "quiero construir un SaaS de facturación para LATAM"

construye (THINK mode):
├── Analiza el mercado (web search + RAG sobre regulaciones LATAM)
├── Propone arquitectura (D1 para datos, R2 para PDFs, Workers para API)
├── Estima costos de infraestructura CF ($12/mo estimado para 1K usuarios)
├── Genera un plan de implementación de 6 fases
├── Identifica riesgos (regulación fiscal por país, SAT/SUNAT/SII)
└── Pregunta: "¿Empezamos con México o con todos los países?"
```

**Capability Map**:

| Capacidad | Servicio CF | Cómo funciona |
|---|---|---|
| Razonamiento profundo | Workers AI (QwQ-32B) | El agente "piensa" antes de actuar, descompone problemas |
| Multi-modelo inteligente | AI Gateway | Routing automático: razoning → coding → review, cada uno con su modelo óptimo |
| Memoria de contexto | Vectorize + D1 | El agente recuerda decisiones anteriores, patrones del proyecto, errores pasados |
| Búsqueda web | Browser Worker | Investiga librerías, APIs, regulaciones, competidores |
| Knowledge base | Vectorize + R2 | RAG sobre docs del usuario, specs, diseños, manuales |

### Pilar 2: BUILD — Agentes que Construyen

**Servicios CF**: Sandbox SDK (containers), Workers AI (Kimi K2.5 para código), Agents SDK (teams)

No solo escribe código — ejecuta, testea, itera, y verifica. En un ambiente aislado que el usuario nunca tiene que configurar.

```
construye build "API REST para facturación con Hono + D1"

Agent Team activado:
├── Architect (QwQ-32B): Diseña schema D1, endpoints, validaciones
├── Coder-A (Kimi K2.5): Implementa routes + handlers
│   └── Sandbox: ejecuta en container aislado, instala deps, verifica types
├── Coder-B (Kimi K2.5): Implementa database layer + migrations
│   └── Sandbox: ejecuta migrations contra D1 local
├── Tester (Qwen3-Coder): Escribe y ejecuta tests con Vitest
│   └── Sandbox: corre test suite, reporta coverage
└── Reviewer (QwQ-32B): Revisa todo, detecta issues de seguridad
    └── Output: PR-ready con resumen de cambios
```

**La revolución del Sandbox SDK (`@cloudflare/sandbox`)**:

Esto cambia todo. Antes teníamos V8 isolates (Dynamic Workers) que solo ejecutan JS/TS. Ahora con el Sandbox SDK:

```typescript
import { getSandbox } from "@cloudflare/sandbox";

// Cada usuario/sesión tiene su propio container Linux aislado
const sandbox = getSandbox(env.Sandbox, sessionId);

// Instalar dependencias — como un dev real
await sandbox.exec("npm install hono drizzle-orm");

// Ejecutar tests — con output capturado
const result = await sandbox.exec("npx vitest run --reporter=json");

// Ejecutar cualquier lenguaje — no solo JS
await sandbox.exec("python3 manage.py migrate");
await sandbox.exec("go build ./...");
await sandbox.exec("cargo test");

// Docker-in-Docker — para testing de infraestructura
await sandbox.exec("docker compose up -d");

// Acceso a terminal en tiempo real via WebSocket
// → El usuario ve el output live en CLI/web/mobile
```

**Ventaja sobre la competencia**:
- Cursor: no tiene sandbox, ejecuta en tu máquina local
- Claude Code: tiene sandbox pero es caro y con límites
- Devin: tiene sandbox pero a $2.25/ACU y opaco
- construye: sandbox ilimitado como Durable Object, pricing predecible, código del sandbox accesible
- Cada sandbox persiste entre sesiones (es un Durable Object con filesystem propio)

### Pilar 3: RUN — Deployment Automatizado

**Servicios CF**: Pages (frontend), Workers (API), D1 (DB), R2 (storage), Wrangler (CLI)

El agente no solo codea — despliega. Un producto necesita estar vivo para ser producto.

```
construye deploy

Workflow automático:
├── Step 1: Detecta tipo de proyecto (Hono API + React frontend)
├── Step 2: Genera wrangler.jsonc si no existe
├── Step 3: Crea D1 database y ejecuta migrations
├── Step 4: Crea R2 bucket para assets
├── Step 5: Configura secrets (API keys → Secrets Store)
├── Step 6: Deploy Worker (API) → *.workers.dev
├── Step 7: Deploy Pages (frontend) → *.pages.dev
├── Step 8: Configura custom domain si existe
├── Step 9: Verifica health checks
└── Step 10: Reporta URLs + métricas de deploy
    "Tu producto está vivo en api.tuapp.com + app.tuapp.com"
```

**Lo que esto significa**: Un developer en LATAM dice `construye "hazme un SaaS de facturación"` y en 30 minutos tiene un producto desplegado en producción con database, storage, API, frontend, custom domain. Sin tocar AWS. Sin configurar Docker. Sin YAML de Kubernetes.

**Orchestration con Workflows**:

Los deploys son tareas de larga duración perfectas para Cloudflare Workflows:

```typescript
class DeployWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    // Cada step es durable — si falla, retoma desde donde se quedó
    const db = await step.do("create-d1", () => createD1Database(projectName));
    const bucket = await step.do("create-r2", () => createR2Bucket(projectName));
    
    await step.do("run-migrations", () => runMigrations(db, migrationFiles));
    await step.do("configure-secrets", () => setupSecrets(projectSecrets));
    
    const workerUrl = await step.do("deploy-worker", () => deployWorker(code));
    const pagesUrl = await step.do("deploy-pages", () => deployPages(frontend));
    
    // Si algo falla a mitad del camino, los steps anteriores no se re-ejecutan
    await step.do("verify-health", () => healthCheck(workerUrl));
    
    return { workerUrl, pagesUrl, db, bucket };
  }
}
```

### Pilar 4: OPERATE — Observabilidad + Mantenimiento

**Servicios CF**: Pipelines (data ingestion), Analytics Engine (métricas), Workers Logs, AI Gateway (logging)

Un producto desplegado necesita ser operado. construye no te abandona después del deploy.

```
construye status mi-saas

Dashboard:
├── 📊 Requests/día: 12,450 (↑ 23% vs ayer)
├── ⚡ P95 latency: 34ms
├── 💰 Costo CF hoy: $0.47
├── 🔍 Errores últimas 24h: 3 (2 timeout, 1 validation)
├── 📈 Usuarios activos: 89
├── 🗄️ D1: 45MB / 10GB
└── 📦 R2: 234MB / 10GB

construye "investiga los 3 errores de hoy y arregla los que puedas"

Agent:
├── Lee logs de Workers (últimas 24h)
├── Identifica: 2 timeouts en /api/invoices (query D1 lenta)
├── Fix: Agrega índice a D1 + optimiza query
├── Identifica: 1 error de validación (campo "rfc" vacío)
├── Fix: Agrega validación en el endpoint
├── Deploy: Despliega fixes → verifica que erroes se resuelven
└── "Arreglé 3 errores y desplegué los fixes. El índice D1 redujo el P95 de 340ms a 34ms."
```

**Sistema de Observabilidad con Pipelines**:

```
┌──────────────┐    ┌───────────┐    ┌──────────────────┐
│ Workers Logs │───→│ Pipeline  │───→│ R2 (Apache       │
│ AI Gateway   │    │ SQL xform │    │ Iceberg/Parquet) │
│ User Events  │    │ 100MB/s   │    │                  │
│ Agent Actions│    └───────────┘    └────────┬─────────┘
└──────────────┘                              │
                                    ┌─────────▼─────────┐
                                    │  Analytics Engine  │
                                    │  Queries SQL sobre │
                                    │  datos agregados   │
                                    └───────────────────┘
```

Todo lo que ocurre en el ecosistema construye se ingesta via Pipelines:
- Cada acción del agente (qué hizo, cuánto costó, cuánto tardó)
- Cada request al producto desplegado
- Cada error, cada métrica de performance
- Almacenado como Parquet en R2 (queryable, exportable, barato)

Esto es la base del **audit trail enterprise** que Gartner dice falta en el 40% de proyectos AI.

### Pilar 5: CONNECT — Protocolos y Extensibilidad

**Servicios CF**: Agents SDK (McpAgent), Durable Objects (RPC transport), AI Gateway, Queues

construye no es un jardín cerrado. Es un nodo en un ecosistema más grande.

**MCP Nativo con RPC Transport (cero overhead)**:

```
┌────────────────────────────────────────────────────────┐
│                 construye.lat Worker                    │
│                                                         │
│  ┌──────────────────┐     RPC (DO binding)              │
│  │  ConstruyeAgent  │◄──────────────────────►┌────────┐│
│  │  (Agent class)   │   cero HTTP overhead   │McpAgent││
│  │                  │                         │GitHub  ││
│  │  Sesiones, loop, │                         │Slack   ││
│  │  estado, tools   │                         │Linear  ││
│  └──────────────────┘                         │Figma   ││
│                                               │DB      ││
│                                               │Custom  ││
│                                               └────────┘│
└────────────────────────────────────────────────────────┘
```

Descubrimiento clave: El Agents SDK de CF tiene `McpAgent` — un MCP server que corre como Durable Object con:
- **RPC transport**: Comunicación Agent↔McpAgent via binding de DO, sin HTTP, sin serialización extra
- **Hibernation**: El MCP server duerme cuando no se usa, solo paga por compute activo
- **OAuth integrado**: Para que terceros conecten sus herramientas
- **State sync**: Estado del MCP server sincronizado a la UI en tiempo real

**Esto significa**: construye puede exponer un MCP server para que CUALQUIER herramienta se conecte a él. Y puede consumir MCP servers de terceros (GitHub, Slack, Linear, Figma, bases de datos) con overhead cero porque todo vive en el mismo runtime CF.

**Agent-to-Agent (A2A)**:

```
construye Agent A (Backend) ←──→ construye Agent B (Frontend)
           │                              │
           ├── Comparten contexto via D1   │
           ├── Se notifican via Queues     │
           └── Sincronizan via DO state    │
```

### Pilar 6: COLLABORATE — Tiempo Real

**Servicios CF**: Realtime SFU (WebRTC), RealtimeKit, TURN Service, Durable Objects (WebSocket)

construye no es solo un tool — es un **compañero de trabajo** con el que puedes hablar, compartir pantalla, y colaborar en tiempo real.

**Pair Programming con Voz**:

```
construye pair --voice

[Realtime SFU activo — WebRTC audio bidireccional]

Tú: "Necesito que la tabla de invoices tenga un campo de currency"
Agent: "Entendido. Voy a agregar el campo currency como TEXT con default 'MXN'. 
        También actualizaré el schema de Drizzle y regeneraré los types.
        ¿También quieres que actualice los endpoints que crean facturas?"
Tú: "Sí, y agrega validación de ISO 4217"
Agent: [ejecuta cambios en sandbox — tú escuchas los resultados en audio]
```

**Sesiones Compartidas con Video**:

```
construye share --video

[RealtimeKit — video/audio para equipo]

├── Dev A: Trabaja en terminal, hace cambios
├── Dev B: Ve cambios en tiempo real en web dashboard  
├── Agente: Ejecuta, testea, reporta — visible para ambos
├── PM: Ve progreso desde mobile, aprueba deploys
└── Todo en una sesión DO sincronizada
```

**Stack técnico**:
- Realtime SFU: WebRTC media routing en red global CF (330+ ciudades)
- RealtimeKit: SDKs para integrar video/audio en web/mobile
- TURN Service: Relay para usuarios detrás de NAT/firewalls corporativos
- Durable Objects: Sincronización de estado de sesión para todos los participantes
- WebSocket Hibernation: Clientes inactivos no consumen compute

### Pilar 7: SECURE — Seguridad de Producción

**Servicios CF**: Secrets Store, Access, Zero Trust, Tunnel, WAF, DDoS Protection

Los productos que construye deploya están automáticamente protegidos.

```
construye secure mi-saas

Security audit automático:
├── ✅ Secrets Store: 4 secrets almacenados (ninguno hardcodeado)
├── ✅ WAF: Reglas auto-configuradas para la API  
├── ✅ DDoS: Protección automática (incluida en CF)
├── ✅ SSL/TLS: Full strict para custom domain
├── ⚠️ Auth: No hay rate limiting en /api/login — ARREGLANDO
├── ⚠️ CORS: Demasiado permisivo — ARREGLANDO
└── ✅ Audit: Todas las acciones del agente logueadas
```

**Secrets Store para gestión de credenciales**:

```typescript
// El agente NUNCA hardcodea secrets
// Usa Secrets Store de CF con scopes por worker

// wrangler.jsonc
{
  "secrets_store_bindings": [{
    "binding": "SECRETS",
    "store_id": "abc123"
  }]
}

// En el código generado por el agente:
const apiKey = await env.SECRETS.get("STRIPE_API_KEY");
// → Rotación automática, audit log, scoping por worker
```

**Zero Trust para Enterprise**:

```
construye enterprise setup

├── Cloudflare Access: SSO con empresa (SAML/OIDC)
├── Cloudflare Tunnel: Repos internos accesibles sin VPN
├── Permission Tiers: Qué agentes, qué tools, qué repos, qué budget
├── IP Restrictions: Solo desde oficinas/VPN corporativa
└── Compliance: Logs exportables para SOC 2 / ISO 27001
```

---

## 3. La Experiencia de Usuario End-to-End

### Escenario: "Quiero construir un SaaS de scheduling para peluquerías en México"

```
$ construye

construye v1.0.0 · kimi-k2.5 · session a7f3
›

› quiero construir un SaaS de agendamiento para peluquerías en México

  Analizando tu idea...
  
  Investigué el mercado de peluquerías en México (150K+ establecimientos).
  Propongo esta arquitectura:
  
  ┌─ Frontend ─────────────────────────────────┐
  │ React + Tailwind en CF Pages               │
  │ Vista calendario, booking público, admin    │
  └─────────────────────────────────────────────┘
  ┌─ API ──────────────────────────────────────┐
  │ Hono worker con auth, REST endpoints       │
  │ Webhooks para notificaciones               │
  └─────────────────────────────────────────────┘
  ┌─ Data ─────────────────────────────────────┐
  │ D1: usuarios, citas, servicios, salones    │
  │ R2: fotos de salones, avatares             │
  │ KV: cache de disponibilidad                │
  └─────────────────────────────────────────────┘
  ┌─ Extras ───────────────────────────────────┐
  │ Email Workers: confirmaciones + reminders  │
  │ Queues: procesamiento async de reminders   │
  │ Cron: limpieza de citas expiradas          │
  └─────────────────────────────────────────────┘
  
  Costo estimado CF: $5/mo para primeros 1,000 usuarios.
  
  ¿Empiezo a construir?

› sí, construye todo

  Activando Agent Team...
  
  ▸ Architect   diseñando schema D1...              3.2s ✓
  ▸ Coder-API   implementando 12 endpoints Hono...  18.4s ✓
  ▸ Coder-UI    creando 8 páginas React...           22.1s ✓
  ▸ Tester      42 tests escritos, 42 passing...     8.7s ✓
  ▸ Reviewer    0 issues críticos, 2 sugerencias...  4.1s ✓
  
  Código listo. ¿Despliego a producción?

› dale

  Desplegando via Workflow...
  
  ▸ create-d1     peluquerias-db creada              1.2s ✓
  ▸ migrations    6 tablas, 3 índices                0.8s ✓
  ▸ create-r2     peluquerias-assets creado           0.4s ✓
  ▸ secrets       3 secrets configurados              0.3s ✓
  ▸ deploy-api    api.peluquerias.mx                  2.1s ✓
  ▸ deploy-web    app.peluquerias.mx                  3.4s ✓
  ▸ health-check  todos los endpoints OK              1.1s ✓
  
  🟢 Tu producto está vivo:
     API:  https://api.peluquerias.mx
     App:  https://app.peluquerias.mx
     Admin: https://app.peluquerias.mx/admin
  
  Costo: $0.12 de AI + $0.00 de infra (free tier)
  Tiempo total: 4 minutos 23 segundos

› configura emails de confirmación para las citas

  Configurando Email Workers...
  
  ▸ email-worker  worker para confirmaciones        4.2s ✓
  ▸ queue-setup   cola para reminders (24h antes)   1.1s ✓
  ▸ cron-trigger  cada hora: procesa reminders      0.3s ✓
  ▸ templates     3 templates HTML (confirm/remind/cancel) 6.8s ✓
  ▸ deploy        actualizado en producción          2.4s ✓
  
  Emails configurados. Cuando un usuario agenda una cita:
  - Recibe confirmación inmediata
  - Reminder 24h antes
  - El dueño del salón recibe notificación
```

**Esto es construye.lat**: De idea a producto en producción en menos de 5 minutos.

---

## 4. Mapeo Completo: Servicio CF → Capacidad construye

| Servicio Cloudflare | Capacidad en construye | Pilar |
|---|---|---|
| **Workers** | Runtime de agentes, API gateway, lógica de negocio generada | BUILD, RUN |
| **Durable Objects** | Sesiones universales, estado de agentes, sandboxes | THINK, BUILD, COLLABORATE |
| **Agents SDK (Agent class)** | Agente principal con state sync, hibernation, SQLite built-in | THINK, BUILD |
| **Agents SDK (McpAgent)** | MCP servers con RPC transport, OAuth, cero HTTP overhead | CONNECT |
| **Sandbox SDK** | Containers Linux aislados para ejecución de código | BUILD |
| **Workers AI** | Modelos de código (Kimi K2.5), reasoning (QwQ-32B), fast (Qwen3), embeddings | THINK, BUILD |
| **AI Gateway** | Multi-provider routing, caching, rate limiting, fallback, logging | THINK |
| **Vectorize** | RAG sobre docs del proyecto, memoria semántica, knowledge base | THINK |
| **D1** | Base de datos del ecosistema + BD de productos generados | BUILD, RUN |
| **R2** | Archivos del ecosistema + assets de productos generados | BUILD, RUN |
| **KV** | Cache de sesión, cache de productos generados | BUILD, RUN |
| **Queues** | Comunicación async entre agentes, jobs de productos generados | BUILD, OPERATE |
| **Workflows** | Deploy pipelines, CI/CD durables, tareas de larga duración | RUN, OPERATE |
| **Pages** | Hosting de frontends generados + web dashboard de construye | RUN |
| **Pipelines** | Ingesta de logs/métricas/eventos → R2 como Iceberg/Parquet | OPERATE |
| **Analytics Engine** | Métricas de uso, performance, costos — para construye y productos generados | OPERATE |
| **Browser Rendering** | Headless browser para scraping, testing visual, screenshots | BUILD, THINK |
| **Realtime SFU** | Video/audio para pair programming y sesiones compartidas | COLLABORATE |
| **RealtimeKit** | SDKs para integrar real-time en web/mobile | COLLABORATE |
| **TURN Service** | Relay WebRTC para redes corporativas restrictivas | COLLABORATE |
| **Email Workers** | Emails transaccionales para productos generados + notificaciones construye | RUN, OPERATE |
| **Secrets Store** | Gestión segura de API keys para construye y productos generados | SECURE |
| **Cloudflare Access** | SSO/SAML para enterprise, OAuth para usuarios | SECURE |
| **Zero Trust / Tunnel** | Acceso seguro a repos internos, servicios privados | SECURE |
| **WAF** | Protección automática para productos generados | SECURE |
| **DDoS Protection** | Incluida gratis para todo lo desplegado en CF | SECURE |
| **DNS** | Gestión de dominios personalizados para productos | RUN |
| **Cron Triggers** | Jobs programados para productos generados | OPERATE |
| **Workers Logs** | Observabilidad de agentes y productos | OPERATE |

**Total: 30+ servicios CF mapeados a capacidades del ecosistema.**

---

## 5. Arquitectura Técnica del Ecosistema

### 5.1 El Worker Principal → Agent Class (no raw DO)

**Cambio crítico**: El `@construye/worker` actual extiende `DurableObject` directamente. Debe extender `Agent` del Agents SDK de CF.

```typescript
import { Agent } from "agents/ai";

// ANTES (actual — raw Durable Object)
export class ConstruyeAgent extends DurableObject {
  // Manual: WebSocket handling, state management, SQL...
}

// DESPUÉS (ecosistema — Agent class)
export class ConstruyeAgent extends Agent<Env, AgentState> {
  // GRATIS: SQLite per-instance, state sync, hibernation,
  //         scheduling, task queue, React hooks client SDK
  
  // Solo implementamos la lógica de negocio:
  async onMessage(connection, message) {
    // Agent loop con tool calling
  }
  
  // El estado se sincroniza automáticamente a todos los clientes
  // Web, CLI, Mobile — todos ven el mismo state en real-time
}
```

**Beneficios inmediatos**:
- SQLite built-in por instancia (no necesitamos D1 para estado de sesión)
- State sync automático a clientes via `useAgent()` React hook
- Hibernation: el agente duerme cuando no hay clientes, cero costo
- Scheduling: `this.schedule()` para tareas futuras
- Task queue: `this.addTask()` para background work

### 5.2 Sandbox → @cloudflare/sandbox

**Cambio crítico**: Reemplazar los stubs de `@construye/sandbox` con el Sandbox SDK real de CF.

```typescript
import { getSandbox } from "@cloudflare/sandbox";

export class SandboxOrchestrator {
  async createSandbox(env: Env, sessionId: string): Promise<Sandbox> {
    // Cada sesión tiene su propio container Linux aislado
    return getSandbox(env.Sandbox, sessionId);
  }
  
  async execute(sandbox: Sandbox, command: string): Promise<ExecResult> {
    return sandbox.exec(command);
  }
  
  async writeFile(sandbox: Sandbox, path: string, content: string) {
    await sandbox.fs.write(path, content);
  }
  
  async readFile(sandbox: Sandbox, path: string): Promise<string> {
    return sandbox.fs.read(path);
  }
  
  // Terminal en tiempo real — streaming a CLI/web
  async terminal(sandbox: Sandbox): Promise<WebSocket> {
    return sandbox.terminal();
  }
}
```

### 5.3 MCP Server vía McpAgent

construye expone capacidades como MCP server para que terceros las consuman:

```typescript
import { McpAgent } from "agents/mcp";

export class ConstruyeMcpServer extends McpAgent<Env, State, Props> {
  server = new McpServer({
    name: "construye",
    version: "1.0.0",
  });

  async init() {
    // Herramientas que construye expone al mundo
    this.server.tool("build_project", "Build a product from description", async (params) => {
      // ... orquesta agentes, sandbox, deploy
    });
    
    this.server.tool("deploy", "Deploy to Cloudflare", async (params) => {
      // ... workflow de deploy
    });
    
    this.server.tool("query_analytics", "Get product analytics", async (params) => {
      // ... lee Pipelines/Analytics Engine
    });
  }
}

// Comunicación Agent↔McpAgent via RPC (DO binding, cero HTTP)
// Desde el ConstruyeAgent:
const mcpResult = await this.env.MCP_SERVER.get(id).build_project({ desc: "..." });
```

### 5.4 Workflows para Operaciones Durables

```typescript
import { WorkflowEntrypoint } from "cloudflare:workers";

export class ProjectDeployWorkflow extends WorkflowEntrypoint<Env> {
  async run(event, step) {
    const { projectId, code, config } = event.payload;
    
    // Cada step se persiste — si falla, retoma desde el último exitoso
    const db = await step.do("provision-d1", async () => {
      return await createD1Database(this.env, projectId);
    });
    
    await step.do("run-migrations", async () => {
      return await runMigrations(db, code.migrations);
    });
    
    const bucket = await step.do("provision-r2", async () => {
      return await createR2Bucket(this.env, projectId);
    });
    
    await step.do("configure-secrets", async () => {
      return await setupSecrets(this.env, config.secrets);
    });
    
    const urls = await step.do("deploy-workers", async () => {
      return await deployToWorkers(this.env, code);
    });
    
    await step.do("health-check", async () => {
      return await verifyDeployment(urls);
    });
    
    // Puede esperar días/semanas si necesita aprobación humana
    // await step.sleep("wait-for-approval", "24 hours");
    
    return urls;
  }
}
```

### 5.5 Pipelines para Data Lake

```typescript
// Cada acción relevante se envía al Pipeline
await env.ANALYTICS_PIPELINE.send([{
  type: "agent_action",
  sessionId,
  action: "tool_call",
  tool: "edit_file",
  model: "kimi-k2.5",
  tokens: 1250,
  cost: 0.003,
  duration_ms: 2340,
  timestamp: Date.now(),
}]);

// Pipeline transforms SQL → almacena en R2 como Parquet
// Queryable via Analytics Engine o herramientas externas
// Retención infinita en R2 (sin egress fees)
```

---

## 6. Modelo de Negocio del Ecosistema

### 6.1 Pricing por Capas

| Plan | Precio | Incluye |
|---|---|---|
| **Gratis** | $0/mo | CLI local + API keys propias. Sin cloud. Sin deploy. |
| **Maker** | $9/mo | 1 proyecto desplegado en CF. 100 sesiones/mo. 1GB R2. Basic sandbox. |
| **Pro** | $29/mo | 5 proyectos. Sesiones ilimitadas. 10GB R2. Agent Teams. Voice pair. |
| **Team** | $19/user/mo | Todo Pro + governance + audit + sesiones compartidas. Min 3 users. |
| **Enterprise** | Custom | Self-hosted. SSO/SAML. Compliance. SLA. Dedicated support. |

### 6.2 Fuentes de Revenue

```
1. Suscripción mensual (SaaS) — revenue recurrente
2. Compute overage — si exceden límites de sandbox/AI
3. Marketplace de skills — skills premium (70/30 split)
4. Enterprise licensing — contratos anuales
5. Cloudflare referral — CF tiene programa de partners
```

### 6.3 El Loop Virtuoso

```
Más usuarios → Más productos desplegados en CF → Más datos de uso →
Mejores modelos de recomendación → Mejores agentes → Más usuarios

Más productos en CF → Más revenue para CF → Mejor soporte para construye →
Más features disponibles → Mejor ecosistema
```

---

## 7. Hoja de Ruta del Ecosistema

### Fase 0: Fundación (AHORA — 2 semanas)
- [ ] Migrar `@construye/worker` de raw DO a Agents SDK `Agent` class
- [ ] Implementar `@construye/sandbox` con `@cloudflare/sandbox` SDK
- [ ] Configurar MCP server via `McpAgent` con RPC transport
- [ ] Tests end-to-end: sesión → agent loop → sandbox → resultado

### Fase 1: Build + Run (semanas 3-6)
- [ ] Agent Teams funcionales (Architect + Coder + Tester + Reviewer)
- [ ] Workflow de deploy automatizado (D1 + R2 + Workers + Pages)
- [ ] Web dashboard con `useAgent()` hook para state sync real-time
- [ ] Sesiones universales: CLI ↔ Web sincronizados

### Fase 2: Operate + Connect (semanas 7-10)
- [ ] Pipeline de observabilidad (agent actions + product metrics → R2 Parquet)
- [ ] MCP client para herramientas externas (GitHub, Slack, Linear)
- [ ] Email Workers para notificaciones del ecosistema
- [ ] Secrets Store integrado para productos desplegados
- [ ] `construye status` — dashboard de salud de productos

### Fase 3: Collaborate + Secure (semanas 11-14)
- [ ] Pair programming con voz (Realtime SFU)
- [ ] Sesiones compartidas multi-usuario
- [ ] Cloudflare Access para SSO enterprise
- [ ] Audit trail completo exportable (SOC 2 ready)
- [ ] WAF auto-configurado para productos desplegados

### Fase 4: Marketplace + Scale (semanas 15+)
- [ ] Marketplace de skills (community + premium)
- [ ] Templates de productos ("SaaS de facturación", "E-commerce", "Blog")
- [ ] Multi-language (Go, Python, Rust — no solo JS/TS)
- [ ] Mobile app (React Native, reusa useAgent hooks)
- [ ] Self-hosted enterprise edition

---

## 8. Por Qué Esto Gana

### 8.1 vs. Los Coding Agents (Cursor, Claude Code, Copilot)

Ellos te ayudan a **escribir código**. Nosotros te ayudamos a **construir productos**.

Ellos terminan cuando el código está escrito. Nosotros terminamos cuando el producto está en producción, con base de datos, storage, emails, analytics, seguridad y monitoring.

### 8.2 vs. Los PaaS/IaaS (Vercel, Railway, Render, Heroku)

Ellos te dan infraestructura que TÚ tienes que configurar. Nosotros configuramos la infraestructura POR TI con un agente AI.

"construye deploy" vs 45 minutos de dashboards, CLIs y YAML.

### 8.3 vs. Devin / Replit Agent

Ellos son caros ($500/mo Devin), opacos, y no te dan control del output. Nosotros somos accesibles ($9/mo), transparentes (ves cada acción del agente), y todo corre en TU cuenta de Cloudflare.

### 8.4 La Ventaja LATAM

- **Pricing**: $9/mo es alcanzable para devs de LATAM (vs $20-200/mo de la competencia)
- **Idioma**: construye habla español nativamente — no es un wrapper sobre un producto en inglés
- **Localización**: Templates para regulación local (SAT México, SUNAT Perú, SII Chile)
- **Latencia**: CF tiene PoPs en Ciudad de México, São Paulo, Santiago, Bogotá, Lima, Buenos Aires
- **Dominio**: construye.lat — el .lat es una declaración de identidad

### 8.5 El Moat Real

```
1. ECOSYSTEM LOCK-IN: Si tu producto corre en construye + CF, migrar es doloroso
   (porque construye conoce tu infra, tu código, tu data, tus patrones)

2. DATA MOAT: Cada producto construido nos da datos sobre patrones de arquitectura,
   errores comunes, costs óptimos → agentes cada vez más inteligentes

3. NETWORK EFFECT: Skills del marketplace = más valor para todos.
   Templates de productos = más gente construyendo = más templates.

4. COST ADVANTAGE: 100% CF stack = pricing predecible, sin egress, sin middlemen.
   91% más barato que Claude Code, 75% más barato que Devin.

5. LATAM-FIRST: Nadie está optimizando para este mercado.
   Primero en ganar LATAM = posición defensible.
```

---

## 9. Visión Final

**construye.lat no compite con Cursor. No compite con Claude Code.**

construye.lat **crea una nueva categoría**: **Product Factory as a Service**.

Un lugar donde dices lo que quieres construir, y un equipo de agentes AI:
1. **Piensa** la arquitectura (THINK)
2. **Construye** el código (BUILD)
3. **Despliega** el producto (RUN)
4. **Opera** la infraestructura (OPERATE)
5. **Conecta** con herramientas externas (CONNECT)
6. **Colabora** contigo en tiempo real (COLLABORATE)
7. **Asegura** todo el stack (SECURE)

Todo corriendo en Cloudflare. Todo a $9/mo. Todo en español.

**"No construyas código. Construye productos."**

Ese es el tagline. Ese es construye.lat.
