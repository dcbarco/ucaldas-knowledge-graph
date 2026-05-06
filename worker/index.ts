// Entry point del worker — servicio Node.js separado (Railway)
// Inicializa BullMQ + Redis y orquesta los 7 pasos del pipeline por paper.

import { Worker, type Job } from 'bullmq'
import Redis from 'ioredis'

import { QUEUE_NAME } from './queues/paper-processing'
import type { PaperJobData, ProgressUpdater } from './lib/types'
import { log, logError } from './lib/logger'

import { extractText }       from './jobs/extract-text'
import { generateEmbedding } from './jobs/generate-embedding'
import { extractConcepts }   from './jobs/extract-concepts'
import { updateWiki }        from './jobs/update-wiki'
import { findRelations }     from './jobs/find-relations'
import { explainRelations }  from './jobs/explain-relations'
import { notify }            from './jobs/notify'

// ─── Conexión Redis ───────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

// maxRetriesPerRequest: null requerido por BullMQ (no debe reintentar queries bloqueantes)
const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

redisConnection.on('connect', () => console.log(`[worker] Redis conectado: ${REDIS_URL}`))
redisConnection.on('error',   (err) => console.error('[worker] Redis error:', err.message))

// ─── Pipeline completo por paper ─────────────────────────────
async function processPaper(job: Job<PaperJobData>): Promise<void> {
  const { paperId, pdfPath, paperTitle = `Paper ${paperId}` } = job.data

  // ProgressUpdater: actualiza progress en BullMQ Y en Supabase processing_jobs
  const update: ProgressUpdater = async (progress: number, step: string) => {
    await job.updateProgress(progress)

    // PRODUCCIÓN:
    // await supabase.from('processing_jobs')
    //   .update({ progress, current_step: step, updated_at: new Date().toISOString() })
    //   .eq('paper_id', paperId)
    console.log(`  [${new Date().toISOString()}] [paper:${paperId}] ⟶  ${step} (${progress}%)`)
  }

  log(paperId, `━━━ INICIO del pipeline para "${paperTitle}"`)

  try {
    // Paso 1 — Extracción de texto                            [10%]
    const fullText = await extractText(paperId, pdfPath, update)

    // Paso 2 — Resumen y conceptos (LLM)                     [30%]
    // Nota: el spec numera el embedding como paso 3, pero el
    // embedding necesita el texto completo (mismo que los conceptos).
    // Los pasos 2 y 3 del spec se ejecutan en paralelo aquí para eficiencia.
    const [concepts, embedding] = await Promise.all([
      extractConcepts(paperId, fullText, async () => {}),  // sub-progress interno
      generateEmbedding(paperId, fullText, async () => {}),
    ])
    // Actualizar el progreso tras ambos completos
    await update(50, 'Conceptos y embedding generados')

    // Paso 4 — Actualización de la wiki                      [65%]
    const wikiResult = await updateWiki(paperId, concepts, update)

    // Paso 5 — Búsqueda de relaciones (pgvector)             [80%]
    const candidateRelations = await findRelations(paperId, embedding, update)

    // Paso 6 — Explicación de relaciones (LLM)               [92%]
    const explainedRelations = await explainRelations(paperId, candidateRelations, update)

    // Paso 7 — Log + Realtime broadcast                      [100%]
    await notify(paperId, paperTitle, wikiResult, explainedRelations, update)

  } catch (err) {
    logError(paperId, 'Pipeline fallido', err)

    // PRODUCCIÓN — marcar job como error en Supabase:
    // await supabase.from('processing_jobs').update({
    //   status: 'error',
    //   error_message: err instanceof Error ? err.message : String(err),
    // }).eq('paper_id', paperId)
    console.log(`  [DB-MOCK] [paper:${paperId}] processing_jobs.update({ status: 'error', error_message: '...' })`)

    throw err // re-lanzar para que BullMQ active el retry automático
  }
}

// ─── BullMQ Worker ────────────────────────────────────────────
const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? '2')

const worker = new Worker<PaperJobData>(
  QUEUE_NAME,
  processPaper,
  {
    connection: redisConnection,
    concurrency,
    // Limita a 20 req/min respetando el rate limit de OpenRouter
    limiter: { max: 20, duration: 60_000 },
  }
)

worker.on('active',    (job) => log(job.data.paperId, `Job ${job.id} activo`))
worker.on('completed', (job) => log(job.data.paperId, `Job ${job.id} completado ✅`))
worker.on('failed',    (job, err) => {
  if (job) logError(job.data.paperId, `Job ${job.id} fallido (intento ${job.attemptsMade})`, err)
})
worker.on('error', (err) => console.error('[worker] Error interno BullMQ:', err.message))

// ─── Arranque ────────────────────────────────────────────────
console.log(`[worker] Knowledge Graph Worker iniciado`)
console.log(`[worker] Cola: "${QUEUE_NAME}" | Concurrencia: ${concurrency}`)
console.log(`[worker] Redis: ${REDIS_URL}`)
console.log(`[worker] Esperando jobs...\n`)

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[worker] ${signal} recibido — cerrando worker...`)
  await worker.close()
  redisConnection.disconnect()
  console.log('[worker] Worker detenido limpiamente')
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))
