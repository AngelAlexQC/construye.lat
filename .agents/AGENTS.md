# Instrucciones para Agentes IA

## Sobre este proyecto
construye.lat es un framework de agentes de código IA que corre en Cloudflare.
Monorepo TypeScript con 10 paquetes bajo `packages/`.

## Estructura de paquetes
```
packages/
  shared/    → Tipos, constantes, utilidades (sin deps externas)
  core/      → Agent loop, compaction, model router, session manager
  tools/     → 14 tool handlers + registry + router + approval
  providers/ → AI Gateway, Claude, OpenAI, Workers AI, cost tracker
  skills/    → Registry, loader, matcher, installer
  storage/   → R2, D1, KV, Vectorize, Queues wrappers
  sandbox/   → Dynamic Worker + Container execution
  worker/    → Cloudflare Worker gateway + ConstruyeAgent DO
  cli/       → React Ink terminal app
  web/       → React + Vite web dashboard
```

## Reglas de código
1. Archivos < 100 líneas. Si crece, dividir.
2. Un archivo = una responsabilidad clara
3. Tipos e interfaces en `types.ts` de cada paquete
4. Implementaciones en archivos separados
5. Barrel exports en `index.ts`
6. No añadir dependencias sin justificación
7. TypeScript estricto: no `any`, no `as` innecesarios
8. Tests junto al código: `archivo.test.ts`

## Flujo de dependencias
```
shared → core → tools → providers → skills → storage → sandbox → worker
                                                                    ↓
                                                              cli / web
```

## Cómo contribuir
1. Leer CONSTRUYE.md para contexto del proyecto
2. Leer el spec en docs/superpowers/specs/
3. Cada PR debe tocar UN paquete o tema
4. Tests obligatorios para lógica nueva
5. `pnpm turbo typecheck` debe pasar antes de commit
