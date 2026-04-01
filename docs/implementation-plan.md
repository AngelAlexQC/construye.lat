# Plan de Implementación — construye.lat

## Fase 1: Foundation (Semana 1-2)
> Objetivo: que `pnpm turbo build && pnpm turbo test` pase verde

### 1.1 Monorepo bootstrap
- [ ] `pnpm install` funcional
- [ ] `pnpm turbo build` compila todos los paquetes
- [ ] `pnpm turbo typecheck` sin errores
- [ ] CI con GitHub Actions (lint + typecheck + test)

### 1.2 @construye/shared — tests
- [ ] Tests para token-counter.ts (estimateTokens, wouldExceedBudget)
- [ ] Tests para errors.ts (cada tipo de error)
- [ ] Tests para constants.ts (valores correctos)

### 1.3 @construye/core — implementación real
- [ ] Agent loop con provider real (mock primero)
- [ ] Tests para compaction (shouldCompact, compact)
- [ ] Tests para model-router (classifyTask)
- [ ] Tests para session-manager (CRUD)
- [ ] Tests para context-engine (assembleContext)

### 1.4 @construye/tools — implementación local
- [ ] read-file: implementar con fs.readFile de Node
- [ ] write-file: implementar con fs.writeFile
- [ ] edit-file: implementar replace en contenido
- [ ] search-text: implementar con grep/ripgrep
- [ ] list-dir: implementar con fs.readdir
- [ ] glob: implementar con fast-glob
- [ ] Tests para registry (register, get, getStubs)
- [ ] Tests para router (routeExecution)
- [ ] Tests para approval (shouldRequireApproval)

## Fase 2: Provider Integration (Semana 3)
> Objetivo: streaming real con Claude API

### 2.1 @construye/providers — Claude real
- [ ] Implementar ClaudeProvider.stream con Anthropic SDK
- [ ] Implementar ClaudeProvider.countTokens real
- [ ] Tests con mocks del API
- [ ] Rate limiting y retry reales

### 2.2 @construye/providers — OpenAI
- [ ] Implementar OpenAIProvider.stream con OpenAI SDK
- [ ] Tests con mocks

### 2.3 AI Gateway routing
- [ ] AIGateway con fallback entre providers
- [ ] Logging de costos en CostTracker
- [ ] Tests de fallback

## Fase 3: CLI MVP (Semana 4)
> Objetivo: `construye "fix the bug in auth.ts"` funciona localmente

### 3.1 CLI funcional
- [ ] React Ink app renderiza correctamente
- [ ] Input de usuario → agent loop → respuesta
- [ ] Streaming de respuesta al terminal
- [ ] Tool calls visibles con spinners
- [ ] Status bar con tokens y costo

### 3.2 Modos de operación
- [ ] Plan mode: solo lectura, no ejecuta writes
- [ ] Interactive mode: pide confirmación en writes
- [ ] Auto mode: solo confirma git operations

### 3.3 Sesión y compaction
- [ ] Sesiones persistidas en disco (JSON)
- [ ] Auto-compaction al 80% de contexto
- [ ] Comando /compact manual

## Fase 4: Cloud Execution (Semana 5-6)
> Objetivo: `construye --cloud` funciona en Cloudflare

### 4.1 Worker deployment
- [ ] Worker desplegado con wrangler
- [ ] D1 schema migrado
- [ ] R2 bucket creado
- [ ] KV namespace configurado

### 4.2 Durable Object agent
- [ ] WebSocket handshake funcional
- [ ] Agent loop corriendo en DO
- [ ] Sesión persistida en DO storage + D1

### 4.3 Sandbox execution
- [ ] Dynamic Worker: file ops reales
- [ ] Container: shell execution real
- [ ] Code Mode: batch execution funcional

### 4.4 Auth flow
- [ ] GitHub OAuth completo
- [ ] JWT generation/verification real con crypto.subtle
- [ ] Rate limiting por tier

## Fase 5: Skills & RAG (Semana 7)
> Objetivo: skills system y búsqueda semántica funcionan

### 5.1 Skills
- [ ] Cargar skills desde .construye/skills/
- [ ] Matcher funcional (keyword + description)
- [ ] Auto-inject skills relevantes al contexto
- [ ] Instalación de skills desde registry

### 5.2 RAG / Vectorize
- [ ] Indexar repositorio al crear proyecto
- [ ] Embeddings via Workers AI
- [ ] search_semantic funcional con Vectorize
- [ ] Re-indexar en cambios

## Fase 6: Web Dashboard (Semana 8)
> Objetivo: dashboard web básico en construye.lat

### 6.1 Landing page
- [ ] Marketing page en /
- [ ] Login con GitHub
- [ ] Dashboard de proyectos

### 6.2 Session UI
- [ ] Vista de sesión con chat
- [ ] WebSocket al worker
- [ ] File diff viewer
- [ ] Cost tracker visible

## Post-MVP
- [ ] MCP server exposure
- [ ] Plugin VS Code
- [ ] Proactive agents (Workflows)
- [ ] Team collaboration
- [ ] Custom model support
- [ ] Self-hosted deployment guide
