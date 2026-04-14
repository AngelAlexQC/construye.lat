# construye.lat — La Fábrica de Productos que Supera a Todos

> Fecha: Julio 2026
> Status: VISIÓN ESTRATÉGICA V2 — Respaldada por investigación competitiva profunda
> Premisa: "Una plataforma para construir software de principio a fin, mejor que todo pero más simple"

---

## 0. El Problema que Nadie Resuelve

### La industria está rota

El mercado de plataformas AI para desarrollo está en **$72.18B** (2026) y crece al 10.62% anual. Lovable factura **$206M ARR** (2,800% crecimiento YoY). Replit **$253M ARR**. El dinero está ahí. Pero hay un problema masivo que nadie quiere admitir:

**El 95% de los pilotos de GenAI fallan en llegar a "implementación exitosa"** (Gartner 2026).
**El 80%+ de proyectos AI no entregan valor medible**.
**Gartner predice un aumento del 2,500% en defectos de software generado por AI**.

¿Por qué? Porque todas las herramientas actuales resuelven el problema equivocado.

### El "Doom Loop" — El enemigo invisible

Existe un patrón que los usuarios de Bolt, Lovable y Replit conocen bien pero nadie habla abiertamente:

```
Prompt → Código generado → Bug → Prompt para arreglar → Nuevo bug →
Prompt para arreglar el fix → Código espagueti → Proyecto reiniciado desde cero
```

Esto se llama el **Doom Loop** y es la razón real por la que el 95% falla. El código AI es "altamente funcional pero sistemáticamente carente de juicio arquitectónico". Funciona el primer día. El segundo día empiezas a pagar deuda técnica. El tercer día estás atrapado.

**Ninguna herramienta actual resuelve esto.** Todas compiten en velocidad de generación. Ninguna compite en calidad de arquitectura, mantenibilidad, o ciclo de vida completo.

construye sí.

---

## 1. Mapa Competitivo: Dónde Falla Cada Uno

### 1.1 Matriz de Comparación Detallada

| Dimensión | v0 (Vercel) | GitHub Spark | Claude Code | Bolt.new | Lovable | Replit | Google Stitch/AI Studio | **construye** |
|---|---|---|---|---|---|---|---|---|
| **Precio** | $20/mo | $39/mo (Pro+) | $20-200/mo | $25/mo | $25/mo | $17-20/mo real $50-150 | Gratis | **$9/mo** |
| **Genera código** | ✅ React/Next.js | ✅ Apps simples | ✅ Cualquier lenguaje | ✅ Multi-framework | ✅ React/TS | ✅ 50+ lenguajes | ✅ 7 frameworks UI | ✅ Cualquier stack |
| **Despliega** | ✅ Vercel only | ✅ Codespace | ❌ No despliega | ✅ Bolt Cloud | ✅ Netlify/Vercel | ✅ Replit only | ✅ Firebase only | ✅ Cloudflare (usuario lo posee) |
| **Base de datos** | ✅ Vercel DB | ❌ | ❌ | ✅ Bolt Cloud DB | ✅ Supabase | ✅ PostgreSQL | ✅ Firestore auto | ✅ D1 auto-provisionada |
| **Auth integrada** | ❌ | ❌ | ❌ | ✅ Bolt Cloud | ✅ Supabase Auth | ✅ Replit Auth | ✅ Firebase Auth | ✅ CF Access + custom |
| **Storage** | ❌ | ❌ | ❌ | Limitado | ✅ Supabase Storage | Limitado | ✅ Firebase Storage | ✅ R2 (S3-compatible, 0 egress) |
| **Emails** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Email Workers |
| **Colas/Jobs** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Queues + Workflows |
| **Observabilidad** | ❌ | ❌ | ❌ | ❌ | ❌ | Básica | ❌ | ✅ Pipelines + Analytics |
| **Opera post-deploy** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Monitoreo + auto-fix |
| **Sandbox aislado** | ❌ (tu máquina) | Codespace | ❌ (tu terminal) | WebContainers (browser) | ❌ | Container propio | ❌ | ✅ CF Sandbox (Linux containers) |
| **Multi-agente** | ❌ | ❌ | En desarrollo | ❌ | ❌ | ❌ | ❌ | ✅ Agent Teams |
| **Tiempo real** | ❌ | ❌ | ❌ | ❌ | ❌ | Multiplayer básico | ❌ | ✅ WebRTC SFU + DO state |
| **Voice/Pair** | ❌ | ❌ | En alpha | ❌ | ❌ | ❌ | ❌ | ✅ Realtime SFU |
| **Open source** | ❌ | ❌ | ❌ | ✅ Motor | ❌ | ❌ | ❌ | ✅ Completo |
| **CLI + Web + Mobile** | Solo web | Solo web | Solo CLI | Solo web | Solo web | Solo web | Solo web | ✅ Sesiones universales |
| **Anti-doom-loop** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Harness Engineering |
| **LATAM nativo** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Español nativo |
| **El usuario posee la infra** | ❌ (Vercel) | ❌ (GitHub) | N/A | ❌ (Bolt Cloud) | ❌ (Supabase) | ❌ (Replit) | ❌ (Firebase/GCP) | ✅ Tu cuenta CF |

### 1.2 Análisis Individualizado

#### v0 by Vercel — El generador de UI premium
- **Fortaleza**: Código React/Next.js limpio con shadcn/ui. Desde Feb 2026: editor tipo VS Code, integración Git, conectividad a DB, workflows agénticos. Mejor calidad de UI generada del mercado.
- **Debilidad fatal**: Frontend-first. Pricing basado en créditos que se queman rápido en proyectos complejos. Lock-in total a Vercel. No maneja backend complejo, no opera el producto post-deploy, no tiene sandbox aislado. Es un generador de components, no una fábrica de productos.
- **Lo que construye toma**: La obsesión por calidad de código generado. Debemos generar código tan limpio como v0.

#### GitHub Spark — El prototipador corporativo
- **Fortaleza**: Dentro del ecosistema GitHub con Codespace + Copilot agent mode. Natural language → app funcional.
- **Debilidad fatal**: Apps pequeñas y simples. Exclusivo para Pro+ ($39/mo). Limitado en scope — no despliega a producción real, no maneja infra, no opera. Es un juguete corporativo para demos rápidas.
- **Lo que construye toma**: La idea de estar embebido en el workflow existente del developer (GitHub).

#### Claude Code — El agente más poderoso del mundo
- **Fortaleza**: SWE-bench 80.8%. Auto Mode (clasificador AI de permisos). Dispatch (cola de tareas para PRs autónomos). Channels (pub/sub entre agentes). Remote Control (teléfono/browser). Voice mode. Features filtrados: KAIROS (daemon autónomo), ULTRAPLAN (planificación remota 30min con Opus), Coordinator (multi-agente), BUDDY. El más potente técnicamente.
- **Debilidad fatal**: No despliega NADA. Funciona solo en tu terminal. Caro ($20-200/mo, un kernel compile costó $20K). Sin web dashboard. Sin observabilidad. Sin infra management. Es un genio que vive en una terminal y nunca sale de ella. La potencia bruta sin infraestructura es solo potencia desperdiciada.
- **Lo que construye toma**: MUCHÍSIMO.
  - **Dispatch** → Nuestro sistema de Agent Teams con cola de tareas
  - **Channels** → Nuestro pub/sub via CF Queues entre agentes
  - **KAIROS** → Agente daemon que monitorea productos desplegados 24/7
  - **Coordinator** → Nuestro Architect agent que orquesta equipos
  - **Memory** → Vectorize + D1 para memoria semántica + estructurada
  - **Auto Mode** → Nuestro sistema de permisos con approval tiers

#### Bolt.new — El open source que validó el modelo
- **Fortaleza**: Motor open source. Browser-based, multi-framework. Bolt Cloud agregó DB, auth, hosting. $25/mo por 10M tokens.
- **Debilidad fatal**: Debug loops queman tokens exponencialmente. Código funcional pero no mantenible. Sin observabilidad post-deploy. WebContainers son limitados (browser sandbox, no Linux real). Y lo más importante: Bolt Cloud es su respuesta a la falta de infra, pero es otra capa de abstracción que el usuario no controla.
- **Lo que construye toma**: La prueba de que open source gana comunidad. Y que la ejecución in-browser es valorada (podemos ofrecer preview URLs via Sandbox SDK).

#### Lovable (ex-GPT Engineer) — El unicornio de $206M ARR
- **Fortaleza**: De $7M a $206M ARR en un año (2,800% crecimiento). Full-stack con Supabase integration. Extremadamente amigable para no-técnicos. 
- **Debilidad fatal**: Lock-in total a Supabase para backend. Solo React/TS. No maneja backends complejos (microservicios, colas, cron jobs). No opera el producto. El crecimiento viene de non-devs que construyen MVPs — cuando el producto necesita escalar, Lovable no puede seguir.
- **Lo que construye toma**: La simplicidad radical de UX. "Describe what you want" debe ser nuestro punto de entrada también.

#### Replit — El IDE que casi lo logra
- **Fortaleza**: $253M ARR. Agent 3 con "10x más autonomía". Full IDE. 50+ lenguajes. 75% de usuarios nunca escriben código. El más cercano a ser una plataforma completa.
- **Debilidad fatal**: Costo real $50-150/mo para uso activo. Platform dependency total (tu código vive en Replit, no en tu infra). Performance limitado para producción real. No tiene emails, colas, workflows, analytics, CDN global. Es un IDE con superpoderes, no una fábrica de productos.
- **Lo que construye toma**: La idea de que el 75% nunca escribe código. Nuestro UX debe funcionar para ese 75%.

#### Google Stitch + AI Studio + Firebase — El gigante gratuito
- **Fortaleza**: GRATIS (550 generaciones/mo). Stitch genera UI en 7 frameworks (HTML, CSS, Tailwind, Vue, Angular, Flutter, SwiftUI). AI Studio evolucionó a plataforma full-stack: Firebase auto-provisioning, auth, secrets, API wiring, todo en una superficie. Antigravity como coding agent. Firestore con realtime sync.
- **Debilidad fatal**: Como dijo un analista: "The entry cost is zero. The exit cost builds quietly." Esto es captura de infraestructura. Cada app cae en Firebase → Firebase enruta a Google Cloud → dependencia compuesta. No es open source. No tienes control. Google mata productos (recuerda Google+, Stadia, Domains). Y el stack es pesado — Firebase SDK, GCP billing, Firebase console, Google Cloud console — la complejidad explota cuando sales del demo.
- **Lo que construye toma**: La idea de auto-provisioning. Cuando construye despliega, debería auto-crear D1, R2, secrets, todo — como hace Firebase pero en infraestructura que el usuario controla directamente.

### 1.3 El Patrón que Todos Ignoran

```
                    GENERACIÓN          DEPLOY          PRODUCCIÓN
                    (código)            (infra)         (operación)
                    
v0                  ████████████        ███░░░░░░       ░░░░░░░░░░
GitHub Spark        ██████░░░░░░        ██░░░░░░░       ░░░░░░░░░░
Claude Code         ████████████████    ░░░░░░░░░       ░░░░░░░░░░
Bolt.new            ████████████        █████░░░░       ░░░░░░░░░░
Lovable             ██████████░░        ██████░░░       ░░░░░░░░░░
Replit              ██████████░░        ████████░       ██░░░░░░░░
Google AI Studio    ████████░░░░        ████████░       █░░░░░░░░░
                    
construye           ████████████████    ██████████      ██████████
```

**Nadie cubre el ciclo completo.** Todos paran en algún punto. construye es el primero en ir de punta a punta: IDEA → CÓDIGO → TEST → DEPLOY → OPERA → MANTIENE → ESCALA.

---

## 2. La Tesis de construye: Por Qué Ganamos

### 2.1 No somos un editor de código. Somos una fábrica de productos.

La pregunta correcta nunca fue "¿cómo escribo código más rápido?"

La pregunta correcta es: **"¿cómo paso de una idea a un producto en producción que funciona, escala y se mantiene solo?"**

Cada competidor responde la primera pregunta. Solo construye responde la segunda.

### 2.2 Los 5 Principios Anti-Doom-Loop

El Doom Loop existe porque las herramientas actuales optimizan velocidad de generación y ignoran calidad arquitectónica. construye invierte eso:

#### Principio 1: ARQUITECTURA ANTES QUE CÓDIGO
```
Competencia:                          construye:
"prompt" → código → bugs → doom loop  "prompt" → ARCHITECT agent analiza →
                                      propone schema + estructura →
                                      usuario aprueba → CODER genera →
                                      TESTER valida → REVIEWER verifica →
                                      código sólido desde el inicio
```

El agent Architect (reasoning model, QwQ/Kimi) piensa la estructura ANTES de que se escriba una línea de código. Analiza patrones de proyectos similares (DATA MOAT), propone schema de base de datos, define interfaces de API, establece convenciones. El código se genera DESPUÉS, dentro de un marco arquitectónico sólido.

#### Principio 2: SANDBOX VERIFICABLE — NUNCA CÓDIGO CIEGO
```
Competencia:                          construye:
Genera código → lo muestra al         Genera código → ejecuta en Sandbox →
usuario → el usuario copia/pega       corre tests → verifica types → corre
→ puede funcionar o no                linter → preview URL funcional →
                                      TODO verificado antes de entregarse
```

Cada pieza de código se ejecuta en un CF Sandbox (container Linux real, no WebContainers del browser). Tests se corren automáticamente. Si algo falla, el agente lo arregla EN el sandbox antes de mostrarlo al usuario. El usuario nunca ve código roto.

#### Principio 3: MULTI-AGENTE CON ROLES EXPLÍCITOS
```
Competencia:                          construye:
Un solo LLM hace todo                 Architect: diseña (reasoning model)
                                      Coder A/B: implementan (coding model)  
                                      Tester: escribe y ejecuta tests
                                      Reviewer: revisa seguridad, patrones
                                      Deployer: despliega y verifica
                                      Monitor: observa en producción
```

Inspirado en Claude Code's Coordinator (filtrado) y Dispatch (cola de tareas). Pero mejor: cada agente tiene un modelo optimizado para su rol, ejecuta en su propio contexto, y hay checks entre ellos. El Coder no puede saltarse al Tester. El Reviewer tiene veto.

#### Principio 4: MEMORIA ESTRUCTURADA — NO SOLO CONTEXTO
```
Competencia:                          construye:
Contexto de chat (se pierde)          Vectorize: memoria semántica
                                      D1: decisiones, convenciones, errores
                                      AGENTS.md: memoria de repo
                                      Session state: DO con SQLite per-instance
```

Inspirado en Claude Code's "Strict Write Discipline" memory y OpenCode's AGENTS.md. Pero con infraestructura real: Vectorize para búsqueda semántica sobre todo el historial, D1 para decisiones estructuradas ("en este proyecto usamos Hono, no Express"), session state sincronizado a todos los clientes.

#### Principio 5: OPERACIÓN POST-DEPLOY — EL PRODUCTO VIVE
```
Competencia:                          construye:
"Aquí está tu código, adiós"          Deploy → Monitorear → Alertar →
                                      Auto-diagnosticar → Auto-arreglar →
                                      Reportar → El producto mejora solo
```

Inspirado en Claude Code's KAIROS (daemon autónomo filtrado). construye tiene un agente "Monitor" que, via Cron Triggers, verifica health de productos desplegados, lee logs via Workers Logs, analiza métricas via Analytics Engine, y puede crear fixes automáticos desplegados via Workflows. El producto no solo está vivo — MEJORA con el tiempo.

---

## 3. La Ventaja Técnica: Cloudflare como Superpoder

### 3.1 Dos Capas de Ejecución — Lo que Nadie Más Tiene

construye es el ÚNICO que tiene dos capas de sandboxing, cada una para un propósito diferente:

#### Capa 1: Dynamic Worker Loader — 100x Más Rápido que Containers

```typescript
// Para código generado de producción (JS/TS)
// Isolates V8 — arrancan en milisegundos, MB de memoria
// Un Worker puede instanciar otro Worker EN RUNTIME con código del LLM

const dynamicWorker = await env.DYNAMIC_DISPATCH.get(
  "user-generated-api",
  { code: llmGeneratedCode }
);

// TypeScript RPC via Cap'n Web — el código generado llama interfaces tipadas
// sin razonar sobre HTTP. Más barato en tokens, más seguro.

// Credential injection — el código NUNCA ve los secrets
// globalOutbound inyecta API keys en requests salientes automáticamente

// Code Mode SDK — normaliza código generado, maneja errores de formato,
// controla acceso a red via fetcher binding
```

**Por qué importa**: Mientras Bolt usa WebContainers (browser, limitado) y Replit usa containers (lentos, caros), nosotros ejecutamos código generado por AI en isolates V8 que arrancan en milisegundos, sin límites globales de concurrencia, con inyección automática de credenciales. **100x más rápido que containers, 10-100x más eficiente en memoria.**

#### Capa 2: CF Sandbox SDK — Linux Real Cuando lo Necesitas

```typescript
import { getSandbox } from "@cloudflare/sandbox";

// Para desarrollo completo — container Linux (Ubuntu) aislado
const sandbox = getSandbox(env.Sandbox, sessionId);

// Docker-in-Docker para testing de infra
await sandbox.exec("docker compose up -d");

// Python, Go, Rust — cualquier lenguaje
await sandbox.exec("cargo test");
await sandbox.exec("python3 -m pytest");

// Preview URLs automáticas para que el usuario vea su app
const preview = await sandbox.preview(3000);
// → https://abc123.sandbox.construye.lat

// Terminal en tiempo real via WebSocket
const ws = await sandbox.terminal();
// → El usuario ve el terminal live en CLI/web/mobile

// Storage persistente con R2 mounting
// El filesystem sobrevive entre sesiones
```

**La combinación**: Dynamic Workers para producción (rápido, barato, seguro). Sandbox para desarrollo (completo, flexible, cualquier lenguaje). Nadie más tiene esto.

### 3.2 Agents SDK — El Framework de Agentes Más Avanzado

Cloudflare acaba de actualizar el Agents SDK con:

```typescript
import { Agent } from "agents/ai";

export class ConstruyeAgent extends Agent<Env, AgentState> {
  // SQLite built-in per-instance (no necesitamos D1 para estado)
  // State sync automático a TODOS los clientes
  // Hibernation: duerme sin websockets, cero costo
  // Scheduling: this.schedule() para tareas futuras
  // Task queue: this.addTask() para background work
  // Zod 4 para validación de schemas
}

// En el cliente (React):
const agent = useAgent({ agent: "construye", name: sessionId });
// agent.state → estado sincronizado en tiempo real
// agent.state se actualiza automáticamente sin useState+onStateUpdate

// TypeScript inference completa:
const client = new AgentClient<ConstruyeAgent>({
  agent: "construye",
  host: window.location.host,
});
// Typed RPC stubs — autocomplete en IDE
await client.stub.buildProject({ description: "..." });
await client.stub.deploy();
```

**Por qué importa**: Claude Code tiene que inventar su propio sistema de estado, memoria, y comunicación. Replit tiene que mantener infraestructura de WebSockets propia. Nosotros obtenemos todo GRATIS del Agents SDK: sincronización de estado, hibernation, scheduling, typed RPC, React hooks. Menos código nuestro = menos bugs = más rápido al mercado.

### 3.3 VibeSDK Validó Nuestro Enfoque

VibeSDK — un proyecto open source — YA demostró que "Bolt.new en Cloudflare" funciona:
- Multi-LLM routing via AI Gateway
- Deploy a Workers/Pages
- Sandboxed execution
- Self-hosted, sin vendor lock-in

Pero VibeSDK es solo la capa BUILD. construye es el ecosistema completo: THINK + BUILD + RUN + OPERATE + CONNECT + COLLABORATE + SECURE. VibeSDK valida que el enfoque CF-native es viable. construye lo lleva 10x más lejos.

### 3.4 Los 30+ Servicios CF como Primitivos

```
┌─────────────────────────────────────────────────────────────────────┐
│                    construye.lat ECOSYSTEM v2                        │
│                                                                      │
│   "De la idea al producto que se opera solo"                        │
│                                                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │ THINK  │→│ BUILD  │→│  TEST  │→│  RUN   │→│OPERATE │→│MAINTAIN││
│  │        │ │        │ │        │ │        │ │        │ │        ││
│  │Planear │ │Codear  │ │Sandbox │ │Deploy  │ │Monitor │ │Iterar  ││
│  │Diseñar │ │Multi-  │ │Verify  │ │Infra   │ │Alertar │ │Mejorar ││
│  │Decidir │ │Agent   │ │Quality │ │Escalar │ │Auto-fix│ │Escalar ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘│
│                                                                      │
│  COMPUTE      Workers · DO · Containers · Sandbox · Dynamic Workers  │
│  AI           Workers AI · AI Gateway · Vectorize · Agents SDK       │
│  STORAGE      R2 · D1 · KV · Queues                                 │
│  DATA         Pipelines · Analytics Engine                           │
│  WEB          Pages · Browser Rendering                              │
│  REALTIME     SFU · RealtimeKit · TURN                               │
│  COMMS        Email Workers · Notifications                          │
│  SECURITY     Secrets Store · Access · Zero Trust · WAF · DDoS       │
│  NETWORK      Tunnel · Spectrum · DNS                                │
│  ORCHESTR     Workflows · Cron Triggers                              │
│                                                                      │
│  SURFACES     CLI · Web Dashboard · API · MCP · CI/CD · Mobile       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Arquitectura del Producto

### 4.1 Sesiones Universales — Ningún Competidor lo Tiene

La killer feature que nadie ofrece: **inicias en terminal, revisas desde el celular, tu team lead aprueba desde el dashboard web — todo en la misma sesión live.**

```
┌──────────┐     ┌─────────────────────────────┐     ┌──────────┐
│   CLI    │◄───►│   ConstruyeAgent (DO)       │◄───►│   Web    │
│ Terminal │     │                              │     │Dashboard │
└──────────┘     │   SQLite state              │     └──────────┘
                 │   ├── conversación          │
     ┌──────┐   │   ├── archivos en sandbox    │   ┌──────────┐
     │Mobile│◄─►│   ├── logs de agentes        │◄─►│   API    │
     │ App  │   │   ├── métricas de deploy     │   │ Externa  │
     └──────┘   │   └── estado de producción   │   └──────────┘
                │                              │
                │   useAgent() → React hook    │
                │   AgentClient → Vanilla JS   │
                │   WebSocket con hibernation  │
                └─────────────────────────────┘
```

**El agente ES un Durable Object.** Su estado es la sesión. Todos los clientes se conectan al mismo DO. State sync automático via Agents SDK. Cuando nadie está conectado, el DO hiberna. Cero costo.

### 4.2 Agent Teams — Multi-Agente con Especializacion

Inspirado en Claude Code's **Coordinator + Dispatch** pero con separación de responsabilidades real:

```
                    ┌─────────────────────┐
                    │   ORCHESTRATOR      │
                    │   (ConstruyeAgent)  │
                    │                     │
                    │   Recibe el prompt  │
                    │   Decide estrategia │
                    │   Asigna tareas     │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌──────▼─────┐  ┌────▼────────┐
     │ ARCHITECT  │  │  CODER(s)  │  │   TESTER    │
     │ QwQ-32B    │  │ Kimi K2.5  │  │ Qwen3-Coder │
     │            │  │            │  │             │
     │ Schema DB  │  │ Implementa │  │ Tests auto  │
     │ API design │  │ código en  │  │ Coverage    │
     │ Structure  │  │ Sandbox    │  │ Edge cases  │
     └────────────┘  └────────────┘  └─────────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────────┐
                    │     REVIEWER        │
                    │     QwQ-32B         │
                    │                     │
                    │  Security check     │
                    │  Architecture check │
                    │  Debt detection     │
                    │  Approve / Request  │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────┐
                    │     DEPLOYER        │
                    │     (Workflow)      │
                    │                     │
                    │  D1 · R2 · Workers  │
                    │  Pages · Secrets    │
                    │  DNS · Health check │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────┐
                    │     MONITOR         │
                    │     (Cron daemon)   │
                    │                     │
                    │  Logs · Métricas    │
                    │  Alertas · Auto-fix │
                    │  Reports · Suggest  │
                    └─────────────────────┘
```

**Comunicación entre agentes**: Via CF Queues (pub/sub asíncrono) + DO RPC (síncrono cuando se necesita). No HTTP entre agentes — todo es binding nativo CF con overhead cero.

**Modelo por rol** (optimizado, no un solo modelo para todo):

| Agente | Modelo | Por qué |
|---|---|---|
| Orchestrator | Qwen3-30B-A3B (fast) | Routing rápido, decisiones de estrategia |
| Architect | QwQ-32B (reasoning) | Piensa profundo antes de diseñar |
| Coder | Kimi K2.5 (coding) | Mejor coding model accessible via Workers AI |
| Tester | Qwen3-Coder (balanced) | Escribe tests completos, no solo stubs |
| Reviewer | QwQ-32B (reasoning) | Detecta problemas arquitectónicos que el coder no ve |
| Deployer | Determinístico (Workflow) | No necesita LLM — es un pipeline |
| Monitor | Qwen3-30B-A3B (fast) | Análisis rápido de logs/métricas |

### 4.3 El Sistema Anti-Doom-Loop: Harness Engineering

El concepto más importante de construye. Cada fase del desarrollo tiene **guardrails automáticos**:

```
ANTES de generar código:
├── schema_validation    → Schema D1 validado contra best practices
├── api_design_check     → Endpoints siguen REST/HATEOAS correctamente
├── dependency_audit     → Deps verificadas (no deprecated, no vulnerables)
└── architecture_match   → Patrón coincide con decisiones previas del proyecto

DURANTE la generación:
├── type_check           → TypeScript strict, zero any
├── lint_check           → Biome/ESLint en cada archivo generado
├── test_execution       → Tests corren en Sandbox ANTES de entregar
├── security_scan        → No hardcoded secrets, no SQL injection, no XSS
└── sandbox_verification → El código COMPILA Y EJECUTA en container real

DESPUÉS del deploy:
├── health_check         → Endpoints responden correctamente
├── performance_check    → P95 latency dentro de thresholds
├── error_monitoring     → Cron daemon verifica logs cada hora
├── cost_tracking        → Alerta si CF billing excede expectativas
└── regression_check     → Tests e2e contra producción periódicamente
```

**Esto es lo que previene el Doom Loop.** No es solo "generar código rápido". Es generar código correcto, verificado, y monitoreado. Claude Code genera rápido pero no verifica en infra real. Bolt genera y despliega pero no verifica ni monitorea. construye hace TODO.

### 4.4 MCP: construye como Hub del Ecosistema

```typescript
import { McpAgent } from "agents/mcp";

// construye EXPONE herramientas via MCP
export class ConstruyeMcpServer extends McpAgent<Env, State, Props> {
  server = new McpServer({ name: "construye", version: "2.0.0" });

  async init() {
    this.server.tool("build_project", schema, handler);
    this.server.tool("deploy", schema, handler);
    this.server.tool("status", schema, handler);
    this.server.tool("fix_error", schema, handler);
  }
}

// construye CONSUME herramientas externas via MCP
// GitHub, Slack, Linear, Figma, Supabase, Stripe...
// Todo via RPC transport (DO binding) — cero HTTP overhead
const github = await this.env.MCP_GITHUB.get(id);
await github.createPullRequest({ ... });
```

**Por qué MCP es clave**: Cualquier IDE (Cursor, VS Code, Claude Desktop) puede conectarse a construye como MCP server. Cualquier herramienta (GitHub, Slack) puede ser consumida por construye como MCP client. construye se convierte en el **hub central** del workflow del developer.

---

## 5. La Experiencia de Usuario: Radical Simplicity

### 5.1 Principio: Si Lovable llega a no-devs con 0 código, construye llega a devs con 0 configuración

El 75% de usuarios de Replit nunca escriben código. Lovable creció 2,800% porque no-devs pueden construir. construye debe ser igual de simple PERO con el poder de un dev senior detrás.

### 5.2 La Experiencia Completa (5 Minutos de Idea a Producción)

```
$ construye "SaaS de facturación electrónica para México con CFDI 4.0"

╭─ construye v2.0 ─────────────────────────────────────────────╮
│                                                               │
│  Analizando tu idea...                                        │
│                                                               │
│  ┌─ Investigación ──────────────────────────────────────────┐ │
│  │ • Mercado: 5.2M empresas en México requieren CFDI 4.0   │ │
│  │ • Regulación: SAT requiere XML firmado con CSD           │ │
│  │ • Competencia: Facturama ($29/mo), Contpaq (legacy)      │ │
│  │ • Oportunidad: PYMES buscan solución simple y barata     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Arquitectura propuesta ─────────────────────────────────┐ │
│  │ Frontend:  React + Tailwind (CF Pages)                   │ │
│  │ API:       Hono + Drizzle (CF Worker)                    │ │
│  │ Database:  D1 (empresas, facturas, clientes, productos)  │ │
│  │ Storage:   R2 (XML firmados, PDFs, CSD certs)            │ │
│  │ Email:     Email Workers (envío de facturas)              │ │
│  │ Queue:     Queues (timbrado async con PAC)               │ │
│  │ Cron:      Limpieza, reportes mensuales al SAT           │ │
│  │ Auth:      JWT + CF Access                                │ │
│  │ Costo CF:  ~$5/mo para primeros 500 empresas             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ¿Empiezo a construir? [sí/modificar/más info]                │
╰───────────────────────────────────────────────────────────────╯

› sí

╭─ Agent Team activado ────────────────────────────────────────╮
│                                                               │
│  ▸ Architect   schema D1 (8 tablas, 5 índices)    ✓  3.1s   │
│  ▸ Architect   API design (23 endpoints Hono)      ✓  2.8s   │
│  ▸ Coder-A     API + handlers + validations        ✓  21.3s  │
│  ▸ Coder-B     UI (12 páginas, responsive)         ✓  24.7s  │
│  ▸ Coder-C     CFDI XML generator + PAC client     ✓  14.2s  │
│  ▸ Tester      67 tests, 67 passing, 94% coverage  ✓  9.8s   │
│  ▸ Reviewer    0 critical, 1 suggestion applied     ✓  4.5s   │
│                                                               │
│  Código verificado en Sandbox. ¿Despliego? [sí/revisar]      │
╰───────────────────────────────────────────────────────────────╯

› sí

╭─ Deploy Workflow ─────────────────────────────────────────────╮
│                                                               │
│  ▸ create-d1       facturacion-mx-db            ✓  1.2s      │
│  ▸ migrations      8 tablas, 5 índices, seeds   ✓  0.9s      │
│  ▸ create-r2       facturacion-mx-files         ✓  0.4s      │
│  ▸ secrets         PAC_KEY, SAT_CERT, JWT_SECRET ✓  0.3s     │
│  ▸ deploy-api      api.factura.mx               ✓  2.3s      │
│  ▸ deploy-web      app.factura.mx               ✓  3.1s      │
│  ▸ email-worker    envío de facturas            ✓  1.8s      │
│  ▸ queue-setup     cola de timbrado PAC         ✓  0.5s      │
│  ▸ cron-setup      reportes mensuales           ✓  0.3s      │
│  ▸ health-check    todos los endpoints OK       ✓  1.4s      │
│                                                               │
│  ✅ Tu producto está vivo:                                    │
│     API:    https://api.factura.mx                            │
│     App:    https://app.factura.mx                            │
│     Admin:  https://app.factura.mx/admin                      │
│                                                               │
│  Costo total: $0.18 de AI + $0 de infra (free tier)          │
│  Tiempo: 4 minutos 47 segundos                                │
│                                                               │
│  Monitor daemon activado — te notifico si algo falla.         │
╰───────────────────────────────────────────────────────────────╯

› [3 días después, recibes notificación]

╭─ Monitor Alert ───────────────────────────────────────────────╮
│                                                               │
│  📊 Reporte de 72h:                                          │
│  • 342 facturas timbradas exitosamente                        │
│  • 3 errores detectados (timeout PAC en horas pico)           │
│  • Fix aplicado: retry con exponential backoff + cache        │
│  • Deploy automático del fix: ✓                               │
│  • P95 latency mejoró de 890ms a 120ms                       │
│  • 12 empresas registradas                                    │
│  • Costo CF acumulado: $0.23                                  │
│                                                               │
│  Sugerencia: ¿Quieres agregar dashboard de analytics para     │
│  los dueños de empresas? Puedo hacerlo en ~3 minutos.         │
╰───────────────────────────────────────────────────────────────╯
```

### 5.3 Comparación de Complejidad

Para construir lo mismo (SaaS de facturación con CFDI):

| Paso | Replit | Lovable | construye |
|---|---|---|---|
| Describir idea | 1 prompt | 1 prompt | 1 prompt |
| Configurar DB | Manual | Auto (Supabase) | Auto (D1) |
| Configurar storage | Manual | Manual + Supabase | Auto (R2) |
| Configurar emails | Necesitas Sendgrid | Necesitas Resend | Auto (Email Workers) |
| Configurar colas | No disponible | No disponible | Auto (Queues) |
| Configurar cron | Manual | No disponible | Auto (Cron Triggers) |
| Deploy | 1 click (Replit only) | 1 click (Netlify) | Auto (CF, TU cuenta) |
| Monitoreo | Manual + Datadog | Nada | Auto (Monitor daemon) |
| Fix de bugs en prod | Manual | Manual | Auto-detectado y arreglado |
| **Pasos manuales** | **6+** | **4+** | **1** (el prompt) |
| **Costo mensual** | $20+ infra | $25+ Supabase | $9 (incluye todo) |
| **Tú posees la infra** | ❌ | ❌ | ✅ |

---

## 6. Contraposición a Google: Por Qué "Gratis" No Gana

Google AI Studio + Stitch es GRATIS. ¿Cómo competimos?

### 6.1 La Trampa del "Gratis"

```
Google:                                  construye:
Gratis → Firebase (exit cost             $9/mo → Cloudflare (TU cuenta)
compounding) → GCP billing →             
dependencia de Google →                  Si cancelas construye, tu
Google mata el producto un               producto sigue vivo en TU
martes cualquiera.                       cuenta de CF. Sin cambios.
```

Google está ejecutando **captura de infraestructura**. Cada app con Firebase auto-provisioning es un candado más. Recordemos: Google mató Domains (lo vendió a Squarespace), mató Stadia, mató Google+, mató Hangouts, mató Allo. El historial no inspira confianza para construir tu negocio ahí.

construye despliega en la cuenta de Cloudflare DEL USUARIO. Si construye desaparece mañana, los productos siguen vivos. El código es estándar (Hono, React, Drizzle). La infra es estándar (Workers, D1, R2). Cero lock-in real.

### 6.2 Lo que Google NO tiene

| Capacidad | Google AI Studio | construye |
|---|---|---|
| Emails transaccionales | ❌ (necesitas SendGrid) | ✅ Email Workers |
| Colas de jobs | ❌ (necesitas Cloud Tasks $$$) | ✅ Queues (incluido) |
| Workflows durables | ❌ (necesitas Cloud Workflows $$$) | ✅ Workflows (incluido) |
| CDN global sin egress | ❌ (GCP cobra egress) | ✅ R2 (0 egress fees) |
| Terminal en sandbox | ❌ | ✅ Sandbox WebSocket terminal |
| CLI nativo | ❌ | ✅ Terminal-first |
| Open source | ❌ | ✅ Todo el código |
| Multi-agente | ❌ | ✅ Agent Teams |
| Voice pair programming | ❌ | ✅ Realtime SFU |
| Operación post-deploy | ❌ | ✅ Monitor daemon |

---

## 7. Open Source como Estrategia

### 7.1 Bolt.new Demostró que Open Source Gana

Bolt.new tiene motor open source y eso les dio:
- Comunidad de contributors
- Confianza de developers ("puedo ver el código")
- Self-hosting para enterprises
- Marketing gratuito ("el open source Bolt.new")

### 7.2 OpenCode Demostró que Terminal-First + Open Source es Viable

OpenCode (por SST) tiene 120K estrellas en GitHub:
- Terminal-first con UI reactiva custom
- BYOK (trae tu propia API key) — modelo flexible
- AGENTS.md como memoria de repo
- Comandos custom extensibles

### 7.3 La Estrategia Open Source de construye

```
OPEN SOURCE (MIT):                    CLOUD (SaaS $9-29/mo):
├── CLI completo                      ├── Sandbox managed
├── Agent loop + tools                ├── Deploy automático
├── Model router (BYOK)              ├── Monitor daemon 24/7
├── Skill system                      ├── Agent Teams orquestados
├── Session protocol                  ├── Observabilidad (Pipelines)
├── Web dashboard                     ├── Sesiones compartidas
└── MCP server/client                 ├── Voice pair programming
                                      ├── Marketplace de skills
                                      └── Enterprise SSO/compliance

"Open source para devs que quieren control.
 Cloud para equipos que quieren velocidad."
```

**El core es open source.** Si quieres correr construye con tu propia API key contra tus propios modelos — adelante. Eso es el CLI + agent loop + tools. Gratis.

La magia del cloud (sandbox managed, deploy automático, agent teams, monitoreo, voice, sesiones compartidas) es el SaaS. $9/mo para makers, $29/mo para pros.

Esto es EXACTAMENTE el modelo de GitLab, Supabase, y PostHog. Open core que construye comunidad + cloud que monetiza.

---

## 8. Mercado y Oportunidad

### 8.1 Tamaño del Mercado

| Segmento | Tamaño 2026 | Crecimiento | CAGR |
|---|---|---|---|
| Plataformas AI total | $72.18B | → $119.57B (2031) | 10.62% |
| No-code AI platforms | $8.6B | → $75.14B (2034) | 31.13% |
| Low-code market | >$30B | Dominante (60%+ nuevos proyectos) | ~20% |
| App spending | $41B/trimestre | Acelerando | — |

### 8.2 El Segmento de construye

**Target**: No competimos en el mercado general de $72B. Competimos en:

```
Developers + technical founders que quieren construir productos
SaaS, no solo escribir código. Especialmente en LATAM (600M personas,
20M+ businesses, adopción tech acelerada).

TAM (Total Addressable Market):
├── Global: ~5M developers que usan herramientas AI para builds ($8.6B no-code AI)
├── LATAM: ~800K developers técnicos en la región
└── Nuestro SAM inicial: 50K devs en México, Colombia, Argentina, Chile

Revenue target:
├── Año 1: 2,000 users × $12 ARPU = $288K ARR
├── Año 2: 15,000 users × $15 ARPU = $2.7M ARR  
├── Año 3: 80,000 users × $18 ARPU = $17.3M ARR (con enterprise)
```

### 8.3 Por Qué LATAM Primero

- **Precio**: $9/mo es alcanzable para devs LATAM (vs $20-39/mo de competidores en USD)
- **Nadie está ahí**: Cero competidores optimizados para LATAM. Lovable, Bolt, Replit — todos en inglés, todos con pricing USD-first.
- **Español nativo**: No es un wrapper — el agente piensa, responde y documenta en español
- **Regulación local**: Templates para SAT (México), SUNAT (Perú), SII (Chile), DIAN (Colombia)
- **Latencia**: CF tiene PoPs en CDMX, São Paulo, Santiago, Bogotá, Lima, Buenos Aires
- **Identidad**: construye.lat — el dominio .lat es una declaración de pertenencia

### 8.4 El Counter-Positioning Perfecto

Contra Lovable/Replit ($206M-$253M ARR): "Igual de simple, pero TÚ posees la infraestructura."
Contra Claude Code: "Igual de potente, pero también despliega, opera y monitorea."
Contra Google (gratis): "No gratis, pero sin lock-in. Tu producto sobrevive sin nosotros."
Contra v0: "No solo frontend — full-stack con emails, colas, cron, analytics."
Contra Bolt (open source): "También open source, pero con ecosistema de producción completo."

---

## 9. Modelo de Negocio

### 9.1 Pricing

| Plan | Precio | Target | Incluye |
|---|---|---|---|
| **Open Source** | $0 | Devs que quieren control | CLI + agent loop + BYOK + tools + skills |
| **Maker** | $9/mo | Indie hackers, freelancers | 1 proyecto deploy. 100 sesiones/mo. Sandbox básico. Monitor. |
| **Pro** | $29/mo | Dev teams, startups | 10 proyectos. Sesiones ilimitadas. Agent Teams. Voice. 50GB R2. |
| **Team** | $19/user/mo (min 3) | Equipos de 3-20 | Todo Pro + governance + audit + sesiones compartidas + SSO. |
| **Enterprise** | Custom | >20 users, corporativos | Self-hosted + SLA + compliance + dedicated support. |

### 9.2 Fuentes de Revenue

```
1. Suscripción SaaS (core)          — $9-29/mo × usuarios
2. Overage de compute               — si exceden Sandbox/AI minutes
3. Marketplace de skills (30% cut)  — skills premium + templates
4. Enterprise contracts              — anuales, custom
5. CF referral program               — comisión por cuentas CF referidas
```

### 9.3 Economía por Usuario

```
Revenue/user (Pro):  $29/mo
Cost breakdown:
├── Workers AI compute:  ~$3/mo (modelos gratis vía Workers AI)
├── Sandbox time:        ~$2/mo (containers on-demand)  
├── CF services (D1/R2): ~$1/mo (pass-through al usuario via su cuenta)
├── Support/infra:       ~$3/mo
└── Gross margin:        ~$20/mo (69%)

Lovable comparison:   $25/mo revenue, ~$8/mo LLM cost = 68% margin
Replit comparison:    $20/mo revenue, ~$12/mo compute = 40% margin
construye advantage:  Workers AI models = mucho más barato que API de Anthropic/OpenAI
```

---

## 10. Hoja de Ruta

### Fase 0: Fundación (2 semanas)
- [ ] Migrar `@construye/worker` → Agents SDK `Agent` class con typed state
- [ ] Implementar `@construye/sandbox` con `@cloudflare/sandbox` SDK real
- [ ] Dynamic Worker Loader para code execution rápida (Code Mode SDK)
- [ ] MCP server via `McpAgent` con RPC transport
- [ ] Tests e2e: sesión → agent loop → sandbox → resultado verificado

### Fase 1: BUILD que Funciona (semanas 3-6)
- [ ] Agent Teams funcionales (Architect + Coder + Tester + Reviewer)
- [ ] Harness Engineering: pre/post hooks en cada fase
- [ ] Sandbox con preview URLs para que usuario vea su app live
- [ ] Web dashboard con `useAgent()` para state sync real-time
- [ ] Sesiones universales: CLI ↔ Web sincronizados

### Fase 2: RUN + OPERATE (semanas 7-10)
- [ ] Workflow de deploy automatizado end-to-end
- [ ] Monitor daemon con Cron Triggers + auto-fix
- [ ] Pipeline de observabilidad (logs + métricas → R2 Parquet)
- [ ] Email Workers para notificaciones
- [ ] Secrets Store para productos desplegados
- [ ] `construye status` — health dashboard

### Fase 3: CONNECT + COLLABORATE (semanas 11-14)
- [ ] MCP client para GitHub, Slack, Linear
- [ ] Pair programming con voz (Realtime SFU)
- [ ] Sesiones compartidas multi-usuario
- [ ] Agent Teams coordinados (Coordinator pattern)
- [ ] Marketplace v1 de skills

### Fase 4: SCALE (semanas 15+)
- [ ] Enterprise: CF Access SSO, audit trail SOC 2 ready
- [ ] Templates de productos (facturación, e-commerce, SaaS starter)
- [ ] Multi-language en Sandbox (Python, Go, Rust)
- [ ] Mobile app (React Native, reusa useAgent hooks)
- [ ] Self-hosted enterprise edition
- [ ] Marketplace maduro con revenue sharing

---

## 11. Moats (Ventajas Defensibles)

### 1. DATA MOAT
Cada proyecto construido genera datos sobre patrones arquitectónicos, errores comunes, costos óptimos. Estos datos hacen que el Architect agent sea cada vez más inteligente. Más usuarios → mejores recomendaciones → más usuarios. Nadie más tiene acceso a datos de "cómo se construyen productos E2E en Cloudflare".

### 2. ECOSYSTEM LOCK-IN (el bueno)
Si tu producto corre en construye + CF, construye conoce tu infra, tu código, tu data, tus patrones, tus users, tus costs. Migrar a "codear manualmente" es posible pero doloroso — no por lock-in técnico sino porque pierdes la automatización. Como dejar de usar Terraform para volver a clickear en consolas.

### 3. OPEN SOURCE COMMUNITY
Contributors, extensiones, skills, templates. Cada contribución hace el ecosistema más valioso. Bolt demostró que esto funciona (63K stars).

### 4. COST ADVANTAGE
100% Workers AI = sin API costs de OpenAI/Anthropic. Modelos corren en la red de CF. Los competidores pagan $0.003-0.015/1K tokens a terceros. Nosotros usamos modelos incluidos. Margen superior = pricing inferior = más accesible para LATAM.

### 5. LATAM-FIRST
Nadie está optimizando para 600M de personas. Primero en LATAM = posición defensible. Templates de regulación local (SAT, SUNAT, SII) son un moat real porque ningún competidor global invierte en eso.

### 6. CLOUDFLARE ALIGNMENT
Cada usuario de construye es un usuario de Cloudflare. CF tiene incentivos para apoyarnos (partner program, features prioritarias, co-marketing). Es una relación simbiótica, no extractiva.

---

## 12. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cloudflare cambia pricing/APIs | Media | Alto | Open source core + multi-deploy (fallback a Docker) |
| Google llega a LATAM con producto gratis | Baja | Alto | Moat de idioma, templates locales, comunidad, no lock-in |
| Workers AI models no son suficientemente buenos | Media | Medio | AI Gateway para fallback a Claude/OpenAI cuando se necesite |
| Sandbox SDK sale de beta con breaking changes | Alta | Medio | Abstraction layer, tests exhaustivos, relación directa con CF team |
| Competidor copia nuestro enfoque | Media | Medio | Velocidad de ejecución + data moat + community |
| LATAM market no convierte | Baja | Alto | Pricing tier global, no solo LATAM (product es global, marketing es LATAM-first) |

---

## 13. Visión Final

### Lo que dice la industria:

> "AI code is highly functional but systematically lacking in architectural judgment."

> "95% of task-specific GenAI tools fail to reach successful implementation."

> "The doom loop: bugs AI can't fix."

### Lo que construye resuelve:

**Otros te dan velocidad. construye te da velocidad + calidad + operación.**

No es un editor que te ayuda a escribir código. Es una fábrica que:

1. **PIENSA** tu arquitectura antes de escribir una línea
2. **CONSTRUYE** con equipos de agentes especializados
3. **VERIFICA** cada línea en un sandbox real (no código ciego)
4. **DESPLIEGA** infraestructura completa automáticamente
5. **OPERA** tu producto 24/7 con auto-diagnóstico y auto-fix
6. **MANTIENE** la calidad con guardrails en cada fase
7. Todo **en tu infraestructura**, **open source**, a **$9/mo**, **en español**

Mientras todos compiten en **generar código más rápido**, construye compite en **generar productos que funcionan**.

Ese es el verdadero next step. Ese es construye.lat.

**"No construyas código. Construye productos."**
