# PLAN REFINADO: construye.lat
## "No competir. Inventar."
### Fecha: 31 Marzo 2026 | Basado en 10 rondas de investigación con datos reales

---

## VEREDICTO EJECUTIVO

**No construyas otro framework de agentes IA. Construye el runtime seguro para skills de agentes IA en el edge.**

El ecosistema de agentes IA en marzo 2026 tiene un problema gigantesco que NADIE ha resuelto:
- ClawHub tiene 13,700+ skills → 1 de cada 12 es maliciosa (ClawHavoc)
- skills.sh tiene 37,000+ skills → 25% contienen comandos shell, 1 de cada 6 descarga y ejecuta scripts remotos
- 93.4% de instancias públicas de OpenClaw son vulnerables
- NVIDIA tuvo que crear NemoClaw en GTC 2026 específicamente porque el modelo de confianza de OpenClaw "está fundamentalmente roto"

**construye.lat = "Lo que Cloudflare Workers hizo para serverless → construye.lat lo hace para AI agent skills."**

Aislamiento. Seguridad. Edge. Costo mínimo. Revenue desde día 1.

---

## PARTE 1: EL MAPA DEL CAMPO DE BATALLA (Datos Duros)

### Los Gigantes y sus Movimientos

| Jugador | Dato Clave | Implicación |
|---------|-----------|-------------|
| **OpenClaw** | 250K+ estrellas GitHub, 2M+ usuarios pico, 20+ plataformas de mensajería | El WordPress de agentes IA — gigante pero inseguro |
| **Claude Code** | $1B run-rate en 6 meses, compró Bun, 512K líneas leaked | Dueños del runtime JS + modelo. Vendor lock-in total |
| **OpenAI Codex** | Compró Astral (uv/ruff) para Python | Dueños del runtime Python. Misma estrategia |
| **skills.sh (Vercel)** | 37K+ skills, cross-platform (Copilot, Cursor, Claude, Codex) | El npm de skills — pero sin runtime seguro |
| **ClawHub** | 13,700+ skills oficiales + 5,400+ community | Registry masivo — pero supply chain nightmare |
| **Cloudflare** | Kimi K2.5 (256K ctx), prefix caching, session affinity, 77% menos costo | La plataforma edge más completa para agentes |

### El Patrón que Nadie Está Viendo

```
OpenClaw = SKILL.md (markdown) → Agent lo ejecuta en tu máquina local → Sin aislamiento
Claude Code = Tools internos → Solo funciona con Claude → Lock-in
skills.sh = Directorio de skills → No ejecuta nada, solo organiza → Gap de seguridad
ClawHub = npm install → Código arbitrario en tu sistema → 1,184 skills maliciosas confirmadas
```

**¿Qué falta?** → Un runtime que ejecute skills en sandbox aislados, con auditoría, permisos granulares, y costo predecible. Exactamente lo que Cloudflare Workers + Dynamic Workers + Containers permite.

---

## PARTE 2: LA INVENCIÓN — "Secure Skills Runtime"

### Concepto Central

```
construye.lat = Plataforma donde cualquier agente IA puede ejecutar cualquier skill 
                de forma segura, auditada y económica en el edge de Cloudflare.
```

### ¿Por qué esto es una NUEVA CATEGORÍA y no "otro framework"?

| Lo que existe | Lo que construye.lat inventa |
|---------------|------------------------------|
| OpenClaw ejecuta skills en tu laptop sin aislamiento | construye.lat ejecuta skills en Workers aislados con permisos granulares |
| ClawHub es un registry que distribuye código arbitrario | construye.lat es un registry + runtime que escanea, sandboxea y audita cada skill |
| skills.sh organiza markdown | construye.lat ejecuta, monitorea y cobra por ese markdown |
| NemoClaw de NVIDIA cobra enterprise por seguridad | construye.lat democratiza esa seguridad con costos de Cloudflare ($0.02/M tokens con Kimi K2.5) |

### Arquitectura del "Secure Skills Runtime"

```
┌─────────────────────────────────────────────────┐
│                 construye.lat                     │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │ Skill Store  │  │ Skill Scanner │  │ Billing │ │
│  │ (Registry)   │  │ (Security)    │  │ (Polar) │ │
│  └──────┬──────┘  └──────┬───────┘  └────┬────┘ │
│         │                │               │       │
│  ┌──────▼────────────────▼───────────────▼────┐ │
│  │           Secure Execution Layer            │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐         │ │
│  │  │Worker 1│ │Worker 2│ │Worker N│ Isolated │ │
│  │  │(Skill) │ │(Skill) │ │(Skill) │ Sandbox  │ │
│  │  └────────┘ └────────┘ └────────┘         │ │
│  └────────────────────────────────────────────┘ │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │         Cloudflare Infrastructure           │  │
│  │  Workers AI │ D1 │ R2 │ KV │ Vectorize    │  │
│  │  Kimi K2.5 + Prefix Cache + Session Affinity│  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

        ▲ Se conecta a cualquier agente:
        │
   ┌────┴─────┬──────────┬──────────┬──────────┐
   │ OpenClaw │ Claude   │ Copilot  │ Cursor   │
   │          │ Code     │          │          │
   └──────────┴──────────┴──────────┴──────────┘
```

### Diferenciadores Técnicos (ya los tienes en tu monorepo)

1. **Dynamic Workers** → Cada skill corre en su propio Worker aislado (V8 isolate, sin acceso al filesystem del usuario)
2. **Containers** → Para skills pesados (browser automation, compilación, ML)
3. **AI Gateway** → Rate limiting, caching, observabilidad de cada llamada LLM que hace un skill
4. **Prefix Caching + Session Affinity** → Skills multi-turn mantienen contexto con 77% menos costo
5. **Code Mode** → 81% ahorro de tokens en batch operations
6. **Smart Model Router** → Skill simple → Kimi K2.5 ($0.02/M tokens), skill complejo → Claude Opus 4.6

---

## PARTE 3: REVENUE DESDE DÍA 1 (El Plan Anti-Quiebra)

### Fase 0: Pre-lanzamiento (Semana 1-2) — $0 inversión, setup monetización

| Acción | Herramienta | Costo |
|--------|-------------|-------|
| Crear cuenta Polar.sh | Polar | $0 (5% fee sobre ingresos) |
| Crear cuenta GitHub Sponsors | GitHub | $0 (0% fee) |
| Configurar 3 tiers en Polar | — | $0 |
| Publicar README con sponsor badges | — | $0 |
| Crear landing en construye.lat (CF Pages) | Cloudflare | $0 (free tier) |

**Tiers de Polar.sh desde día 1:**
- **Gratis**: Framework OSS + 5 skills incluidos + community Discord
- **Pro ($29/mo)**: Runtime seguro para 50 skill executions/día + skills premium + soporte prioritario
- **Team ($99/mo)**: 500 executions/día + audit logs + approval gates + SSO + custom skills
- **Enterprise ($499/mo)**: Ilimitado + SLA + dedicated support + compliance reports

### Fase 1: Revenue Inmediato (Semana 1-4) — Servicios + Sponsors

**Stream 1: Consultoría de Setup de Agentes IA ($150-300/hr USD)**
- Target: Empresas LATAM que quieren implementar agentes IA pero no saben cómo
- Canal: LinkedIn en español, comunidades dev LATAM
- Ticket promedio: $2,000-5,000 por setup
- Meta mes 1: 2-3 clientes = $4,000-15,000
- Usas construye.lat como tu herramienta → doble beneficio (cobras + dogfoodeas)

**Stream 2: Skills Premium en Polar.sh ($29-99/mo)**
- Construir 5-10 skills útiles que resuelvan problemas reales:
  - `construye/whatsapp-agent` — Agente de WhatsApp para negocios LATAM
  - `construye/notion-sync` — Sincronización bidireccional Notion ↔ agente
  - `construye/financial-analyst` — Análisis financiero automatizado para PYMEs
  - `construye/code-review-secure` — Code review con escaneo de seguridad (imitando lo que Cloudflare hace con Bonk)
  - `construye/latam-compliance` — Facturación electrónica LATAM (CFDI México, DIAN Colombia, etc.)
- Publicar en skills.sh + ClawHub + README
- Revenue: $29/mo × 20 suscriptores = $580/mo (conservador mes 2-3)

**Stream 3: GitHub Sponsors + Polar.sh Sponsors**
- Revenue: $200-1,000/mo (varía, pero es pasivo)

### Fase 2: Producto Core (Mes 2-4) — Secure Skills Runtime

**El producto que vendes:**
```
"Ejecuta cualquier skill de agente IA de forma segura en Cloudflare.
 Sin instalar nada local. Sin riesgo de supply chain attacks.
 $0.001 por ejecución. Primeras 100 gratis al día."
```

**Pricing modelo consumption + base:**

| | Free | Pro ($29/mo) | Team ($99/mo) | Enterprise |
|---|---|---|---|---|
| Executions/día | 10 | 50 | 500 | Ilimitado |
| Skills disponibles | Open source | + Premium | + Private | + Custom |
| Sandbox isolation | ✅ | ✅ | ✅ | ✅ |
| Security scanning | Básico | Completo | Completo + audit | + compliance |
| Overage | — | $0.002/exec | $0.001/exec | Negociable |
| Soporte | Community | Email 48h | Slack 4h | Dedicado |

**¿Por qué alguien pagaría esto?**
- OpenClaw ejecuta skills en tu máquina → riesgo de seguridad real (1,184 skills maliciosas encontradas)
- Empresas QUIEREN usar agentes pero el riesgo de compliance los frena
- $29/mo por sandbox seguro < costo de un incidente de seguridad ($4.88M promedio según IBM 2024)

### Fase 3: Marketplace + Comisiones (Mes 4-8)

**Skill Marketplace en construye.lat:**
- Cualquier desarrollador puede publicar un skill
- construye.lat lo escanea, lo sandboxea, lo monitorea
- Revenue share: Desarrollador 70%, construye.lat 30%
- Analogía directa: Shopify App Store, ClawHub pero con security + commerce built-in

**Revenue proyectado mes 6-8:**
- 20 skills premium vendidos por terceros × $15/mo promedio × 100 compradores = $45,000/mo gross
- construye.lat se queda con 30% = $13,500/mo
- + Suscripciones directas Pro/Team: $5,000-10,000/mo
- + Consultoría: $5,000-10,000/mo
- **Total mes 6-8: $23,500-33,500/mo**

### Fase 4: Escala (Mes 8-18)

**"Managed Agent" — Lo que Featherless hace para OpenClaw, construye.lat lo hace para TODOS los agentes:**
- Flat subscription que incluye: runtime seguro + inferencia con Kimi K2.5 + skills marketplace
- Elimina el "token tax" que asusta a los usuarios
- $49/mo todo incluido para usuarios individuales
- $199/mo para equipos
- El margen es viable porque Kimi K2.5 en Workers AI cuesta 77% menos que modelos propietarios

---

## PARTE 4: CANALES DE DISTRIBUCIÓN (No "post en HN y reza")

### Canal 1: Ecosistema OpenClaw (250K+ stars = distribución gratuita)

**Estrategia: Ser el "security layer" que OpenClaw necesita desesperadamente.**

1. Crear `construye/openclaw-secure-runtime` — un skill de OpenClaw que redirige ejecución de skills al sandbox de construye.lat
2. Publicar en ClawHub (13,700+ skills, buscado activamente)
3. Publicar en awesome-openclaw-skills (5,400+ skills curados)
4. Posicionamiento: "Tus skills de OpenClaw, pero ejecutados de forma segura en la nube"

**Ejemplo de SOUL.md que un usuario de OpenClaw configuraría:**
```markdown
## Security
- All skills from ClawHub must be executed through construye.lat secure runtime
- Never execute shell commands locally — use construye.lat sandbox
- Log all skill executions to construye.lat audit trail
```

**Potencial:** Si capturas 0.5% de usuarios de OpenClaw (2M+ usuarios) = 10,000 usuarios = $290,000/mo a $29/mo

### Canal 2: skills.sh (37,000+ skills, respaldado por Vercel)

1. Publicar 10-20 skills de alta calidad en skills.sh
2. Cada skill tiene banner: "Run securely on construye.lat"  
3. `npx skills add construye/secure-runtime` — instala el bridge
4. Cross-compatible con Claude Code, Copilot, Cursor, Codex, OpenCode

### Canal 3: Cloudflare Developer Ecosystem

1. Template en Cloudflare Workers Templates → "AI Agent Secure Runtime"
2. Blog post en Cloudflare Blog (tienen programa de guest posts para builders)
3. Cloudflare Developer Week submissions
4. Usar Kimi K2.5 prominentemente → Cloudflare tiene incentivo de promoverte

### Canal 4: LATAM Developer Communities (25M+ devs, mercado desatendido)

| Comunidad | Tipo | Tamaño estimado |
|-----------|------|-----------------|
| DevTo en español | Blog | 500K+ lectores LATAM |
| Platzi community | Educación | 5M+ estudiantes |
| Argentina/Colombia/México tech Slack/Discord | Chat | 50K+ combinados |
| Conferencias (JSConf LATAM, Node Summit CDMX) | Eventos | Miles |
| YouTube dev en español | Video | Millones de views |

**Ventaja LATAM:** Nadie está haciendo esto en español. CERO competencia directa. Ser el primero con contenido de calidad en español sobre agentes IA seguros = capturar una audiencia hambrienta.

### Canal 5: "Claude Code Channels" — Expansión viral

Claude Code acaba de lanzar "Channels" — conexión a Telegram y Discord vía MCP. construye.lat puede:
1. Ser un MCP server que cualquier Claude Code session puede usar
2. Ofrecer ejecución segura de skills desde Telegram/Discord/WhatsApp
3. El usuario instala construye.lat como channel → cada skill que ejecute pasa por tu sandbox → revenue

### Canal 6: Security Angle — Contenido que vende solo

La narrativa de seguridad se vende sola:
- Blog: "1,184 skills maliciosas encontradas en ClawHub — Cómo protegerte"
- Blog: "El 93.4% de instancias OpenClaw son vulnerables — Guía de hardening"
- Report: "State of AI Agent Security 2026" — Publicar como lead magnet
- Cada pieza de contenido termina en: "Usa construye.lat para ejecutar skills de forma segura"

---

## PARTE 5: PROYECCIÓN FINANCIERA REALISTA

### Escenario Conservador

| Mes | Consultoría | Suscripciones | Marketplace | Sponsors | **Total** |
|-----|-------------|---------------|-------------|----------|-----------|
| 1 | $3,000 | $0 | $0 | $100 | **$3,100** |
| 2 | $5,000 | $580 | $0 | $300 | **$5,880** |
| 3 | $5,000 | $1,500 | $0 | $500 | **$7,000** |
| 4 | $4,000 | $3,000 | $500 | $700 | **$8,200** |
| 6 | $3,000 | $7,000 | $3,000 | $1,000 | **$14,000** |
| 12 | $2,000 | $20,000 | $13,500 | $2,000 | **$37,500** |
| 18 | $0 | $45,000 | $30,000 | $3,000 | **$78,000** |

### Costos Mensuales

| Item | Mes 1-3 | Mes 4-12 | Mes 12-18 |
|------|---------|----------|-----------|
| Cloudflare Workers (paid) | $5 | $25 | $200 |
| Cloudflare D1/R2/KV | $0 (free tier) | $10 | $50 |
| Workers AI (Kimi K2.5) | $0 (free tier 10K tokens/día) | $50 | $500 |
| Dominio construye.lat | $15/yr | $15/yr | $15/yr |
| Polar.sh fees (5%) | $0 | $150 | $375 |
| **Total costos** | **~$7/mo** | **~$250/mo** | **~$1,130/mo** |

### Break-even
- **Mes 1**: Si consigues 1 cliente de consultoría ($3,000) vs costo ($7) = rentable inmediatamente
- **Mes 6**: $14,000 revenue vs $250 costos = margen 98%
- **Mes 18**: $78,000/mo revenue vs $1,130 costos = margen 98.5%

---

## PARTE 6: ROADMAP TÉCNICO (Qué construir y cuándo)

### Sprint 1 (Semana 1-2): Monetización + Landing
- [ ] Landing page en construye.lat con Cloudflare Pages
- [ ] Integración Polar.sh (tiers, checkout, sponsors)
- [ ] 3 skills de demostración publicados en skills.sh y ClawHub
- [ ] README con sponsor badges y links de monetización
- [ ] LinkedIn profile optimizado para consultoría LATAM

### Sprint 2 (Semana 3-4): Core Skills + Primeros Clientes
- [ ] Package `@construye/skills` terminado — loader, matcher, registry
- [ ] 5 skills premium listos (WhatsApp, Notion, financial, code-review, LATAM compliance)
- [ ] Skill scanner básico (analiza SKILL.md por comandos peligrosos)
- [ ] Publicar contenido de seguridad (blog post sobre ClawHavoc)
- [ ] Primer cliente de consultoría

### Sprint 3 (Semana 5-8): Secure Runtime MVP
- [ ] Dynamic Workers executing skills en sandbox
- [ ] API: `POST /v1/skills/{id}/execute` con auth, rate limiting, audit log
- [ ] Integración con Workers AI + Kimi K2.5 + prefix caching + session affinity
- [ ] Dashboard web básico (React + Vite en CF Pages)
- [ ] `construye/openclaw-secure-runtime` publicado en ClawHub

### Sprint 4 (Semana 9-12): Marketplace + Scale
- [ ] Marketplace de skills con publicación por terceros
- [ ] Revenue share automático (Polar.sh API)
- [ ] MCP server para que Claude Code/Copilot/Cursor ejecuten skills via construye.lat
- [ ] CLI mejorado con `construye deploy`, `construye scan`, `construye publish`
- [ ] Template en Cloudflare Workers Templates

### Sprint 5 (Mes 4-6): Managed Agent
- [ ] Offering "todo incluido" — runtime + inferencia + skills
- [ ] Containers para skills pesados (browser automation, ML)
- [ ] Auto-skills: el agente descubre y ejecuta skills automáticamente desde el registry
- [ ] Enterprise features (SSO, compliance, custom deployment)

---

## PARTE 7: POR QUÉ ESTO FUNCIONA (El Moat)

### 1. El Problema es Real y Urgente
- 1,184 skills maliciosas en ClawHub no es teórico — es un dato de febrero 2026
- NVIDIA creó NemoClaw porque el problema es tan grave que requiere solución enterprise
- Mobb auditó 22,511 skills y encontró patrones de riesgo generalizados
- Empresas QUIEREN usar agentes IA pero el riesgo de compliance las frena

### 2. La Infraestructura ya Existe
- Cloudflare Workers = isolation por diseño (V8 isolates, no containers pesados)
- Dynamic Workers = nuevo Worker por ejecución = aislamiento perfecto para skills
- Kimi K2.5 = 77% menos costo que alternativas propietarias, 256K context
- Prefix caching + session affinity = costos multi-turn dramáticamente menores
- **Tu monorepo ya tiene la arquitectura correcta** (sandbox, tools, providers, skills packages)

### 3. Timing Perfecto
- OpenClaw acaba de integrar ClawHub nativamente (v2026.3.22, 23 marzo 2026)
- skills.sh creció a 37K+, pero nadie resuelve la ejecución segura
- Anthropic y OpenAI están comprando runtimes (Bun, uv) → lock-in inminente
- Cloudflare acaba de lanzar Kimi K2.5 + session affinity (19 marzo 2026)
- El mercado de OSS services crece 16.22% CAGR ($44B → $93B para 2031)

### 4. LATAM es Terra Incognita
- 25M+ desarrolladores en LATAM
- CERO frameworks de agentes IA nacidos en LATAM
- Contenido en español sobre agentes IA seguros = inexistente
- Consultoría de implementación de agentes IA en LATAM = mercado virgen
- construye.lat tiene el dominio .lat → señal cultural fuerte

### 5. El Moat se Profundiza con el Tiempo
```
Más skills en marketplace → Más usuarios → Más datos de seguridad → Mejor scanner 
→ Más confianza → Más skills → Más revenue → Loop infinito
```

---

## PARTE 8: RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Cloudflare lanza su propio skills marketplace | Media | Alto | Sé su partner, no su competencia. Usa su infra, sé una "showcase app" |
| OpenClaw resuelve su seguridad internamente | Baja | Alto | OpenClaw es local-first por diseño — su modelo de seguridad es fundamentalmente diferente |
| Anthropic/OpenAI lanzan managed skills | Alta | Medio | Son vendor-locked. construye.lat es multi-agente, multi-modelo, open source |
| Nadie paga por seguridad de skills | Media | Alto | Pivotear a "managed agent" con inferencia incluida (modelo Featherless) |
| LATAM no tiene poder adquisitivo suficiente | Media | Medio | Pricing ajustado a LATAM + clientes enterprise de US/EU como upside |

---

## RESUMEN: QUÉ HACER MAÑANA

1. **Crear cuenta Polar.sh** y configurar 3 tiers de pricing → 30 min
2. **Publicar 3 skills básicos** en skills.sh y ClawHub → 2-3 horas
3. **Escribir blog post** "1,184 skills maliciosas en ClawHub — Cómo protegerte" → 2 horas
4. **Publicar en LinkedIn en español** ofreciendo consultoría de agentes IA → 30 min
5. **Contactar 5 empresas LATAM** que necesiten implementar agentes → 1 hora

**Revenue esperado primera semana: $0 (setup)**  
**Revenue esperado segundo mes: $3,000-6,000**  
**Revenue esperado sexto mes: $14,000/mo**  
**Nunca estás más de 30 días sin ingresos.**

---

*"La mejor forma de predecir el futuro es inventarlo." — Alan Kay*

*construye.lat no compite con OpenClaw, Claude Code, ni Codex. Los COMPLEMENTA siendo la capa de seguridad y ejecución que todos necesitan pero nadie ha construido.*
