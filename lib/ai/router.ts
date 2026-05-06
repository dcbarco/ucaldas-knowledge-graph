import { APIError } from 'openai'
import { openrouter } from './providers/openrouter'
import { githubModels } from './providers/github-models'
import { cerebras } from './providers/cerebras'
import { groq } from './providers/groq'
import type { TaskType, LLMProvider, EmbeddingProvider } from './types'

// ─── Detección de rate limit ──────────────────────────────────
// El SDK de OpenAI lanza APIError con status 429 para rate limits.
// Algunos proveedores pueden no usar el SDK oficial — cubrimos ambos casos.
function isRateLimitError(err: unknown): boolean {
  if (err instanceof APIError) return err.status === 429
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status === 429
  }
  return false
}

// ─── Prioridad de proveedores por tipo de tarea ───────────────
// El router intenta cada proveedor en orden; si hay rate limit,
// pasa al siguiente. Cualquier otro error se lanza inmediatamente.

type LLMTaskType = Exclude<TaskType, 'embedding'>

const LLM_PRIORITY: Record<LLMTaskType, LLMProvider[]> = {
  // deepseek-r1 es el mejor para razonamiento complejo
  wiki_update:      [openrouter, cerebras],
  // llama-3.3-70b para extracción y relaciones
  extract_concepts: [openrouter, cerebras, groq],
  explain_relation: [openrouter, groq, cerebras],
  wiki_query:       [openrouter, cerebras, groq],
  // groq primero para clasificaciones rápidas (latencia mínima)
  quick_classify:   [groq, openrouter, cerebras],
}

const EMBEDDING_PRIORITY: EmbeddingProvider[] = [githubModels]

// ─── Router LLM ───────────────────────────────────────────────
export async function routeLLM<T>(
  taskType: LLMTaskType,
  fn: (provider: LLMProvider) => Promise<T>
): Promise<T> {
  const providers = LLM_PRIORITY[taskType]
  let lastError: unknown

  for (const provider of providers) {
    try {
      return await fn(provider)
    } catch (err) {
      lastError = err
      if (isRateLimitError(err)) continue // probar el siguiente
      throw err                           // error no recuperable
    }
  }

  throw lastError ?? new Error(`All AI providers exhausted for task: ${taskType}`)
}

// ─── Router Embeddings ────────────────────────────────────────
export async function routeEmbedding(text: string): Promise<number[]> {
  let lastError: unknown

  for (const provider of EMBEDDING_PRIORITY) {
    try {
      return await provider.generateEmbedding(text)
    } catch (err) {
      lastError = err
      if (isRateLimitError(err)) continue
      throw err
    }
  }

  throw lastError ?? new Error('All embedding providers exhausted')
}
