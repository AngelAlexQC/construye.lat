# construye.lat — Open Source AI Coding Agent Platform on Cloudflare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the best open-source AI coding agent that runs entirely on Cloudflare — as a framework first, then products on top.

**Architecture:** Monorepo with layered packages. Framework layer (@construye/core, tools, providers, skills, storage, sandbox) is the foundation. Product layer (CLI, Web, Worker) consumes the framework. Every file <100 lines. Every package has one responsibility.

**Tech Stack:** TypeScript, Cloudflare Workers, Agents SDK, Dynamic Workers, Sandbox SDK, AI Gateway, D1, R2, KV, Vectorize, Queues, Workflows, Browser Rendering, React Ink (CLI), React + Vite (Web)

**License:** MIT

---

## 1. Product Vision

### What is construye.lat?

An open-source AI coding agent platform that:

1. **Framework** (`@construye/*`) — Reusable primitives for building AI coding agents on Cloudflare
2. **CLI** (`construye`) — Terminal-based coding agent (like Claude Code but multi-model)
3. **Web** (construye.lat) — Browser-based coding agent with real-time streaming
4. **API** — REST/WebSocket API for integrations

### Core differentiators

1. **Hybrid execution** — 70% ops on Dynamic Workers (<5ms, ~free), 30% on Sandbox containers
2. **Code Mode** — LLM writes TypeScript batching multiple ops, saving 81% tokens
3. **Multi-model with smart routing** — Right model for each sub-task via AI Gateway
4. **Skills standard** — Compatible with Agent Skills (agentskills.io)
5. **Cloud-native** — 0ms cold start, persistent state, session resume, preview URLs
6. **Open source** — MIT licensed framework, hosted product on construye.lat

---

## 2. Architecture Overview

### Layer diagram

```
PRODUCT LAYER (consumes framework)
├── @construye/cli          CLI app (React Ink)
├── @construye/web          Web app (CF Pages + React)
└── @construye/worker       Gateway Worker + Agent DO

FRAMEWORK LAYER (reusable primitives)
├── @construye/core         Agent loop, context engine, model router
├── @construye/tools        Tool registry + implementations
├── @construye/providers    AI model provider abstractions
├── @construye/skills       Skills engine (discovery, loading, execution)
├── @construye/storage      R2, D1, KV, Vectorize abstractions
└── @construye/sandbox      Sandbox SDK + Dynamic Workers integration

FOUNDATION
└── @construye/shared       Types, constants, errors, utilities
```

### Data flow

```
User input → Gateway Worker → Auth → Agent DO → Context Assembly
  → Model Router → AI Gateway → LLM → Tool Calls
  → Tool Router → Fast Path (Dynamic Worker) OR Heavy Path (Sandbox)
  → Results → Context Update → Compaction Check → Stream to User
```

---

## 3. Package Specifications

### 3.1 @construye/shared

Shared types, constants, errors, and utilities used by all packages.

**Exports:**
- `Message` — Conversation message type (role, content, tool_calls, tool_results)
- `ToolDefinition` — Tool schema (name, description, parameters, execution_layer)
- `ToolCall` — A tool invocation from the LLM
- `ToolResult` — Result of executing a tool
- `Session` — Session state (id, messages, project, config)
- `Project` — Project metadata (name, type, dependencies, structure)
- `Skill` — Skill metadata (name, description, path, tier)
- `ModelConfig` — Model configuration (provider, model, temperature, max_tokens)
- `ExecutionLayer` — Enum: DYNAMIC_WORKER | SANDBOX | BROWSER
- `AgentMode` — Enum: PLAN | INTERACTIVE | AUTO
- `ConstruyeError` — Base error class with error codes
- `TokenCounter` — Estimate token counts for strings
- `constants` — Max tokens, default models, version, limits

**Files:** types.ts, constants.ts, errors.ts, token-counter.ts, index.ts

### 3.2 @construye/core

The brain. Agent loop, context management, and model routing.

**Modules:**

#### agent-loop
The main execution loop. Deliberately simple (inspired by Claude Code).
- Receives user message
- Assembles context (project, history, RAG results, skills)
- Calls LLM via provider
- Executes tool calls via tool router
- Checks compaction threshold
- Streams results to caller
- Repeats until no more tool calls or max turns reached

#### context-engine
Manages what goes into the LLM context window.
- Loads CONSTRUYE.md (project identity)
- Loads tool stubs (lazy, ~500 tokens total)
- Loads active skill SKILL.md
- Includes conversation history (compacted if needed)
- Includes RAG results for relevant code
- Manages token budget (tracks usage per section)
- Deduplicates file reads (content hash)
- Persists large outputs to R2 (>50K chars → summary + reference)

#### compaction
Compresses conversation history when context exceeds 80%.
- Uses cheap model (Workers AI — Llama 4 Scout) for summarization
- Preserves: system prompt, tools, active skill, last 3 turns, active files
- Compacts: older turns → summary paragraph
- Triggered automatically, can be forced via /compact

#### model-router
Selects the optimal model for each sub-task.
- Classifies task type: reasoning, coding, file_ops, planning, embedding
- Maps to model tier: expensive (Opus/GPT-5), medium (Sonnet/GPT-5.3), cheap (Workers AI)
- Handles fallbacks when primary unavailable
- Tracks cost per model selection
- Configurable via CONSTRUYE.md or CLI flags

#### session-manager
Manages session lifecycle.
- Creates/loads sessions from DO storage
- JSONL persistence for session history
- Resume: load previous session and continue
- Fork: create new session from current state
- Export: dump session as markdown

**Files:** agent-loop.ts, context-engine.ts, compaction.ts, model-router.ts, session-manager.ts, types.ts, index.ts

### 3.3 @construye/tools

Tool registry and implementations. Every tool is a separate file.

**Registry:**
- Lazy loading: tools registered with stub (name + description, ~30 tokens each)
- Full schema loaded only when LLM selects the tool
- Tool search: LLM can search tools by keyword

**Tool Router:**
- Classifies each tool call into execution layer (fast/heavy/browser)
- Routes to appropriate executor
- Manages approval gates (configurable per tool)

**Built-in tools (12):**

| Tool | Layer | Description |
|---|---|---|
| `read_file` | FAST | Read file contents with line range |
| `write_file` | FAST | Create or overwrite a file |
| `edit_file` | FAST | Apply surgical edit (old_string → new_string) |
| `search_text` | FAST | Grep-style regex search across files |
| `search_semantic` | FAST | Semantic search via Vectorize |
| `list_dir` | FAST | List directory tree |
| `glob` | FAST | Find files matching glob pattern |
| `code_mode` | FAST | Execute TypeScript that batches multiple file ops |
| `exec` | HEAVY | Execute shell command in sandbox |
| `git` | HEAVY | Git operations (clone, commit, push, diff) |
| `preview` | HEAVY | Start dev server, expose preview URL |
| `browse` | BROWSER | Fetch/screenshot web page via Playwright |
| `ask_user` | NONE | Ask user a clarifying question |
| `delegate` | NONE | Spawn sub-agent for parallel sub-task |

**Files:** registry.ts, router.ts, approval.ts, types.ts, tools/read-file.ts, tools/write-file.ts, tools/edit-file.ts, tools/search-text.ts, tools/search-semantic.ts, tools/list-dir.ts, tools/glob.ts, tools/code-mode.ts, tools/exec.ts, tools/git.ts, tools/preview.ts, tools/browse.ts, tools/ask-user.ts, tools/delegate.ts, index.ts

### 3.4 @construye/providers

AI model provider abstractions. Unified interface for any LLM.

**Interface:**
```typescript
interface Provider {
  chat(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk>
  embed(texts: string[]): Promise<number[][]>
  countTokens(text: string): number
}
```

**Providers:**
- `ai-gateway` — Cloudflare AI Gateway (proxy to any provider with caching, rate limiting)
- `claude` — Direct Anthropic API (for BYOK)
- `openai` — Direct OpenAI API (for BYOK)
- `workers-ai` — Cloudflare Workers AI (embedded models)
- `custom` — User-defined provider (any OpenAI-compatible endpoint)

**Features:**
- Response streaming (AsyncIterable)
- Automatic retries with exponential backoff
- Cost tracking per request
- Cache integration (AI Gateway or local)
- Fallback chains (primary → secondary → tertiary)

**Files:** interface.ts, ai-gateway.ts, claude.ts, openai.ts, workers-ai.ts, custom.ts, cost-tracker.ts, retry.ts, index.ts

### 3.5 @construye/skills

Skills engine. Discovery, loading, and execution of Agent Skills.

**Three-tier progressive disclosure:**
1. **Discovery** — name + description always in context (~30-50 tokens/skill)
2. **Activation** — full SKILL.md loaded when task matches (~500-2000 tokens)
3. **Execution** — reference files loaded on-demand during execution

**Skill format (Agent Skills standard):**
```
skills/
└── my-skill/
    ├── SKILL.md           # Instructions + frontmatter
    ├── references/        # Reference files (loaded on-demand)
    └── scripts/           # Executable scripts
```

**Registry operations:**
- `list()` — Return all skills at discovery tier
- `match(task)` — Find skills relevant to a task description
- `activate(name)` — Load SKILL.md into context
- `loadReference(skill, path)` — Load reference file on-demand
- `install(source)` — Install skill from registry/GitHub/local
- `create(name)` — Scaffold new skill

**Files:** registry.ts, loader.ts, matcher.ts, installer.ts, types.ts, index.ts

### 3.6 @construye/storage

Cloudflare storage service abstractions.

**Services:**
- `FileStore` (R2) — Project files, snapshots, large outputs
- `Database` (D1) — Users, projects, sessions, usage, billing
- `Cache` (KV) — API keys, tokens, feature flags, hot config
- `VectorStore` (Vectorize) — Codebase embeddings for semantic search
- `Queue` (Queues) — Async events: analytics, webhooks, indexing jobs

**Files:** file-store.ts, database.ts, cache.ts, vector-store.ts, queue.ts, types.ts, index.ts

### 3.7 @construye/sandbox

Execution environments for running code and commands.

**Two execution layers:**

#### Dynamic Worker (Fast Path)
- V8 isolate via Worker Loader API
- Network blocked (isolation)
- File operations via @cloudflare/shell
- Code Mode via @cloudflare/codemode
- Startup: <5ms, cost: ~$0.000001
- Used for: read, write, edit, search, glob, list, code_mode

#### Container Sandbox (Heavy Path)
- Full Linux container via Sandbox SDK
- Network allowed (configurable)
- Real filesystem, real shell
- Git, npm, build tools, dev servers
- Startup: ~100ms, cost: ~$0.0005/call
- Used for: exec, git, test, build, install, preview
- Port exposure for preview URLs
- Warm pool for frequent projects

**Files:** manager.ts, dynamic-worker.ts, container.ts, code-mode-runtime.ts, types.ts, index.ts

### 3.8 @construye/worker

Cloudflare Worker that hosts the agent. Gateway + Durable Object.

**Gateway Worker:**
- HTTP/WebSocket entry point
- GitHub OAuth authentication
- JWT session tokens
- Rate limiting (KV-backed)
- Route to Agent Durable Object

**ConstruyeAgent (Durable Object):**
- Extends `Agent` from Agents SDK
- WebSocket connection management
- State synchronization with clients
- Instantiates @construye/core agent loop
- Persists sessions to DO storage
- Handles scheduling (cron, background tasks)

**Files:** index.ts, agent.ts, auth.ts, rate-limit.ts, types.ts

### 3.9 @construye/cli

Terminal-based coding agent. React Ink for rich TUI.

**Commands:**
- `construye` — Interactive session (default)
- `construye "prompt"` — One-shot execution
- `construye init` — Create CONSTRUYE.md in current project
- `construye login` — GitHub OAuth login
- `construye skills` — Manage skills (list, add, remove)
- `construye config` — View/edit configuration
- `construye sessions` — List/resume/fork sessions

**Flags:**
- `--model <name>` — Select model
- `--plan` — Plan-only mode (no writes)
- `--auto` — Full autonomy mode
- `--cloud` — Execute on Cloudflare (not local)
- `--local` — Execute locally with BYOK
- `--bare` — Minimal mode (no skills, MCP, hooks)

**Slash commands (in session):**
- `/compact` — Force context compaction
- `/plan` — Switch to plan mode
- `/build` — Switch to build mode
- `/model` — Change model
- `/diff` — Show git diff
- `/cost` — Show token usage and costs
- `/skills` — List/activate skills
- `/resume` — Resume previous session
- `/fork` — Fork current session
- `/status` — Agent status

**Components (React Ink):**
- `App` — Main app shell
- `Chat` — Message list with streaming
- `StatusBar` — Model, tokens, cost, mode
- `PlanView` — Step-by-step plan display
- `DiffView` — Git diff with syntax highlighting
- `Prompt` — User input with history
- `Spinner` — Loading states
- `ToolOutput` — Tool execution output display

**Files:** index.ts (entry), app.tsx, components/chat.tsx, components/status-bar.tsx, components/plan-view.tsx, components/diff-view.tsx, components/prompt.tsx, components/spinner.tsx, components/tool-output.tsx, commands/init.ts, commands/login.ts, commands/skills.ts, commands/config.ts, commands/sessions.ts, hooks/use-agent.ts, hooks/use-session.ts, types.ts

### 3.10 @construye/web

Web application on Cloudflare Pages.

**Pages:**
- `/` — Landing page
- `/app` — Main agent interface (chat + file viewer + terminal)
- `/login` — GitHub OAuth
- `/settings` — User settings, API keys, plan
- `/sessions` — Session history

**Components:**
- `ChatPanel` — Message list with streaming
- `FileViewer` — Code viewer with syntax highlighting
- `TerminalOutput` — Shell output display
- `PreviewFrame` — iframe for preview URLs
- `PlanTimeline` — Visual plan with progress
- `ModelSelector` — Switch models mid-session
- `CostIndicator` — Real-time cost tracking

**Tech:** React + Vite + TailwindCSS, deployed on CF Pages

**Files:** Standard Vite+React structure with components <100 lines each

---

## 4. Token Optimization Techniques

### 4.1 Auto-compaction

- Trigger: context usage > 80% of model's max tokens
- Compactor: cheap model (Llama 4 Scout via Workers AI)
- Prompt: "Summarize these conversation turns, preserving: decisions made, files changed, error patterns, current state"
- Preserve: system prompt, tool stubs, active skill, last 3 turns, active file references
- Result: typically frees 60-75% of context

### 4.2 Tool lazy loading

- Always in context: tool stubs (name + 1-line description) ~500 tokens total
- On-demand: full JSON schema loaded only when LLM selects a tool
- Savings: ~95% vs loading all 14 tool schemas

### 4.3 Code Mode

- Instead of N sequential tool calls (each adding schema + result to context)
- LLM writes 1 TypeScript function that chains multiple operations
- Executed in isolated Dynamic Worker
- Only the return value enters the context
- Savings: ~81% token overhead for multi-file operations

### 4.4 Large output persistence

- Tool results >50K characters stored to R2
- Summary injected into context with retrieval reference
- LLM can request full content if needed
- Savings: 30-50% for large codebases

### 4.5 Read deduplication

- Track content hashes of previously read files
- If file unchanged since last read: return `[unchanged]` marker
- Savings: 10-20% in iterative sessions

### 4.6 Smart model routing

- Reasoning tasks → expensive model (Claude Opus, GPT-5)
- Coding tasks → mid-tier model (Codex Spark, Qwen Coder)
- File ops → cheap model (Workers AI Llama 4 Scout)
- Embeddings → Workers AI (free tier)
- Compaction → Workers AI (cheapest available)
- Savings: 40-60% cost reduction

### 4.7 AI Gateway caching

- Identical/similar prompts served from cache
- 30-40% hit rate on coding tasks (boilerplate, patterns)
- Configurable TTL per endpoint

### 4.8 Skills progressive disclosure

- Tier 1: name + description (~30-50 tokens/skill) — always loaded
- Tier 2: full SKILL.md (~500-2000 tokens) — loaded on activation
- Tier 3: reference files (variable) — loaded on-demand during execution
- Savings: 95-98% vs loading all skills

### 4.9 RAG repo indexing

- Vectorize indexes codebase per project
- Semantic search returns only relevant fragments
- Savings: 70-80% vs loading entire files

---

## 5. Security Model

### Sandbox isolation
- Dynamic Workers: network blocked by default (globalOutbound: null)
- Container Sandbox: configurable network policy
- No access to host filesystem
- No access to other users' data
- Resource limits (CPU, memory, time)

### Authentication
- GitHub OAuth for login
- JWT session tokens (short-lived, KV-backed)
- BYOK: API keys encrypted at rest in KV

### AI safety
- AI Gateway Guardrails: content moderation
- AI Gateway DLP: prevent secret/PII leakage
- Prompt injection detection
- Cost budgets per session/user

### Approval gates
- Configurable per tool and mode
- Default (interactive): approve writes, exec, git push
- Auto mode: approve only irreversible ops (git push, delete)
- Plan mode: no writes allowed

---

## 6. CONSTRUYE.md Format

Project identity file. Loaded into context at session start.

```markdown
# CONSTRUYE.md

## Project
name: my-app
type: Next.js 15 + TypeScript
node: 22
package_manager: pnpm

## Conventions
- App Router (src/app/)
- Server Components by default
- Prisma for DB
- Vitest for testing

## Architecture
- src/lib/ — shared utilities
- src/app/api/ — API routes
- src/components/ — React components

## Rules
- Never modify .env files
- Always run tests after changes
- Max file size: 300 lines

## Skills
- @typescript-strict
- @nextjs-app-router
- @testing-vitest
```

---

## 7. Database Schema (D1)

### users
- id TEXT PRIMARY KEY
- github_id TEXT UNIQUE
- github_username TEXT
- email TEXT
- plan TEXT DEFAULT 'free'
- api_keys_encrypted TEXT
- created_at TEXT
- updated_at TEXT

### projects
- id TEXT PRIMARY KEY
- user_id TEXT REFERENCES users(id)
- name TEXT
- repo_url TEXT
- r2_prefix TEXT
- vectorize_index TEXT
- config TEXT (JSON — CONSTRUYE.md parsed)
- created_at TEXT
- updated_at TEXT

### sessions
- id TEXT PRIMARY KEY
- project_id TEXT REFERENCES projects(id)
- user_id TEXT REFERENCES users(id)
- status TEXT (active, paused, completed)
- model TEXT
- mode TEXT (plan, interactive, auto)
- total_tokens INTEGER DEFAULT 0
- total_cost_cents INTEGER DEFAULT 0
- started_at TEXT
- ended_at TEXT

### usage
- id TEXT PRIMARY KEY
- user_id TEXT REFERENCES users(id)
- session_id TEXT REFERENCES sessions(id)
- provider TEXT
- model TEXT
- input_tokens INTEGER
- output_tokens INTEGER
- cost_cents INTEGER
- cached BOOLEAN
- created_at TEXT

---

## 8. Monorepo Structure

```
construye/
├── .construye.md                 # This project's identity
├── .agents/                      # Agent configuration
│   ├── AGENTS.md                 # Instructions for AI agents working on this
│   └── skills/                   # Project-specific skills
├── docs/
│   └── superpowers/
│       ├── specs/                # Design specs
│       └── plans/                # Implementation plans
├── packages/
│   ├── shared/                   # @construye/shared
│   ├── core/                     # @construye/core
│   ├── tools/                    # @construye/tools
│   ├── providers/                # @construye/providers
│   ├── skills/                   # @construye/skills
│   ├── storage/                  # @construye/storage
│   ├── sandbox/                  # @construye/sandbox
│   ├── worker/                   # @construye/worker
│   ├── cli/                      # @construye/cli
│   └── web/                      # @construye/web
├── skills/                       # Built-in skills library
│   ├── typescript-strict/
│   ├── nextjs-app-router/
│   ├── testing-vitest/
│   └── ...
├── package.json                  # Monorepo root
├── pnpm-workspace.yaml           # PNPM workspaces
├── turbo.json                    # Turborepo config
├── tsconfig.base.json            # Base TypeScript config
├── biome.json                    # Linter + formatter
└── .github/
    └── workflows/
        └── ci.yml                # CI pipeline
```

---

## 9. Development Principles

1. **Every file < 100 lines** — If it's longer, split it
2. **One export per file** — One function, one class, one type per file
3. **Barrel exports** — Each package has index.ts re-exporting public API
4. **Interface-first** — Define interfaces before implementations
5. **Dependency injection** — No imports of concrete implementations across packages
6. **Test alongside** — Tests live next to source: `foo.ts` → `foo.test.ts`
7. **No shared mutable state** — Pure functions, immutable data
8. **Error boundaries** — Only validate at system boundaries (API, user input)
9. **Progressive enhancement** — Core works standalone, extras are optional

---

## 10. MVP Scope

### In scope (v0.1)
- CLI with interactive chat
- Agent loop with 12 tools
- Hybrid execution (Dynamic Workers + Sandbox)
- Code Mode
- Multi-model via AI Gateway (Claude, GPT, Workers AI)
- Smart model routing
- Auto-compaction
- Tool lazy loading
- Skills engine with 3-tier loading
- CONSTRUYE.md project identity
- Session persistence + resume
- BYOK mode (--local)
- GitHub OAuth
- Basic web app (chat + streaming)
- RAG indexing via Vectorize
- Cost tracking

### Out of scope (future)
- Sub-agents / parallel agents (v0.2)
- IDE extensions (v0.3)
- Proactive agents / cron (v0.3)
- Team features (v0.4)
- Self-hosted deploy (v0.5)
- Voice interface (v1.0)
- Billing/payments (after beta)
