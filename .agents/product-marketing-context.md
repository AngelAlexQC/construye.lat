# Product Marketing Context — construye.lat

## 1. Product Overview

**construye.lat** es un runtime de ejecución segura para AI coding agents, construido 100% sobre Cloudflare (Workers, Durable Objects, D1, R2, Dynamic Workers). No es otro coding agent — es la infraestructura que permite ejecutar skills de agentes de forma aislada, auditable y escalable en el edge.

- **Formato**: CLI (terminal-first) + interfaz web + API Worker
- **Stack**: TypeScript ESM, React 19, Tailwind v4, Cloudflare Developer Platform
- **Modelo de ejecución**: Skills corren en V8 isolates (Dynamic Workers) con sandboxing, no en la máquina del desarrollador
- **Estándares**: Compatible con Agent Skills, AGENTS.md, MCP

## 2. Target Audience

### Primario: Desarrolladores que usan AI coding agents en producción
- Equipos de 2-50 ingenieros en startups/scale-ups
- Usan Claude Code, Cursor, Copilot, OpenCode, o Gemini CLI diariamente
- Preocupados por seguridad: skills ejecutan con permisos totales del sistema
- Buscan: ejecución segura sin sacrificar velocidad

### Secundario: Creadores de skills para AI agents
- Desarrolladores que publican skills en registries (skills.sh, ClawHub, GitHub)
- Quieren distribución segura y monetizable
- Necesitan un runtime confiable donde sus skills ejecuten sin ser culpados de vulnerabilidades

### Terciario: Empresas con políticas de seguridad estrictas
- SOC2, HIPAA, GDPR requirements
- No pueden permitir que agentes ejecuten código arbitrario en laptops de empleados
- Necesitan audit trails y control de acceso granular

## 3. Personas

### "Sofía" — Tech Lead, startup fintech (Ciudad de México, 32 años)
- Equipo de 8 ingenieros, usan Claude Code + Cursor
- Preocupación principal: un skill malicioso podría exfiltrar API keys de producción
- Pain: no puede auditar qué hacen los skills que su equipo instala
- Meta: "Quiero que mi equipo use AI agents sin que yo pierda el sueño"

### "Marcus" — Indie dev / creador de skills (São Paulo, 27 años)
- Publica 12 skills en skills.sh, 6K instalaciones totales
- Pain: sin runtime estándar, sus skills fallan en distintos entornos
- Meta: "Quiero monetizar mis skills y que funcionen en cualquier lado"

### "James" — VP Engineering, empresa Series B (Austin, 41 años)
- 40 ingenieros, evaluando si permiten AI agents en producción
- Pain: compliance team bloqueó adopción de Claude Code por riesgo de data exfiltration
- Meta: "Dame un sandbox auditado y apruebo el rollout mañana"

## 4. Problems & Pain Points

### Dolor #1: Skills ejecutan sin sandbox (CRÍTICO)
- 22,511 skills públicos auditados → 140,963 hallazgos de seguridad (Mobb.ai, 2026)
- Skills se escanean al publicar, pero ejecutan con permisos totales del desarrollador
- Incidente ClawHub (Feb 2026): 341 skills maliciosos descubiertos
- CVE-2026-25253: miles de instancias locales vulnerables a hijacking remoto

### Dolor #2: Supply chain attacks escalan
- LiteLLM comprometido (Mar 2026): credenciales PyPI robadas → backdoors en paquetes
- MCP proxy CVE-2025-6514 (CVSS 9.6): RCE al conectar a servidores no confiables
- El 50% de MCP servers expuestos opera sin controles de acceso
- OWASP MCP Top 10 publicado: tokens mal gestionados, escalación de privilegios, tool poisoning

### Dolor #3: Costo de inferencia insostenible
- Un agente de review de código: $2.4M/año con modelo propietario mid-tier
- Mismo agente con Kimi K2.5 en Workers AI: 77% menos costo
- Equipos necesitan correr múltiples agentes 24/7 → pricing propietario colapsa

### Dolor #4: Sin estándar de ejecución
- Cada agent framework tiene su propio runtime
- Skills no son portables entre Claude Code, Cursor, Copilot
- Developers reescriben skills para cada plataforma

## 5. Competitive Landscape

### Tier 1: Coding Agents (competencia indirecta — son clientes, no rivales)
| Producto | Tipo | Fortaleza | Debilidad |
|----------|------|-----------|-----------|
| Claude Code | CLI agent | #1 más usado (2026), amado por Directors+ | Sin sandbox para skills, ejecución local |
| Cursor | AI IDE | 40M+ ARR, UX pulida | Vendor lock-in, closed source |
| GitHub Copilot | IDE plugin | Mayor adopción, Agent Skills | Enterprise pricing, limitado a GitHub ecosystem |
| OpenCode | OSS CLI | 50K+ stars, model-agnostic | Sin runtime propio, sin marketplace |
| Gemini CLI | CLI agent | 1M context window, gratis | Sin ecosystem de skills |

### Tier 2: Agent Frameworks (competencia directa)
| Producto | Tipo | Fortaleza | Debilidad |
|----------|------|-----------|-----------|
| OpenHands | Framework OSS | $18.8M Series A, Context Condenser | No edge-native, containers pesados |
| OpenClaw/Moltworker | CF agent framework | 250K+ stars, Cloudflare-native | Vulnerabilidades iniciales (CVE-2026-25253) |
| CrewAI / AutoGen | Multi-agent frameworks | Multi-agent orchestration | Python-only, sin sandboxing |

### Tier 3: Infraestructura (aliados potenciales)
| Producto | Tipo | Fortaleza |
|----------|------|-----------|
| Cloudflare Workers AI | Inference platform | Kimi K2.5, 77% cost reduction |
| Cloudflare Dynamic Workers | Sandbox runtime | V8 isolates, 100x faster que containers |
| JFrog | Supply chain governance | "Trusted Agentic Supply Chain" concepto |

### Posición de mercado
El mercado se está bifurcando: **agents** (quien escribe código) vs **runtimes** (dónde ejecutan skills). construye.lat es un **runtime**, no otro agent. Es la capa de seguridad y ejecución que los agents necesitan pero no construyen.

## 6. Differentiation

### Propuesta de valor única
**"Lo que Cloudflare Workers hizo para serverless → construye.lat lo hace para AI agent skills."**

### Diferenciadores clave
1. **Secure Skills Runtime**: Skills ejecutan en V8 isolates (Dynamic Workers), no en la máquina del desarrollador. Sandboxing real, no promesas.
2. **Edge-native**: Latencia sub-5ms para orchestración. Inference en Workers AI. Zero cold starts.
3. **Estándar-compatible**: Agent Skills + AGENTS.md + MCP. No lock-in.
4. **Economía viable**: Workers AI con Kimi K2.5 a fracción del costo de propietarios. Modelo consumption-based.
5. **Skill Marketplace**: Creators monetizan (70/30 split). Distribución segura. Runtime garantizado.
6. **LATAM-first, global-ready**: Documentación en español. Comunidad latinoamericana. Producto sin fronteras idiomáticas.

### Lo que NO somos
- No somos otro Claude Code / Cursor / Copilot
- No somos un framework de multi-agent orchestration
- No somos un wrapper thin de APIs de LLM
- No somos un producto solo para LATAM

## 7. Objections

| Objeción | Respuesta |
|----------|-----------|
| "Ya uso Claude Code, ¿para qué necesito esto?" | Claude Code ejecuta todo en tu máquina. construye.lat ejecuta skills en sandbox aislado — tu código y keys nunca tocan el runtime del skill. |
| "¿Por qué no simplemente Docker?" | Docker: ~300ms cold start, ~50MB+ memory. Dynamic Workers: ~3ms, ~3MB. 100x más rápido. Para agents que hacen 10+ tool calls por turno, la diferencia es brutal. |
| "Es open source, ¿por qué pagar?" | Gratis para sideline projects. Pagas por: ejecución managed, audit logs, compliance reports, SLA, marketplace access. Como GitHub: el repo es gratis, Actions y Copilot no. |
| "¿Y si Cloudflare saca algo igual?" | Cloudflare construye primitivas (Dynamic Workers, Workers AI). Nosotros construimos la experiencia de desarrollador encima. Como Vercel no compite con AWS — la capa de DX es el moat. |
| "¿.lat? ¿Es solo para Latinoamérica?" | .lat es un accent, no un border. Como .io no es de British Indian Ocean Territory. El producto es en inglés y español. |

## 8. Switching Dynamics

### Desde: Ejecución local sin sandbox
- **Trigger**: Incidente de seguridad, auditoría de compliance, o lectura sobre ClawHub/LiteLLM
- **Barrera**: Configurar el runtime (~15min), migrar skills existentes
- **Facilitador**: CLI que detecta skills existentes y los migra automáticamente

### Desde: Otro agent framework (OpenHands, CrewAI)
- **Trigger**: Latencia de containers, costos de hosting, falta de marketplace
- **Barrera**: Rewrite de orchestration logic
- **Facilitador**: Compatibilidad con Agent Skills estándar, importers para formatos comunes

### Desde: "No usamos AI agents"
- **Trigger**: Presión competitiva, developers que ya usan agents por su cuenta ("shadow AI")
- **Barrera**: Aprobación de liderazgo, policy de seguridad
- **Facilitador**: Audit trail + compliance dashboard resuelve el bloqueador de seguridad

## 9. Customer Language

### Frases que usan (verbatim de research)
- "The S in MCP stands for security" (sarcasmo sobre la falta de seguridad)
- "Skills execute with the developer's full system permissions"
- "Scanned at publish time, but no runtime verification"
- "An ungoverned MCP server is as dangerous as an unvetted npm package"
- "Shadow AI" — agents que los empleados corren sin aprobación de IT
- "Time to remediate" — cuánto tarda arreglar una vulnerabilidad
- "Bring your own API key" — modelo sin vendor lock-in
- "Context window bloat" — problema de eficiencia con tool calls

### Tono del mercado
Los developers hablan de AI agents con:
- **Entusiasmo pragmático**: "Esto cambia cómo trabajo" pero "todavía necesito supervisar"
- **Ansiedad por seguridad**: creciente, especialmente post-ClawHub y LiteLLM
- **Fatiga de herramientas**: demasiados agents, cada semana uno nuevo
- **Respeto por estándares**: MCP y Agent Skills ganaron — todo lo que no sea compatible pierde

## 10. Brand Voice

### Tono
- **Directo sin ser brusco**: "Ejecuta skills sin riesgo." No: "Nuestra plataforma revolucionaria de ejecución segura..."
- **Técnico sin ser excluyente**: Usamos terminología real (V8 isolates, D1, Workers) pero explicamos por qué importa
- **Confiado sin arrogancia**: Sabemos lo que construimos. No necesitamos compararnos constantemente.
- **Urgente sin ser alarmista**: El problema de seguridad es real. No vendemos miedo — vendemos la solución.

### Voz de marca
- Imperativo: "Construye." "Ejecuta." "Asegura." — el nombre ES un comando
- Sin exclamaciones excesivas ni emojis en comunicación técnica
- Español + inglés según contexto — documentación bilingüe, CLI en inglés
- Código es la mejor documentación

### Personalidad (de .impeccable.md)
**Relentless. Universal. Precise.**

## 11. Proof Points

### Datos del mercado (verificados via Tavily, julio 2026)
- 140,963 hallazgos de seguridad en 22,511 skills públicos (Mobb.ai audit)
- 341 skills maliciosos en ClawHub (Feb 2026)
- 50% de MCP servers expuestos sin controles de acceso
- LiteLLM supply chain attack: 95M descargas mensuales comprometidas
- Dynamic Workers: 100x más rápido que containers, startup en milisegundos
- Workers AI Kimi K2.5: 77% reducción de costos vs modelos propietarios
- Claude Code: herramienta #1 más usada (Pragmatic Engineer survey, 2026)
- Agent Skills estándar: 5,000+ stars, adoptado por Cursor, Gemini CLI, VS Code, Claude, OpenAI, GitHub

### Proof points propios (a desarrollar)
- [ ] Benchmark: latencia de ejecución de skills (Dynamic Workers vs containers)
- [ ] Caso de uso: skill malicioso bloqueado por sandbox
- [ ] Métrica: tokens procesados por día en el runtime
- [ ] Testimonial: primer usuario beta

## 12. Goals

### Corto plazo (Q3 2026)
- Lanzar web frontend con landing page + dashboard de skills
- CLI funcional con ejecución de skills en sandbox
- 100 usuarios beta (developers LATAM + global)
- 10 skills en marketplace

### Mediano plazo (Q4 2026)
- $5K MRR (Pro + Team subs)
- 50 skills en marketplace
- Integraciones con Claude Code, Cursor, OpenCode (como runtime backend)
- SOC2 compliance iniciado

### Largo plazo (2027)
- $50K MRR
- Skill Marketplace self-sustaining (70/30 split)
- Referenciado en "AI agent security" como estándar
- Enterprise contracts ($499/mo tier)
