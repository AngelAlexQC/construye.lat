# construye.lat — Product Architecture: The Unified Agent Platform

> Date: July 2026
> Status: DESIGN — Awaiting approval before implementation
> Author: AI Architect + User

---

## 1. The Insight Nobody Acts On

Every AI coding tool today is trapped in **one surface**:

| Tool | Surface | Limitation |
|---|---|---|
| Claude Code | Terminal | Can't check progress from your phone. Can't share with your PM. |
| Cursor | IDE | Tied to VS Code. Can't run headless in CI. |
| Copilot | IDE | Autocomplete, not autonomous agent. |
| Devin | Web | $500/mo. Can't use offline. No terminal power. |
| ChatGPT | Browser | Stateless. Forgets everything. No tool execution. |

**The gap**: No product lets you start a task in your terminal, check its progress from your phone during lunch, and have your team lead review the results on a web dashboard — all on the same live session.

This is what enterprises actually need. Not another chatbot. Not another IDE plugin. **A unified agent platform where sessions are universal and surfaces are interchangeable.**

---

## 2. The Moat: Why This Wins

### 2.1 Universal Sessions (the killer feature)

```
┌─────────────────────────────────────────────────┐
│              Durable Object (Session)             │
│                                                   │
│  State: messages[], tools[], cost, permissions    │
│  Protocol: WebSocket + SSE + REST                 │
│  Storage: D1 (structured) + R2 (files)            │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ CLI (Ink) │  │ Web (React)│ │ Mobile   │       │
│  │ terminal  │  │ dashboard │  │ PWA      │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │
│       └──────── WebSocket ─────────┘              │
└─────────────────────────────────────────────────┘
```

- One session, any device. Real-time sync.
- CLI user types a command → web dashboard shows it live.
- Phone user approves a tool call → CLI continues executing.
- AI response streams to ALL connected surfaces simultaneously.
- Session persists even if all clients disconnect (Durable Object stays alive).

### 2.2 91% Cheaper (enterprises care about money)

| Metric | construye.lat | Claude Code |
|---|---|---|
| Cost per session | $0.038 | $0.452 |
| Cost per day (50 sessions) | $1.90 | $22.63 |
| Cost per dev/month | ~$57 | ~$679 |
| **Savings** | **91.6%** | baseline |

Workers AI = flat pricing. No per-token surprise bills. Smart model routing = right model for each sub-task. Code Mode = 99% token reduction for batch operations.

### 2.3 Agent Teams via Sub-Agents (already in plan)

Not one agent — a coordinated team:
- **Planner**: Breaks task into sub-tasks (reasoning model: QwQ-32B)
- **Coder**: Implements code changes (heavy model: Kimi K2.5)
- **Tester**: Writes and runs tests (fast model: Qwen3-Coder)
- **Reviewer**: Validates changes, checks for regressions (reasoning model)
- **Orchestrator**: Coordinates, handles failures, aggregates results

Each sub-agent runs in its own V8 isolate (Dynamic Workers). Users see all agents working in parallel.

### 2.4 Enterprise Governance (not an afterthought)

Research shows 40% of agentic AI projects fail due to inadequate risk controls. We build governance IN:

- **Audit Trail**: Every agent action logged — who, what, when, why, cost.
- **Permission Tiers**: What tools, what repos, what models, what spend limits.
- **Cost Dashboards**: Real-time spend per user, per team, per project.
- **Budget Alerts**: Agent stops when approaching spend limit. No surprise bills.
- **Team Visibility**: Manager sees all sessions. Can review, replay, comment.
- **Compliance Path**: Action logs exportable for SOC 2 / ISO 27001 audits.

---

## 3. Product Architecture

```
┌─────────────────── SURFACES ───────────────────────┐
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  ┌───────┐ │
│  │ CLI (Ink) │  │ Web (SPA)│  │ PWA   │  │  API  │ │
│  │ Terminal  │  │ Dashboard│  │ Mobile │  │ CI/CD │ │
│  └────┬─────┘  └────┬─────┘  └───┬───┘  └───┬───┘ │
│       └────────┬─────┴────────────┴──────────┘      │
│                │                                     │
│        ┌───────▼────────┐                           │
│        │ Session Protocol│  WebSocket/SSE/REST       │
│        └───────┬────────┘                           │
│                │                                     │
├─────────────── │ EDGE (Cloudflare) ─────────────────┤
│                │                                     │
│  ┌─────────────▼───────────────────────────────┐    │
│  │       Worker (API Gateway + Auth)            │    │
│  │  Rate limiting · JWT · GitHub OAuth          │    │
│  └─────────────┬───────────────────────────────┘    │
│                │                                     │
│  ┌─────────────▼───────────────────────────────┐    │
│  │     Durable Object (Session Engine)          │    │
│  │  Agent Loop · State · WebSocket Hub          │    │
│  │  MCP Client + Server · Agent Teams           │    │
│  └───────┬─────────┬──────────┬────────────────┘    │
│          │         │          │                      │
│  ┌───────▼──┐ ┌────▼────┐ ┌──▼──────────┐          │
│  │ AI Gate  │ │ Storage │ │ Sandbox      │          │
│  │ Workers  │ │ D1/R2/  │ │ Dyn Workers  │          │
│  │ AI +     │ │ KV/     │ │ + Containers │          │
│  │ Claude/  │ │ Vectorize│ │              │          │
│  │ OpenAI   │ │ Queues  │ │              │          │
│  └──────────┘ └─────────┘ └──────────────┘          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.1 Local-First, Cloud-Enhanced

The CLI works **100% offline** with local models or API keys. Cloud features (sync, teams, governance) are opt-in.

| Mode | Requirements | Features |
|---|---|---|
| **Local** | `construye` (just run it) | Full agent, local sessions, your API keys |
| **Cloud** | `construye login` | Session sync, web dashboard, team features |
| **Enterprise** | Self-hosted Worker | On-prem, custom models, full governance |

This is critical: developers adopt locally first. Enterprises pay for the cloud layer. Same product, different value props.

### 3.2 Session Protocol

All surfaces communicate via a unified Session Protocol:

```typescript
// Every surface sends:
type ClientMessage =
  | { type: "user_message"; content: string }
  | { type: "tool_approval"; tool_call_id: string; approved: boolean }
  | { type: "abort" }
  | { type: "command"; name: string; args?: Record<string, unknown> }

// Session broadcasts to all connected surfaces:
type ServerMessage =
  | { type: "stream_chunk"; chunk: StreamChunk }
  | { type: "tool_call"; tool_call: ToolCall }
  | { type: "tool_result"; result: ToolResult }
  | { type: "turn_complete"; usage: TokenUsage; cost: number }
  | { type: "agent_status"; status: "thinking" | "coding" | "testing" | "reviewing" }
  | { type: "error"; error: string }
  | { type: "session_state"; state: SessionSnapshot }
```

---

## 4. CLI Architecture (Flagship Surface)

The CLI is the **reference implementation** of a construye.lat surface. It must be the best terminal experience any developer has ever had.

### 4.1 Technology: Full Ink + React Migration

**Current state**: readline + console.log (disconnected from existing Ink components).
**Target state**: Full Ink v5 + React 19 app with the unused components activated and expanded.

The existing components (header.tsx, message.tsx, status-bar.tsx, tool-call.tsx) become the foundation. The readline REPL becomes an Ink `<TextInput>` with full React state management.

### 4.2 Component Architecture

```
<App>                          ← Full-screen Ink app
├── <SessionView>              ← Scrollable message history
│   ├── <UserMessage />        ← User input with timestamp
│   ├── <AgentResponse>        ← Agent output (streaming)
│   │   ├── <ThinkingIndicator /> ← Visible reasoning phase
│   │   ├── <StreamingText />  ← Token-by-token markdown
│   │   └── <ToolCallGroup>    ← Grouped tool operations
│   │       ├── <ToolCall />   ← Individual tool (collapsible)
│   │       └── <ToolResult /> ← Output (collapsible)
│   └── <AgentTeamView>        ← Multiple agents working
│       ├── <SubAgentRow />    ← Status of each sub-agent
│       └── <SubAgentRow />
├── <StatusBar>                ← Bottom: model, tokens, cost, session
├── <InputArea>                ← Text input with multiline support
│   ├── <PromptSymbol />       ← Dynamic prompt (mode indicator)
│   └── <TextInput />          ← Ink TextInput with history
└── <CommandPalette />         ← Ctrl+K: fuzzy command search
```

### 4.3 Key Interactions

**Streaming that feels alive:**
```
Token-by-token text rendering via onStream callback.
Each token triggers React state update → Ink re-renders just the delta.
Markdown parsed incrementally (not waiting for full block).
Code blocks syntax-highlighted as they stream.
```

**Tool calls as progressive disclosure:**
```
Default view (1 line):
  ▸ edit_file src/index.ts               2.3s ✓

Expanded view (press Enter or arrow):
  ▾ edit_file src/index.ts               2.3s ✓
    - Line 42: old code
    + Line 42: new code
    typecheck: ✓ 0 errors
```

**Keyboard-first power user flow:**
```
Ctrl+K      Command palette (fuzzy search all commands)
Ctrl+C      Abort current operation (graceful)
Ctrl+L      Clear screen (keep session)
Tab         Cycle through suggestions
↑/↓         Input history
Ctrl+E      Toggle expanded/collapsed tool calls
Ctrl+T      Show token/cost breakdown
Ctrl+S      Toggle sub-agent team view
Esc         Close any overlay
```

**Multi-line input:**
```
Shift+Enter  New line in input
Enter        Send message
Paste detection: auto-enters multi-line mode
```

### 4.4 Visual Identity (Impeccable Principles Applied)

**Color palette** (4 colors only, terminal-safe):

| Role | Color | Hex | Usage |
|---|---|---|---|
| Primary | White | — | Agent text, user input |
| Secondary | Dim (gray) | — | Metadata, timestamps, collapsed items |
| Accent | Cyan | — | Active elements, links, the prompt symbol |
| Signal | Yellow/Red/Green | — | Warnings, errors, success (only when meaningful) |

**The prompt:**
```
› your message here
```
Single character `›` (U+203A). Not `$`, not `>`, not `❯`. Unique but not weird. The prompt symbol is cyan when ready, yellow when thinking/working, green when done. This single character communicates state without any text.

**Thinking/working states:**
```
  Thinking...          ← Pulsing dot animation (200ms interval)
  Reading src/...      ← Active tool description (replaces spinner text)
  ████░░░░ 4/8 tools   ← Progress bar for multi-tool operations
```

**Agent response format:**
```
No header ("Assistant:", "AI:", etc.). The response just appears.
Markdown rendered in-place with proper indentation.
Code blocks with language indicator and copy hint.
Tool calls inline with the response flow, not separate.
```

**Session start:**
```
construye v0.3.0 · kimi-k2.5 · session a7f3
›
```
Three facts. Model, version, session ID (short hash). Nothing else. Speed IS the brand.

### 4.5 Progressive Density

| User Level | What They See |
|---|---|
| **New user** | Clean chat. Prompt. Responses. Tool calls collapsed to 1 line. |
| **Regular user** | Keyboard shortcuts shown as hints. Token counts in status bar. |
| **Power user** | Ctrl+T for detailed breakdown. Ctrl+E for expanded tools. Team view. |
| **Enterprise admin** | Web dashboard for governance. CLI stays for developers. |

No settings panel. No config wizard. The interface reveals itself through interaction.

---

## 5. What Makes This Enterprise-Grade

Based on research (McKinsey, Gartner, Anthropic 2026 Trends Report):

### 5.1 The Problems Enterprises Have TODAY

1. **Unpredictable costs**: "We spent $45K on Claude API last month and nobody knows why."
2. **No visibility**: "My developers use AI tools but I can't see what they're doing."
3. **No governance**: "How do I prove to auditors that AI didn't introduce vulnerabilities?"
4. **Vendor lock-in**: "We're stuck on OpenAI. What if they raise prices?"
5. **Pilot → Production gap**: "We tried 5 AI tools. None scaled past 10 users."

### 5.2 How construye.lat Solves Each One

| Problem | Solution | Implementation |
|---|---|---|
| Unpredictable costs | **Flat pricing + budget controls** | Workers AI flat rate. Per-user/project spend limits. Real-time dashboard. |
| No visibility | **Universal sessions** | Every session viewable by admins. Activity feeds. Usage reports. |
| No governance | **Built-in audit trail** | Every action logged. Exportable. Permission tiers. Tool restrictions per team. |
| Vendor lock-in | **Multi-model + open source** | Workers AI (Kimi, QwQ, Qwen) + Claude + OpenAI. Model routing abstracted. |
| Pilot gap | **Local-first + cloud-enhanced** | Works on day 1 locally. Scale to cloud when ready. No migration required. |

### 5.3 Pricing Strategy

| Tier | Price | Target | Key Feature |
|---|---|---|---|
| **Open Source** | Free | Individual devs | Full CLI agent, local-only, BYOK |
| **Pro** | $19/mo | Pro devs, founders | Cloud sync, web dashboard, session history |
| **Team** | $49/seat/mo | Small teams | Shared sessions, team visibility, budget alerts |
| **Enterprise** | Custom | Large orgs | Self-hosted, SSO, audit export, SLA, compliance |

The open source tier competes with Claude Code, Gemini CLI, Codex CLI — all free.
The Pro tier competes with Cursor ($20/mo) — similar price, more surfaces.
The Team/Enterprise tier competes with Devin ($500/mo) — much cheaper, more transparent.

---

## 6. Implementation Priority (CLI First)

The CLI is the first thing to build because:
1. It's where developers are. It's the adoption vector.
2. It validates the session protocol that all other surfaces will use.
3. It's open source — community builds trust.
4. Everything else (web, mobile, enterprise) layers on top.

### Phase A: Ink Migration (1 week)
Replace readline REPL with Ink + React app. Activate existing components.
Token-by-token streaming. Keyboard shortcuts. Command palette.

### Phase B: Session Protocol (1 week)
WebSocket connection to Durable Object. Real-time sync.
CLI works locally first, connects to cloud if logged in.

### Phase C: Web Dashboard (1 week)
React app consuming same Session Protocol via WebSocket.
View sessions, monitor agents, approve tool calls from browser.

### Phase D: Enterprise Features (ongoing)
Audit trail, permissions, cost dashboards, team management.
Each feature adds value at Team/Enterprise tier.

---

## 7. Competitive Differentiation Summary

| Feature | construye.lat | Claude Code | Cursor | Devin |
|---|---|---|---|---|
| Terminal agent | ✓ | ✓ | ✗ | ✗ |
| Web dashboard | ✓ | ✗ | ✗ | ✓ |
| Mobile access | ✓ (PWA) | ✗ | ✗ | ✓ |
| Multi-device sync | ✓ | ✗ | ✗ | ✗ |
| Multi-model | ✓ | Claude only | Multi | Multi |
| Open source | ✓ | ✓ (new) | ✗ | ✗ |
| Agent teams | ✓ | ✓ (new) | ✗ | ✓ |
| Cost control | Built-in | None | None | None |
| Audit trail | Built-in | None | None | None |
| Self-hostable | ✓ (CF Worker) | ✗ | ✗ | ✗ |
| Code Mode (batch) | ✓ | ✗ | ✗ | ✗ |
| Price (per dev/mo) | $19 | $20-200+API | $20-200 | $500 |

**The unique combination**: Open source + multi-device + enterprise governance + 91% cheaper. Nobody has all four.

---

## 8. Decision Required

Before implementation, confirm:

1. **Scope**: Build the full Ink CLI migration now as Phase A?
2. **Session Protocol**: Design for cloud sync from day 1, even if cloud comes later?
3. **Identity**: Minimal prompt (`›`), no header, content-first approach approved?
4. **Enterprise focus**: Build audit trail and permissions into the data model early?

Awaiting your go/no-go.
