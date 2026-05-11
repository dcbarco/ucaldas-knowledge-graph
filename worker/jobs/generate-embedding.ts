// Paso 2 — Generación de embedding  [50%]
import OpenAI from 'openai'
import { supabase } from '../lib/supabase'
import { log } from '../lib/logger'
import type { ProgressUpdater } from '../lib/types'

const MAX_CHARS = 8000

export async function generateEmbedding(
  paperId: string,
  fullText: string,
  update: ProgressUpdater
): Promise<number[]> {
  await update(45, 'Generando embedding con GitHub Models')

  const truncated = fullText.slice(0, MAX_CHARS)
  log(paperId, `Enviando ${truncated.length} chars a text-embedding-3-small`)

  const client = new OpenAI({
    baseURL: process.env.GITHUB_MODELS_BASE_URL ?? 'https://models.inference.ai.azure.com',
    apiKey:  process.env.GITHUB_TOKEN ?? '',
  })

  const res = await client.embeddings.create({
    model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    input: truncated,
  })
  const embedding = res.data[0].embedding

  await supabase
    .from('papers')
    .update({ embedding: `[${embedding.join(',')}]` })
    .eq('id', paperId)

  log(paperId, `Embedding generado: vector[${embedding.length}]`)
  return embedding
}
