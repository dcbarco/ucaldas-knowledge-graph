// Paso 7 — Log y notificación                               [100%]
// 1. papers.status → 'ready'
// 2. INSERT wiki_log (tipo: 'ingest')
// 3. Supabase Realtime broadcast → kiosko anima expansión micelio
// wiki_log es append-only: nunca UPDATE ni DELETE

import { log, mockDB } from '../lib/logger'
import type { ProgressUpdater, WikiUpdateResult, ExplainedRelation } from '../lib/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function notify(
  paperId: string,
  paperTitle: string,
  wikiResult: WikiUpdateResult,
  relations: ExplainedRelation[],
  update: ProgressUpdater
): Promise<void> {
  await update(95, 'Marcando paper como listo')

  // PRODUCCIÓN — marcar paper como 'ready':
  // await supabase.from('papers').update({ status: 'ready' }).eq('id', paperId)
  mockDB(paperId, `papers.update({ status: 'ready', updated_at: now() }).eq('id', '${paperId}')`)

  // PRODUCCIÓN — marcar job como completado:
  // await supabase.from('processing_jobs').update({ status: 'done', progress: 100 }).eq('paper_id', paperId)
  mockDB(paperId, `processing_jobs.update({ status: 'done', progress: 100 }).eq('paper_id', '${paperId}')`)

  await delay(200)
  await update(97, 'Registrando en wiki_log')

  const logDetails = {
    paper_id:          paperId,
    paper_title:       paperTitle,
    concepts_created:  wikiResult.conceptsCreated,
    concepts_updated:  wikiResult.conceptsUpdated,
    relations_proposed: relations.length,
    relation_ids:      relations.map(r => r.relatedPaperId),
  }

  // PRODUCCIÓN — INSERT en wiki_log (append-only):
  // await supabase.from('wiki_log').insert({
  //   event_type: 'ingest',
  //   title: `"${paperTitle}" — ${wikiResult.conceptsCreated.length} conceptos nuevos, ${relations.length} relaciones propuestas`,
  //   details: logDetails,
  // })
  mockDB(paperId, `wiki_log.insert({ event_type: 'ingest', title: '"${paperTitle.slice(0, 40)}" — ${wikiResult.conceptsCreated.length} nuevos, ${relations.length} relaciones' })`)

  await delay(200)
  await update(99, 'Notificando kiosko via Supabase Realtime')

  // PRODUCCIÓN — Supabase Realtime broadcast al kiosko:
  // El INSERT en wiki_log ya dispara Realtime en el canal 'wiki_log'
  // El UPDATE de papers.status a 'ready' dispara Realtime en el canal 'papers'
  // Supabase envía los cambios automáticamente por WebSocket al kiosko
  // El kiosko escucha en: supabase.channel('realtime').on('postgres_changes', ...)
  mockDB(paperId, '[Realtime] Broadcast automático via supabase_realtime publication — kiosko recibirá evento')

  await update(100, 'Procesamiento completado')

  const summary = [
    `✅ Paper "${paperTitle}" procesado exitosamente`,
    `   Conceptos: ${wikiResult.conceptsCreated.length} nuevos + ${wikiResult.conceptsUpdated.length} actualizados`,
    `   Relaciones propuestas: ${relations.length} (pendientes de aprobación del admin)`,
  ].join('\n')

  log(paperId, summary)
  console.log() // línea en blanco para separar en el log
}
