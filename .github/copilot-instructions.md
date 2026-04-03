# construye.lat — Copilot Instructions

## Project Overview

construye.lat is an AI coding agent framework built 100% on Cloudflare. Monorepo managed with pnpm workspaces + Turborepo. 11 packages, TypeScript ESM throughout.

## Tech Stack

- **Runtime:** Node.js 20+ (CLI), Cloudflare Workers (SaaS)
- **Package manager:** pnpm (strict, no hoisting)
- **Build:** Turborepo pipelines
- **Language:** TypeScript (strict mode, ESM only)
- **Test:** Vitest (114 tests, ~950ms)
- **AI Providers:** Anthropic Claude, Cloudflare Workers AI
- **Storage:** D1 (SQL), R2 (files), KV (cache/config), Vectorize (embeddings)
- **CLI UI:** React Ink
- **Worker:** Cloudflare Workers + Durable Objects

## Package Dependency Graph

```
shared (zero deps — types, constants, utils)
  ↑
core (depends on: shared)
  ↑
tools (depends on: shared, core)
  ↑
providers (depends on: shared, core)
  ↑
skills (depends on: shared, core, tools)
  ↑
storage (depends on: shared)
  ↑
sandbox (depends on: shared, core)
  ↑
worker (depends on: shared, core, tools, providers, skills, storage, sandbox)
  ↑
cli (depends on: shared, core, tools, providers)
  ↑
web (depends on: shared — frontend, independent)
  ↑
browser-worker (independent — deployed separately)
```

**Rule:** Never create circular dependencies. `shared` must have zero internal deps. `core` depends only on `shared`.

## Build & Test Commands

```bash
# Install all dependencies
pnpm install

# Build everything (respects Turborepo dependency graph)
pnpm build

# Build a single package
pnpm --filter @construye/core build

# Test everything
pnpm test

# Test a single package
pnpm --filter @construye/tools test

# Test in watch mode
pnpm --filter @construye/core test -- --watch

# Lint
pnpm lint

# Type check
pnpm typecheck

# Dev mode (CLI)
pnpm --filter @construye/cli dev

# Deploy worker
pnpm --filter @construye/worker deploy
```

## Turborepo Pipeline

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "deploy": {
      "dependsOn": ["build", "test"]
    }
  }
}
```

**`^build` means:** Build my dependencies first, then build me.

## Package Details

### `packages/shared`
Types, constants, utilities shared across all packages. Zero internal dependencies.
- Exports: `AgentMessage`, `ToolResult`, `ProviderConfig`, `StorageAdapter` types
- Build: `tsup` → ESM

### `packages/core`
Agent loop, message handling, orchestration logic.
- Exports: `Agent`, `AgentLoop`, `MessageHandler`
- The core agent loop: receive message → select tool → execute → observe → respond
- Build: `tsup` → ESM

### `packages/tools`
20 implemented tools the agent can call.
- Each tool: `name`, `description`, `parameters` (JSON Schema), `execute` function
- Tools: file read/write, search, shell exec, git ops, dependency management, etc.
- Build: `tsup` → ESM

### `packages/providers`
AI model providers — how the agent gets completions.
- `claude.ts`: Anthropic Claude API (streaming)
- `workers-ai.ts`: Cloudflare Workers AI (local models)
- Build: `tsup` → ESM

### `packages/storage`
Cloudflare storage adapters.
- `d1.ts`: SQL queries, migrations, session persistence
- `r2.ts`: File storage (project snapshots, artifacts)
- `kv.ts`: Cache, config, rate limits
- `vectorize.ts`: Embedding storage and similarity search
- Build: `tsup` → ESM

### `packages/worker`
Cloudflare Worker gateway + Durable Object.
- HTTP API endpoints
- Durable Object: one per agent session (stateful)
- **Status:** NOT deployed (D1/KV IDs empty in wrangler.toml)

### `packages/cli`
React Ink terminal UI.
- Interactive coding assistant in the terminal
- Provider selection, streaming responses, tool execution display
- **Status:** Works locally with Claude + Workers AI

### `packages/web`
Web frontend — currently **empty**. Will be landing page + SaaS dashboard.

### `packages/browser-worker`
Standalone worker for browser-based features. **Deployed** at `construye-browser.quirozai.workers.dev`.

## How to Add a New Tool

1. Create the tool file in `packages/tools/src/tools/`:

```typescript
// packages/tools/src/tools/my-tool.ts
import type { Tool, ToolResult } from '@construye/shared';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'What this tool does — be specific, the LLM reads this',
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'The input to process',
      },
    },
    required: ['input'],
  },
  execute: async (params: { input: string }): Promise<ToolResult> => {
    // Implementation here
    return {
      success: true,
      output: `Processed: ${params.input}`,
    };
  },
};
```

2. Register in `packages/tools/src/index.ts`:
```typescript
export { myTool } from './tools/my-tool.js';

// Add to the tools array
export const allTools: Tool[] = [
  // ...existing tools
  myTool,
];
```

3. Add tests in `packages/tools/src/__tests__/my-tool.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { myTool } from '../tools/my-tool.js';

describe('myTool', () => {
  it('should process input correctly', async () => {
    const result = await myTool.execute({ input: 'test' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('test');
  });

  it('should handle empty input', async () => {
    const result = await myTool.execute({ input: '' });
    expect(result.success).toBe(true);
  });
});
```

4. Run: `pnpm --filter @construye/tools test`

## How to Add a New Provider

1. Create the provider in `packages/providers/src/providers/`:

```typescript
// packages/providers/src/providers/my-provider.ts
import type { Provider, ProviderConfig, CompletionRequest, CompletionResponse } from '@construye/shared';

export class MyProvider implements Provider {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Call the AI API
    const response = await fetch(this.config.baseUrl + '/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        tools: request.tools,
      }),
    });

    const data = await response.json();
    return this.parseResponse(data);
  }

  async *stream(request: CompletionRequest): AsyncGenerator<CompletionResponse> {
    // Streaming implementation
  }

  private parseResponse(data: unknown): CompletionResponse {
    // Parse provider-specific response into standard format
  }
}
```

2. Register in `packages/providers/src/index.ts`:
```typescript
export { MyProvider } from './providers/my-provider.js';
```

3. Add to provider factory in core:
```typescript
// packages/core/src/provider-factory.ts
case 'my-provider':
  return new MyProvider(config);
```

4. Add tests and run: `pnpm --filter @construye/providers test`

## TypeScript ESM Rules

- **All imports must include `.js` extension:** `import { foo } from './bar.js'` (NOT `./bar` or `./bar.ts`)
- **package.json:** Every package has `"type": "module"`
- **tsconfig:** `"module": "ESNext"`, `"moduleResolution": "bundler"` or `"NodeNext"`
- **No CommonJS:** No `require()`, no `module.exports`, no `.cjs` files
- **Exports map:** Every package.json has `"exports"` field pointing to `./dist/index.js`

## Common Pitfalls

- **Missing `.js` extension:** ESM requires explicit extensions. TypeScript compiles `.ts` → `.js` but won't add the extension to imports. Always write `.js` in import paths.
- **Circular dependencies:** Turborepo won't catch all cycles. If builds fail mysteriously, check for circular imports between packages.
- **Workers AI types:** Cloudflare's Workers AI SDK types can be incomplete. Use `as any` sparingly and file upstream issues.
- **D1 limitations:** No `ALTER TABLE` support in D1. Migrations must use `CREATE TABLE` + data copy + `DROP TABLE` + rename pattern.
- **pnpm workspace protocol:** Use `"@construye/shared": "workspace:*"` in package.json for internal deps. Never hardcode versions for workspace packages.
- **Vitest + ESM:** If tests fail with import errors, check that `vitest.config.ts` has the correct `resolve` settings.
- **Turborepo cache:** If builds seem stale, run `pnpm turbo build --force` to bypass cache.

## Environment Variables

```bash
# Claude provider
ANTHROPIC_API_KEY=sk-ant-...

# Workers AI (set in wrangler.toml or .dev.vars)
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...

# Storage (auto-bound in Workers, set in wrangler.toml)
# D1: CONSTRUYE_DB
# KV: CONSTRUYE_KV
# R2: CONSTRUYE_STORAGE
# Vectorize: CONSTRUYE_VECTORS
```
