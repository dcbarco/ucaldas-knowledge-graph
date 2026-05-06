// Paso 2 — Generación de embedding                           [50%]
// Producción: envía el texto (truncado a 8000 chars) a GitHub Models
// text-embedding-3-small → vector[1536] → papers.embedding

import { log, mockDB } from '../lib/logger'
import type { ProgressUpdater } from '../lib/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const MAX_CHARS = parseInt(process.env.MAX_TEXT_CHARS_FOR_EMBEDDING ?? '8000')

export async function generateEmbedding(
  paperId: string,
  fullText: string,
  update: ProgressUpdater
): Promise<number[]> {
  await update(45, 'Generando embedding con GitHub Models')

  const truncated = fullText.slice(0, MAX_CHARS)
  log(paperId, `Enviando ${truncated.length} chars a text-embedding-3-small`)

  // PRODUCCIÓN:
  // const client = new OpenAI({
  //   baseURL: process.env.GITHUB_MODELS_BASE_URL,
  //   apiKey: process.env.GITHUB_TOKEN,
  // })
  // const res = await client.embeddings.create({
  //   model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  //   input: truncated,
  // })
  // const embedding = res.data[0].embedding  // number[1536]
  mockDB(paperId, `githubModels.embeddings.create({ model: 'text-embedding-3-small', input: '${truncated.slice(0, 30)}...' })`)
  await delay(800) // simula latencia de la API

  // Mock: vector de 1536 dimensiones con valores aleatorios normalizados
  const mockEmbedding = Array.from({ length: 1536 }, () => (Math.random() * 2 - 1) * 0.1)

  await update(50, 'Embedding generado — persistiendo en papers')
  log(paperId, `Embedding generado: vector[${mockEmbedding.length}]`)

  // PRODUCCIÓN:
  // await supabase.from('papers').update({ embedding: `[${embedding.join(',')}]` }).eq('id', paperId)
  mockDB(paperId, `papers.update({ embedding: '[${mockEmbedding.slice(0, 3).map(n => n.toFixed(4)).join(',')},...] }).eq('id', '${paperId}')`)

  return mockEmbedding
}
