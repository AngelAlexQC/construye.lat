# Diseño: SaaS de Comercio Conversacional Inteligente

**Fecha:** 2026-03-31  
**Estado:** Borrador para revisión  
**Codename:** `Nexo` (nombre de trabajo)

---

## 1. DEFINICIÓN DEL PRODUCTO (PRD)

### 1.1 Propuesta de Valor Única (USP)

> **"Registrate, conecta tu WhatsApp, y en 3 minutos tenés un vendedor con IA que cobra, despacha y atiende 24/7."**

La diferencia fundamental contra todo lo que existe:

| Competidor | Lo que hacen | Lo que les falta |
|---|---|---|
| Vercel | Deploy instantáneo de frontends | No tiene lógica de negocio, pagos ni IA conversacional |
| Kapso/Builderbot/Jelou | Chatbots por WhatsApp | Flujos rígidos, sin catálogos reales, sin pagos nativos |
| PedidosYa | Quick-commerce con catálogos | Marketplace cerrado, comisiones altas, sin IA del lado del comercio |
| Payphone/Deuna | Pagos sin fricción | Solo pagos, no entienden el contexto conversacional |

**Nexo es la unión atómica de estos 4 pilares en un solo producto serverless en el edge.** No es un chatbot con pagos pegados. Es un motor de comercio donde la IA ES la interfaz, los pagos son nativos, y el catálogo es el conocimiento base del agente.

### 1.2 Las 5 Funcionalidades Core (MVP)

#### F1: Agente de IA Conversacional con Razonamiento Real
- Workers AI ejecuta un LLM en el edge con <50ms de latencia.
- El agente no sigue scripts. Tiene acceso al catálogo completo (embeddings en Vectorize), historial de conversación del cliente (Durable Objects), y políticas del comercio (D1).
- Soporta: recomendaciones, resolución de dudas, upselling, manejo de quejas, y cierre de venta — todo en lenguaje natural.

#### F2: Catálogo Inteligente Sincronizado
- Dashboard en Cloudflare Pages donde el comercio sube/edita productos.
- Imágenes en R2. Metadata en D1. Embeddings vectoriales auto-generados en Vectorize para búsqueda semántica.
- Cada cambio en el catálogo actualiza el "conocimiento" del agente en tiempo real via KV cache invalidation.

#### F3: Motor de Pagos Conversacional
- Link de pago dinámico generado inline durante el chat y enviado por WhatsApp.
- Integración con procesadores locales (Payphone, Deuna, Stripe para LATAM).
- El estado del pago se trackea en Durable Objects → el agente confirma al comprador en tiempo real ("¡Tu pago fue recibido! Tu pedido #4521 está en camino").

#### F4: Gestión de Órdenes y Envíos
- Al confirmarse el pago, se crea automáticamente la orden en D1.
- Notificación al comercio via WhatsApp/Dashboard/Webhook.
- Integración con APIs de delivery (ej. servientrega, glovo, fleet propia) o pickup.
- El agente informa al consumidor del estado sin que pregunte (proactive messaging).

#### F5: Dashboard del Comercio (Panel SaaS)
- Single Page App en Cloudflare Pages.
- Métricas en tiempo real: ventas, conversaciones, conversión, productos top.
- Gestión de: catálogo, precios, horarios de atención, personalidad del agente, respuestas personalizadas, configuración de pagos.
- Multi-usuario con roles (dueño, staff).

### 1.3 Flujo de "Onboarding Mágico" (0 → Operando en 3 minutos)

```
MINUTO 0:00 — REGISTRO
┌─────────────────────────────────────────────────────────┐
│  1. Comercio entra a nexo.com                           │
│  2. Click "Empezar gratis"                              │
│  3. Ingresa: email + nombre del negocio + país          │
│  4. Auth via magic link (no password)                   │
│                                                         │
│  [Backend: Worker crea tenant en D1, genera tenant_id,  │
│   crea namespace en KV, provisiona Durable Object]      │
└─────────────────────────────────────────────────────────┘

MINUTO 0:30 — CONEXIÓN DE WHATSAPP
┌─────────────────────────────────────────────────────────┐
│  5. Dashboard muestra QR para vincular WhatsApp         │
│     Business API (via proveedor: Meta Cloud API)        │
│  6. Comercio escanea QR desde su teléfono               │
│  7. Webhook de verificación confirma conexión            │
│                                                         │
│  [Backend: Worker almacena wa_phone_id + wa_token en    │
│   D1 (encriptado), registra webhook URL por tenant]     │
└─────────────────────────────────────────────────────────┘

MINUTO 1:00 — CATÁLOGO EXPRESS
┌─────────────────────────────────────────────────────────┐
│  8. Opción A: "Subir catálogo" (CSV/Excel/foto del menú)│
│     → Workers AI extrae items de imagen o parsea CSV     │
│  8. Opción B: "Agregar productos manualmente"           │
│     → Min 3 productos para activar (nombre+precio+foto) │
│  9. Imágenes → R2. Datos → D1. Embeddings → Vectorize  │
│                                                         │
│  [Todo en paralelo, progressive loading en dashboard]   │
└─────────────────────────────────────────────────────────┘

MINUTO 2:00 — CONFIGURACIÓN DEL AGENTE
┌─────────────────────────────────────────────────────────┐
│  10. Wizard: "¿Cómo quieres que hable tu agente?"      │
│      → Presets: Profesional / Amigable / Formal         │
│  11. Horario de atención (o 24/7)                       │
│  12. Método de pago: conectar Payphone/Deuna/Stripe     │
│      → OAuth flow simplificado                          │
│  13. Método de entrega: Delivery / Pickup / Ambos       │
│                                                         │
│  [Backend: guarda config en D1 tenant_settings]         │
└─────────────────────────────────────────────────────────┘

MINUTO 3:00 — ¡EN VIVO!
┌─────────────────────────────────────────────────────────┐
│  14. Dashboard muestra: "Tu agente está activo 🟢"      │
│  15. Botón "Probar ahora" → abre WhatsApp con          │
│      deep link al número conectado                      │
│  16. Comercio prueba enviando "Hola"                    │
│  17. El agente responde con saludo + catálogo resumido  │
│                                                         │
│  [La primera conversación ES la verificación]           │
└─────────────────────────────────────────────────────────┘
```

---

## 2. ARQUITECTURA DEL SISTEMA

### 2.1 Mapeo de Servicios Cloudflare

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE EDGE (Global)                     │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   CF Pages    │  │  Workers     │  │    Workers AI            │  │
│  │  (Dashboard   │  │  (API +      │  │  (LLM inference +        │  │
│  │   SPA React)  │  │   Webhooks)  │  │   embedding generation)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
│  ┌──────┴─────────────────┴────────────────────────┴─────────────┐  │
│  │                     Workers Router                             │  │
│  │  POST /webhook/whatsapp/:tenantId  → WhatsApp Handler Worker  │  │
│  │  GET/POST /api/v1/*               → API Worker (Dashboard)    │  │
│  │  POST /api/v1/payments/callback   → Payment Webhook Worker    │  │
│  └──────┬──────────────┬──────────────┬──────────────┬───────────┘  │
│         │              │              │              │               │
│  ┌──────┴───┐  ┌──────┴───┐  ┌──────┴───┐  ┌──────┴────────────┐  │
│  │   D1     │  │   KV     │  │   R2     │  │ Durable Objects   │  │
│  │ (SQL DB) │  │ (Cache)  │  │ (Blobs)  │  │ (State machines)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐ │
│  │     Vectorize        │  │          Queues                      │ │
│  │ (Embeddings search)  │  │  (Async: emails, analytics, sync)   │ │
│  └──────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────────┐
              ▼               ▼                   ▼
     ┌────────────┐  ┌──────────────┐  ┌──────────────────┐
     │  WhatsApp   │  │  Payphone/   │  │  Delivery APIs   │
     │  Cloud API  │  │  Deuna/      │  │  (Servientrega,  │
     │  (Meta)     │  │  Stripe      │  │   Glovo, etc.)   │
     └────────────┘  └──────────────┘  └──────────────────┘
```

### 2.2 Mapeo Detallado: Qué Servicio Hace Qué

| Servicio CF | Responsabilidad | Justificación |
|---|---|---|
| **Workers** | Toda la lógica de negocio: recibir webhooks de WhatsApp, orquestar IA, generar links de pago, CRUD del dashboard, autenticación | Serverless, 0ms cold start, ejecuta JS/TS en 300+ PoPs globales. Ideal para webhooks que requieren <5s de respuesta (requisito de Meta). |
| **D1** | Base de datos relacional multi-tenant: tenants, productos, órdenes, usuarios, configuración, transacciones | SQLite en el edge. Lecturas ultra-rápidas desde el PoP más cercano. Escrituras via leader. Suficiente para el volumen de un SaaS B2B en fase de crecimiento. |
| **KV** | Cache de catálogos (hot path), tokens de sesión, rate limiting counters, feature flags, configuración estática por tenant | Lecturas en <1ms globalmente. Eventual consistency aceptable para catálogos (refresh cada 30s). |
| **Durable Objects** | Estado de conversaciones WhatsApp (carrito en curso, contexto del chat), sesiones de pago activas, locks de inventario temporal | Cada conversación = 1 Durable Object. Garantiza consistencia fuerte y single-threaded execution — crítico para evitar race conditions en carritos y pagos. |
| **R2** | Imágenes de productos, comprobantes de pago, archivos multimedia del chat, exports CSV | Object storage S3-compatible sin egress fees. Los comercios suben media sin costo de bandwidth. |
| **Workers AI** | Inference del LLM (llama-3.3-70b-instruct), generación de embeddings (@cf/bge-base-en-v1.5), extracción de datos de imágenes de menú | Inference en el edge, sin llamadas a APIs externas. Latencia <100ms. Sin cold starts de GPU. |
| **Vectorize** | Índice de embeddings por tenant para búsqueda semántica de productos ("quiero algo barato para almorzar") | Permite búsqueda por intención en lugar de keyword match. Crítico para que la IA recomiende productos relevantes. |
| **Queues** | Procesamiento async: envío de emails transaccionales, webhooks a terceros, generación de reportes, sincronización de inventario | Desacopla el hot path (respuesta al usuario en <3s) del procesamiento pesado. |
| **Pages** | Dashboard SPA del comercio (React/Solid) | Deploy atómico, preview deployments, integración directa con Workers para API calls. |

### 2.3 Flujo de Datos Paso a Paso: Del "Hola" al Pago Confirmado

```
CONSUMIDOR                    CLOUDFLARE                         SERVICIOS EXTERNOS
─────────                    ──────────                         ──────────────────

1. Envía "Hola"         ──►  Meta WhatsApp Cloud API
   por WhatsApp               │
                               ▼
                        2. Webhook POST /webhook/whatsapp/:tenantId
                               │
                               ▼
                        3. Worker: WhatsApp Handler
                           ├─ Verifica firma HMAC del webhook (seguridad)
                           ├─ Extrae: tenant_id, sender_phone, message_text
                           ├─ Lookup tenant config en KV (cache) o D1 (miss)
                           │
                           ▼
                        4. Obtiene/Crea Durable Object: ConversationDO
                           ID = hash(tenant_id + sender_phone)
                           ├─ Carga historial de conversación (últimos 20 msgs)
                           ├─ Carga carrito activo (si existe)
                           ├─ Carga perfil del comprador (si existe, desde D1)
                           │
                           ▼
                        5. Workers AI — LLM Inference
                           ├─ System prompt:
                           │   "Eres {agent_name} de {business_name}.
                           │    Tu catálogo: {catalog_summary_from_kv}.
                           │    Personalidad: {tone_preset}.
                           │    Reglas: {business_rules}."
                           ├─ Mensajes previos como contexto
                           ├─ Herramientas disponibles para el LLM (tool_use):
                           │   - search_catalog(query) → Vectorize semantic search
                           │   - get_product(id) → D1 lookup
                           │   - add_to_cart(product_id, qty) → DO mutation
                           │   - create_payment_link(cart) → Worker sub-request
                           │   - get_order_status(order_id) → D1 lookup
                           │   - transfer_to_human() → flag en DO
                           │
                           ▼
                        6. LLM responde (para "Hola"):
                           "¡Hola! 👋 Soy el asistente de {negocio}.
                            ¿En qué te puedo ayudar?
                            📋 Ver menú | 🔍 Buscar algo | 📦 Estado de pedido"

                        7. Worker envía respuesta ──►  Meta WhatsApp Cloud API
                           POST messages/ con el texto                │
                                                                      ▼
                                                              Consumidor recibe
                                                              respuesta en <3s
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

[Consumidor pide "Quiero una hamburguesa doble con papas"]

                        8. ConversationDO recibe mensaje
                           │
                           ▼
                        9. Workers AI con tool_use:
                           LLM decide llamar: search_catalog("hamburguesa doble papas")
                           │
                           ▼
                        10. Vectorize: búsqueda semántica en namespace del tenant
                            Retorna: [{id: "prod_42", name: "Combo Doble Smash",
                                       price: 8.50, score: 0.94}, ...]
                           │
                           ▼
                        11. LLM genera respuesta con recomendación:
                            "¡Excelente elección! Te recomiendo:
                             🍔 Combo Doble Smash — $8.50
                             Incluye papas fritas + bebida.
                             ¿Lo agrego al pedido?"

                        12. Worker envía ──► WhatsApp API ──► Consumidor

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

[Consumidor dice "Sí, agrega eso y quiero pagar"]

                        13. LLM tool_use: add_to_cart("prod_42", 1)
                            → ConversationDO actualiza carrito en state
                           │
                           ▼
                        14. LLM tool_use: create_payment_link(cart)
                            → Worker genera link en Payment Provider
                            │
                            ├──► Payphone/Deuna/Stripe API: POST /payment-links
                            │    Body: {amount: 8.50, currency: "USD",
                            │           metadata: {tenant_id, order_id, phone}}
                            │
                            ◄── Response: {payment_url: "https://pay.nexo.com/p/abc123"}
                           │
                           ▼
                        15. LLM genera mensaje con link:
                            "Tu pedido:
                             🍔 Combo Doble Smash — $8.50
                             💳 Paga aquí: https://pay.nexo.com/p/abc123
                             El link expira en 15 minutos."

                        16. Worker envía ──► WhatsApp + guarda order en D1
                            (status: "pending_payment")

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

[Consumidor abre link, paga con tarjeta]

                        17. Payment Provider confirma ──► Webhook POST
                            /api/v1/payments/callback
                           │
                           ▼
                        18. Payment Worker:
                            ├─ Verifica firma HMAC del webhook
                            ├─ Actualiza orden en D1: status → "paid"
                            ├─ Registra transacción en D1 (inmutable)
                            ├─ Notifica ConversationDO del buyer
                            │
                            ▼
                        19. ConversationDO dispara mensaje proactivo:
                            Worker envía ──► WhatsApp API:
                            "✅ ¡Pago recibido! Tu pedido #4521 está confirmado.
                             🚀 Tiempo estimado: 25-35 min.
                             Te avisaré cuando esté en camino."

                        20. En paralelo (via Queue):
                            ├─ Notificar al comercio (WhatsApp + Dashboard push)
                            ├─ Enviar a API de delivery (si aplica)
                            ├─ Actualizar métricas en D1 analytics table
                            └─ Generar comprobante PDF → R2
```

### 2.4 Estrategia Multi-Tenant

**Enfoque: Shared Database, Tenant-Scoped Rows (con aislamiento lógico estricto)**

Razón: D1 tiene un límite práctico de bases de datos por cuenta. Para escalar a miles de comercios, una DB-por-tenant no es viable. Pero el aislamiento debe ser absoluto.

#### Estructura de Aislamiento

```
┌─────────────────────────────────────────────────────────┐
│                    D1 Database: nexo_main                │
│                                                         │
│  Toda tabla tiene columna: tenant_id TEXT NOT NULL       │
│  Todo índice incluye tenant_id como primer campo        │
│  Todo query DEBE filtrar por tenant_id                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Tabla: products                                  │    │
│  │ PK: id (uuid)                                    │    │
│  │ IDX: (tenant_id, category)                       │    │
│  │ IDX: (tenant_id, status)                         │    │
│  │ Cada fila pertenece EXACTAMENTE a un tenant      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Tabla: orders                                    │    │
│  │ PK: id (uuid)                                    │    │
│  │ FK: tenant_id → tenants.id                       │    │
│  │ IDX: (tenant_id, status, created_at)             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               KV Namespace: nexo_cache                  │
│                                                         │
│  Key pattern: {tenant_id}:{resource}:{id}               │
│  Ejemplo: "tn_abc:catalog:full"                         │
│  Ejemplo: "tn_abc:config:agent"                         │
│  TTL: 5 minutos para catálogo, 1 hora para config      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│            Durable Objects: ConversationDO               │
│                                                         │
│  ID: hash(tenant_id + buyer_phone)                      │
│  → Aislamiento natural: cada conversación es un DO      │
│  → No hay forma de que un tenant acceda al DO de otro   │
│  → El DO guarda su propio state (carrito, historial)    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│            R2 Bucket: nexo-media                        │
│                                                         │
│  Path pattern: /{tenant_id}/products/{product_id}.webp  │
│  Path pattern: /{tenant_id}/receipts/{order_id}.pdf     │
│  Acceso: signed URLs con expiración, scoped por tenant  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           Vectorize: nexo_catalog_embeddings            │
│                                                         │
│  Cada vector tiene metadata: { tenant_id: "tn_abc" }   │
│  Query filter: WHERE tenant_id = "tn_abc"               │
│  → Búsqueda semántica aislada por tenant                │
└─────────────────────────────────────────────────────────┘
```

#### Capa de Seguridad Multi-Tenant

```typescript
// Middleware obligatorio en todo Worker
function withTenantScope(handler: Handler): Handler {
  return async (request, env, ctx) => {
    const tenantId = extractTenantId(request); // de JWT, path, o webhook
    if (!tenantId) return new Response('Unauthorized', { status: 401 });

    // Inyectar tenant-scoped DB helper
    const db = createScopedDb(env.DB, tenantId);
    // db.query() automáticamente añade WHERE tenant_id = ?
    // db.insert() automáticamente añade tenant_id al row

    return handler(request, { ...env, db, tenantId }, ctx);
  };
}
```

**Regla de oro:** Ningún query a D1 puede ejecutarse sin `tenant_id` en el WHERE. Esto se enforce en la capa de abstracción, no por convención.

---

## 3. ARQUITECTURA DE PAGOS Y FINTECH

### 3.1 Diseño Conceptual del Sistema de Pagos

```
┌──────────────────────────────────────────────────────────────────────┐
│                    NEXO PAYMENT GATEWAY LAYER                        │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  Payphone        │    │  Deuna           │    │  Stripe         │  │
│  │  Adapter         │    │  Adapter         │    │  Adapter        │  │
│  │  (Ecuador)       │    │  (LATAM)         │    │  (Global)       │  │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │
│           └──────────────────────┼──────────────────────┘            │
│                                  ▼                                    │
│                    ┌─────────────────────────┐                       │
│                    │  Payment Orchestrator    │                       │
│                    │  (Worker)                │                       │
│                    │                          │                       │
│                    │  - Routing por país/psp  │                       │
│                    │  - Retry con fallback    │                       │
│                    │  - Idempotency keys      │                       │
│                    │  - Rate limiting          │                       │
│                    └─────────┬───────────────┘                       │
│                              │                                        │
│              ┌───────────────┼───────────────┐                       │
│              ▼               ▼               ▼                       │
│     ┌──────────────┐ ┌────────────┐ ┌──────────────────┐            │
│     │ D1:           │ │ DO:         │ │ Queue:            │            │
│     │ transactions  │ │ PaymentDO   │ │ payment_events    │            │
│     │ (inmutable)   │ │ (state      │ │ (async settle,    │            │
│     │              │ │  machine)   │ │  reconciliation)  │            │
│     └──────────────┘ └────────────┘ └──────────────────┘            │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Flujo de Pago Detallado

```
Paso 1: CREACIÓN DEL LINK DE PAGO
─────────────────────────────────
- ConversationDO detecta intent de pago (LLM tool_use: create_payment_link)
- Payment Orchestrator Worker:
  a. Genera idempotency_key = hash(tenant_id + order_id + amount)
  b. Selecciona PSP según país del tenant (config en D1)
  c. Crea PaymentDO con ID = idempotency_key
  d. PaymentDO estado inicial: CREATED
  e. Llama al PSP adapter → genera link/session
  f. PaymentDO estado: LINK_GENERATED
  g. Guarda en D1: payment_intents (inmutable append-only log)
  h. Retorna URL al ConversationDO → se envía por WhatsApp

Paso 2: CONSUMIDOR PAGA
────────────────────────
- Consumidor abre link → hosted checkout del PSP
- PSP procesa tarjeta/transferencia
- PSP envía webhook a /api/v1/payments/callback

Paso 3: CONFIRMACIÓN Y SETTLEMENT
──────────────────────────────────
- Payment Webhook Worker:
  a. Verifica firma HMAC del PSP (CRITICAL — rechaza si inválida)
  b. Lookup PaymentDO por idempotency_key (del metadata)
  c. PaymentDO transiciona: LINK_GENERATED → CONFIRMED
  d. Write inmutable en D1: transactions {
       id, tenant_id, order_id, amount, currency,
       psp, psp_transaction_id, status, raw_response,
       created_at, confirmed_at
     }
  e. Cola async (Queue): notificaciones, actualización de orden, analytics
  f. PaymentDO notifica ConversationDO → mensaje proactivo al comprador

Paso 4: MODELO DE ESCROW (para comercios nuevos/no verificados)
──────────────────────────────────────────────────────────────
- Los fondos NO van directo al comercio
- Nexo actúa como facilitador de pagos (PSP hace el hold)
- Settlement schedule configurable: T+1, T+3, T+7 según tier
- Release automático via Queue scheduled job
- Dashboard del comercio muestra: balance, pending, settled
```

### 3.3 Estado Machine del Pago (PaymentDO)

```
CREATED ──► LINK_GENERATED ──► CONFIRMED ──► SETTLED
   │              │                │              │
   │              ▼                ▼              ▼
   └──► EXPIRED  CANCELLED     REFUND_REQUESTED ──► REFUNDED
                               DISPUTED ──► RESOLVED
```

Cada transición:
- Es atómica (Durable Object = single-threaded)
- Se loguea como evento inmutable en D1
- Es idempotente (mismo webhook 2x = misma transición)

### 3.4 Seguridad e Inmutabilidad en el Edge

| Amenaza | Mitigación |
|---|---|
| **Webhook spoofing** | Verificación HMAC-SHA256 de cada webhook de PSP. Clave secreta en Workers Secrets (env vars encriptados). Rechazo inmediato si firma inválida. |
| **Replay attacks** | Idempotency key en PaymentDO. Segunda llamada con mismo ID = no-op. Registro de webhook IDs procesados. |
| **Tampering de montos** | El monto se fija al crear el PaymentDO (server-side). El webhook solo confirma; nunca se usa el monto del webhook — se valida contra lo registrado. |
| **Acceso cross-tenant** | Payment routes requieren tenant_id. PaymentDO ID incluye tenant_id. No hay endpoint que liste pagos sin scope. |
| **Data integrity** | Tabla `transactions` es append-only. No hay UPDATE/DELETE. Cada estado nuevo = nuevo row en `transaction_events`. |
| **PCI Compliance** | Nexo NUNCA toca datos de tarjeta. Hosted checkout del PSP maneja PCI. Solo recibimos tokens/IDs. |
| **Secrets management** | PSP API keys, webhook secrets, y tokens de WhatsApp se almacenan como Workers Secrets (encriptados at-rest, accesibles solo en runtime del Worker autorizado). |

### 3.5 Modelo de Revenue de Pagos

```
Por cada transacción:
┌───────────────────────────────────────────┐
│  Consumidor paga: $10.00                  │
│  PSP fee (Payphone/Stripe): ~3.5% = $0.35│
│  Nexo fee: 1.5% = $0.15                  │
│  Comercio recibe: $9.50                   │
│                                           │
│  Nexo gana por:                           │
│  1. Suscripción mensual (tier-based)      │
│  2. % por transacción procesada           │
│  3. Add-ons (analytics premium, AI avanz.)│
└───────────────────────────────────────────┘
```

---

## 4. ESTRATEGIA DE EXPANSIÓN Y ESCALABILIDAD

### 4.1 Cuellos de Botella Probables y Mitigaciones

#### Cuello #1: Límite de Escrituras en D1

**Problema:** D1 usa un modelo single-leader para escrituras. Todas las escrituras van al mismo nodo líder. Con miles de órdenes concurrentes, esto se convierte en bottleneck.

**Mitigación:**
```
Estrategia: Write-Behind + Durable Objects como buffer

1. Hot data (carritos, estado de conversación) → Durable Objects
   - Cada DO es single-threaded pero distribuido globalmente
   - Miles de DOs corriendo en paralelo = miles de "micro-databases"

2. Cold data (órdenes confirmadas, transacciones) → D1 via Queue
   - Queue batch writer: agrupa INSERTs en batches de 50-100
   - Cada batch = 1 transaction a D1
   - D1 handles ~10K writes/sec con batching

3. Reads → KV cache para hot paths
   - Catálogos, configs → read from KV (1ms global)
   - D1 solo para queries ad-hoc del dashboard

Escenario nuclear: Si D1 no escala →
   - Migrar cold storage a Hyperdrive + Neon/Turso (PG edge)
   - Mantener hot path en DO + KV (no cambia la API)
```

#### Cuello #2: Latencia de Workers AI

**Problema:** LLM inference puede tomar 500ms-3s dependiendo del modelo y longitud del prompt. WhatsApp espera respuesta en <5s o muestra "escribiendo..." indefinido.

**Mitigación:**
```
1. "Typing indicator" inmediato
   - Al recibir webhook, Worker envía INMEDIATAMENTE
     WhatsApp "typing" status
   - Compra 10-15 segundos de percepción

2. Model routing inteligente
   - Mensajes simples ("Hola", "Sí", "Cuánto cuesta X"):
     → Modelo pequeño: llama-3.2-3b-instruct (~50ms)
   - Mensajes complejos (recomendaciones, quejas):
     → Modelo grande: llama-3.3-70b-instruct (~1-3s)
   - Clasificador rápido (regex + small model) decide en <10ms

3. Prompt engineering agresivo
   - System prompt compacto (<500 tokens)
   - Catálogo resumido en KV (top 20 productos, no el catálogo entero)
   - Historial truncado (últimos 10 mensajes, no toda la conversación)

4. Streaming interno
   - Workers AI soporta streaming
   - Para respuestas largas: enviar primera oración rápido,
     completar el resto como segundo mensaje
```

#### Cuello #3: Rate Limits de WhatsApp Cloud API

**Problema:** Meta impone límites: 80 msgs/sec para business accounts estándar. Con múltiples comercios de alto volumen, esto escala.

**Mitigación:**
```
1. Cada comercio tiene su propia WhatsApp Business Account
   → Rate limit es POR CUENTA, no global
   → Nexo NO es bottleneck

2. Message Queue con backpressure
   - Mensajes salientes → CF Queue → Worker consumer
   - Si WhatsApp retorna 429 → re-queue con exponential backoff

3. Para comercios enterprise: upgrade a higher tier con Meta
   - Automatizar request de throughput increase via API
```

#### Cuello #4: Costo de Workers AI a Escala

**Problema:** LLM inference no es gratis. A 100K conversaciones/día, el costo de AI puede superar el revenue.

**Mitigación:**
```
1. Caching de respuestas comunes
   - KV: hash(tenant_id + normalized_intent) → cached_response
   - "¿Cuáles son los horarios?" → cached (no necesita LLM)
   - Hit rate esperado: 30-40% de mensajes recurrentes

2. Tiered AI por plan
   - Free: solo modelo small (3B params)
   - Pro: modelo grande + tool use
   - Enterprise: fine-tuned model + context window extendido

3. Intent classification antes de LLM
   - Regex + keyword matching para intents obvios:
     "estado de mi pedido" → lookup directo en D1, sin LLM
     "horarios" → respuesta estática de config
   - Solo los mensajes ambiguos/complejos usan LLM

4. Monitor de cost-per-conversation
   - Tag cada inference con tenant_id + conversation_id
   - Dashboard interno de unit economics por comercio
```

#### Cuello #5: Tamaño de D1 y Límites del Plan

**Problema:** D1 tiene límites de tamaño de DB y número de DBs por cuenta.

**Mitigación:**
```
Estrategia de sharding horizontal:

Fase 1 (0-1000 tenants): 1 DB compartida
  - Sufficient para ~50GB de data
  - Índices bien diseñados = queries rápidos

Fase 2 (1000-10000 tenants): DB sharding por región
  - nexo_latam_north (México, Colombia, Venezuela)
  - nexo_latam_south (Ecuador, Perú, Chile, Argentina)
  - nexo_global (otros)
  - Routing por tenant.region en el Worker

Fase 3 (10000+ tenants): Hybrid
  - Hot data: Durable Objects (estado) + KV (cache)
  - Warm data: D1 sharded (órdenes recientes, catálogos)
  - Cold data: R2 + Parquet files (historial, analytics)
  - O migrar a Hyperdrive → Postgres externo
```

### 4.2 Resumen de Escalabilidad por Servicio

| Servicio | Capacidad | Límite práctico | Escape hatch |
|---|---|---|---|
| **Workers** | 1000 req/sec por worker, auto-scales | Prácticamente ilimitado | N/A — ya es la solución |
| **D1** | ~10K writes/sec batched, reads en edge | ~50GB por DB | Hyperdrive + Postgres |
| **KV** | ~100K reads/sec, eventual consistency | 25M keys por namespace | Namespace sharding |
| **Durable Objects** | 1 DO = 1 thread, pero millones de DOs ok | Costo por request/duración | Optimizar alarm frequency |
| **R2** | Ilimitado almacenamiento, S3-compatible | Prácticamente ilimitado | N/A |
| **Workers AI** | Rate limiting por cuenta | ~500 req/min (escala con plan) | Gateway AI routing a OpenAI/Anthropic como fallback |
| **Vectorize** | 5M vectors por índice | Dimensiones y throughput | Índice por región/shard |
| **Queues** | 100K msgs/sec | Batch consumer limits | Multiple queues por tipo |

### 4.3 Pricing Tiers (Modelo de Negocio)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXO PRICING                                │
│                                                                     │
│  🆓 STARTER (Gratis)                                                │
│  ├─ 100 conversaciones IA/mes                                       │
│  ├─ 50 productos en catálogo                                        │
│  ├─ 1 usuario                                                       │
│  ├─ Fee por transacción: 3%                                         │
│  ├─ AI: modelo small                                                │
│  └─ Branding "Powered by Nexo" en los mensajes                     │
│                                                                     │
│  ⭐ PRO ($29/mes)                                                   │
│  ├─ 2,000 conversaciones IA/mes                                     │
│  ├─ 500 productos                                                   │
│  ├─ 5 usuarios                                                      │
│  ├─ Fee por transacción: 1.5%                                       │
│  ├─ AI: modelo grande + tool use                                    │
│  ├─ Analytics avanzados                                             │
│  ├─ Integración delivery APIs                                       │
│  └─ Sin branding Nexo                                               │
│                                                                     │
│  🏢 ENTERPRISE ($99/mes)                                            │
│  ├─ Conversaciones ilimitadas                                       │
│  ├─ Productos ilimitados                                            │
│  ├─ Usuarios ilimitados                                             │
│  ├─ Fee por transacción: 0.8%                                       │
│  ├─ AI: modelo grande + fine-tuning + context extendido             │
│  ├─ API access + webhooks                                           │
│  ├─ White-label completo                                            │
│  ├─ Priority support                                                │
│  └─ Custom integrations                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## RESUMEN EJECUTIVO

**Nexo** es un SaaS B2B2C que convierte cualquier comercio en un negocio AI-first via WhatsApp en 3 minutos. Construido 100% en el edge de Cloudflare:

- **Workers** = cerebro (API + lógica)
- **D1** = memoria relacional (productos, órdenes, tenants)
- **Durable Objects** = estado vivo (carritos, chats, pagos in-flight)
- **KV** = cache caliente (catálogos, configs)
- **R2** = almacén (imágenes, PDFs)
- **Workers AI** = razonamiento (ventas, soporte, recomendaciones)
- **Vectorize** = búsqueda inteligente (el cliente dice qué quiere, la IA entiende)
- **Queues** = async (emails, webhooks, settlement)
- **Pages** = dashboard del comercio

Multi-tenant con aislamiento lógico estricto. Pagos inmutables con state machines en DOs. Escalable de 1 comercio a 100,000 sin cambiar la arquitectura — solo adding shards.
