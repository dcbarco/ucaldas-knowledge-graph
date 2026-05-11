import { Worker, type Job } from 'bullmq'
import Redis from 'ioredis'

import { QUEUE_NAME } from './queues/paper-processing'
import type { PaperJobData, ProgressUpdater } from './lib/types'
import { log, logError } from './lib/logger'
import { supabase } from './lib/supabase'

import { extractText }       from './jobs/extract-text'
import { generateEmbedding } from './jobs/generate-embedding'
import { extractConcepts }   from './jobs/extract-concepts'
import { updateWiki }        from './jobs/update-wiki'
import { findRelations }     from './jobs/find-relations'
import { explainRelations }  from './jobs/explain-relations'
import { notify }            from './jobs/notify'

// ─── Conexión Redis ───────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

redisConnection.on('connect', () => console.log(`[worker] Redis conectado: ${REDIS_URL}`))
redisConnection.on('error',   (err) => console.error('[worker] Redis error:', err.message))

// Status según el progreso del pipeline
function progressToStatus(p: number): string {
  if (p <= 10) return 'extracting'
  if (p <= 50) return 'embedding'
  if (p <= 65) return 'wiki_update'
  return 'relating'
}

// ─── Pipeline completo por paper ─────────────────────────────
async function processPaper(job: Job<PaperJobData>): Promise<void> {
  const { paperId, pdfPath, paperTitle = `Paper ${paperId}` } = job.data

  const update: ProgressUpdater = async (progress: number, step: string) => {
    await job.updateProgress(progress)
    await supabase
      .from('processing_jobs')
      .update({ progress, current_step: step, status: progressToStatus(progress) })
      .eq('paper_id', paperId)
    console.log(`  [${new Date().toISOString()}] [${paperId.slice(0, 8)}] ${step} (${progress}%)`)
  }

  log(paperId, `━━━ INICIO del pipeline para "${paperTitle}"`)

  try {
    // Paso 1 — Extracción de texto  [10%]
    const fullText = await extractText(paperId, pdfPath, update)

    // Pasos 2 y 3 en paralelo — Embedding + Conceptos  [50%]
    const [concepts, embedding] = await Promise.all([
      extractConcepts(paperId, fullText, async () => {}),
      generateEmbedding(paperId, fullText, async () => {}),
    ])
    await update(50, 'Conceptos y embedding generados')

    // Paso 4 — Actualización de la wiki  [65%]
    const wikiResult = await updateWiki(paperId, concepts, update)

    // Paso 5 — Búsqueda de relaciones  [80%]
    const candidateRelations = await findRelations(paperId, embedding, update)

    // Paso 6 — Explicación de relaciones  [92%]
    const explainedRelations = await explainRelations(paperId, paperTitle, candidateRelations, update)

    // Paso 7 — Log + broadcast  [100%]
    await notify(paperId, paperTitle, wikiResult, explainedRelations, update)

  } catch (err) {
    logError(paperId, 'Pipeline fallido', err)
    await supabase
      .from('processing_jobs')
      .update({
        status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq('paper_id', paperId)
    throw err
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
    limiter: { max: 20, duration: 60_000 },
  }
)

worker.on('active',    (job) => log(job.data.paperId, `Job ${job.id} activo`))
worker.on('completed', (job) => log(job.data.paperId, `Job ${job.id} completado ✅`))
worker.on('failed',    (job, err) => {
  if (job) logError(job.data.paperId, `Job ${job.id} fallido (intento ${job.attemptsMade})`, err)
})
worker.on('error', (err) => console.error('[worker] Error interno BullMQ:', err.message))

console.log(`[worker] Knowledge Graph Worker iniciado`)
console.log(`[worker] Cola: "${QUEUE_NAME}" | Concurrencia: ${concurrency}`)
console.log(`[worker] Redis: ${REDIS_URL}`)
console.log(`[worker] Esperando jobs...\n`)

const shutdown = async (signal: string) => {
  console.log(`\n[worker] ${signal} recibido — cerrando worker...`)
  await worker.close()
  redisConnection.disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))
