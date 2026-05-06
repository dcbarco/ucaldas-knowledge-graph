import OpenAI from 'openai'
import type { EmbeddingProvider } from '../types'

function getClient() {
  return new OpenAI({
    baseURL: process.env.GITHUB_MODELS_BASE_URL ?? 'https://models.inference.ai.azure.com',
    apiKey: process.env.GITHUB_TOKEN || 'no-key',
  })
}

const MAX_CHARS = parseInt(process.env.MAX_TEXT_CHARS_FOR_EMBEDDING ?? '8000')

// text-embedding-3-small: vector[1536], idéntico al de OpenAI —
// los vectores son directamente comparables en pgvector.
export const githubModels: EmbeddingProvider = {
  async generateEmbedding(text: string): Promise<number[]> {
    const res = await getClient().embeddings.create({
      model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
      input: text.slice(0, MAX_CHARS),
    })
    return res.data[0].embedding
  },
}
