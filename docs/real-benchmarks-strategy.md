# construye.lat — Estrategia de Benchmarks Reales (2026)

## La Verdad: Cómo se Evalúan los Grandes

### Benchmarks que Importan en 2026

| Benchmark | Qué Mide | Estado | Top Score |
|---|---|---|---|
| **SWE-bench Verified** | Resolver issues REALES de GitHub (500 tasks, Python) | Gold Standard | Sonnet 5: 82.1%, Opus 4.6: 80.8% |
| **SWE-bench Pro** | Multi-lenguaje (1,865 tasks, 41 repos, Py/Go/TS/JS) | Nuevo estándar | GPT-5.4: 57.7% |
| **LiveCodeBench** | Problemas frescos de LeetCode/AtCoder/Codeforces | Anti-contaminación | GPT-5.3 Codex: líder |
| **Terminal-Bench 2.0** | CLI, sysadmin, git, CI/CD, DevOps | Agentic | GPT-5.4: 75.1%, Claude: 65.4% |
| **HumanEval** | 164 funciones Python | **SATURADO** (>85% todos) | ~95% |
| **MBPP** | Programación básica Python | **SATURADO** | ~90% |
| **Aider Polyglot** | Edición multi-lenguaje, diffs reales | Práctico | DeepSeek V3.1: 75.6% |
| **BigCodeBench** | Multi-lenguaje avanzado | Complementario | Varía |

### Cómo Evalúa Anthropic a Claude Code

Claude Code se evalúa en **múltiples dimensiones**:
- **SWE-bench Verified**: 80.8% (Opus 4.6) — esto es el **modelo**, no el agente
- **Claude Code como agente**: 72.5% en SWE-bench — score del **sistema completo**
- **Terminal-Bench 2.0**: 65.4% — capacidades CLI/DevOps
- **BrowseComp**: 84.0% — búsqueda web agéntica
- **OSWorld**: 72.7% — uso de computadora

**Dato clave**: Cursor con Sonnet 4.6 obtiene 55-62% en SWE-bench. Claude Code obtiene 72.5%. La diferencia es el **scaffold** (framework agéntico), no el modelo.

### El Insight Más Importante

> "The scaffolding gap is the most underappreciated finding in this data. Three different agent systems ran the same model (Opus 4.5), and their scores ranged from 50.2% to 55.4%. That spread comes entirely from how the agent manages context and tool calls."
> — MorphLLM, SWE-Bench Pro Analysis

**SWE-bench Pro muestra 22+ puntos de diferencia** entre scaffolds usando el MISMO modelo.

**Implicación para construye.lat**: Nuestro valor NO es el modelo (usamos Workers AI, modelos más pequeños). Nuestro valor es el **scaffold**: agent loop, context management, tool execution, compaction.

## Modelos Nuevos Relevantes (2026)

| Modelo | Org | SWE-bench Verified | Nota |
|---|---|---|---|
| **GLM-4.7** | Z.ai (Zhipu) | 73.8% | 355B params, open-weight, SOTA coding open |
| **GLM-5** | Z.ai | ~77.8% | Top open-weight reasoning (Intelligence Index 50) |
| **Qwen3.5-397B** | Alibaba | 65.9% | 256K context, 201 idiomas |
| **Kimi K2.5** | Moonshot AI | 76.8% | 85% LiveCodeBench, Intelligence Index 47 |
| **MiniMax M2.5** | MiniMax | 80.2% | $0.30/$1.20 per M tokens (!)  |
| **Gemini 3.1 Pro** | Google | 80.6% | 2M context, $2/$12 |
| **GPT-5.4** | OpenAI | 57.7% (Pro) | 1M context, native computer use |
| **DeepSeek V3.2** | DeepSeek | 72-74% | $0.28/$0.42 — ultra barato |

**Nota**: El usuario mencionó "Gemma 4 GML" — probablemente se refiere a **GLM** (Z.ai/Zhipu), no Gemma (Google). GLM-4.7 es el que está arrasando en coding benchmarks.

## Plan de Benchmarks para construye.lat

### Nivel 1: HumanEval (Implementar ahora)
- **164 problemas** de generación de funciones Python
- Dataset público: https://github.com/openai/human-eval
- Métrica: Pass@1 (una oportunidad de generar código correcto)
- **Por qué**: Aunque saturado para modelos frontier, nuestros modelos de Workers AI (kimi-k2.5, qwen-32b) probablemente estén en el rango 40-70%, dando margen de diferenciación
- **Implementación**: Descargar JSONL → enviar prompt al agente → extraer código → ejecutar tests Python

### Nivel 2: LiveCodeBench Mini (Próximo)
- Problemas frescos de competitive programming
- Anti-contaminación: problemas post-training-cutoff
- Requiere: descargar problems, implementar judge

### Nivel 3: SWE-bench Lite (Futuro)
- Subconjunto de 300 tasks más representativas
- Requiere: Docker, clonado de repos, git patches, test suites
- Infraestructura pesada pero el benchmark más creíble

### Nivel 4: Terminal-Bench Style (Futuro)
- Tasks de CLI/DevOps propios pero basados en la metodología real
- Git operations, CI debugging, environment management

## Métricas que Debemos Reportar

Para ser creíbles, debemos reportar:
1. **Pass@1**: Resolución en primer intento
2. **Pass@5**: Resolución en 5 intentos
3. **Tokens consumidos**: Eficiencia del scaffold
4. **Tiempo**: Latencia end-to-end
5. **Modelo utilizado**: Transparencia total
6. **Scaffold comparison**: Mismo modelo, con/sin construye.lat

## Realidad Check

construye.lat usa **modelos de Workers AI** (kimi-k2.5 128K, qwen-32b, llama-3.3-70B). Estos NO son Claude Opus 4.6 ni GPT-5.4. La comparación justa es:

1. **Nuestro scaffold + Workers AI** vs **API directa del mismo modelo**
2. **Nuestro scaffold** vs **otros frameworks open-source** (Aider, OpenCode, etc.) con el mismo modelo
3. **Resultados absolutos** en benchmarks estándar para posicionamiento general

El objetivo no es ganarle a Claude Code (que usa Opus 4.6 a $15/$75 por M tokens). Es demostrar que **construye.lat extrae el máximo rendimiento de modelos accesibles y baratos en Cloudflare**.
