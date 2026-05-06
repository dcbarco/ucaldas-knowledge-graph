import { Queue } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import type { PaperJobData } from '../lib/types'

export const QUEUE_NAME = 'paper-processing'

// Crea una instancia de la cola — se llama desde index.ts y desde la
// API Route /api/upload del frontend (para encolar nuevos jobs).
export function createPaperQueue(connection: ConnectionOptions): Queue<PaperJobData> {
  return new Queue<PaperJobData>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5_000,    // 5s → 10s → 20s
      },
      removeOnComplete: { count: 100 }, // conservar los últimos 100 completados
      removeOnFail: { count: 200 },     // conservar los últimos 200 fallidos
    },
  })
}
