// Paso 7 — Log y notificación                               [100%]
import { supabase } from '../lib/supabase'
import { log } from '../lib/logger'
import type { ProgressUpdater, WikiUpdateResult, ExplainedRelation } from '../lib/types'

export async function notify(
  paperId: string,
  paperTitle: string,
  wikiResult: WikiUpdateResult,
  relations: ExplainedRelation[],
  update: ProgressUpdater
): Promise<void> {
  await update(95, 'Marcando paper como listo')

  await supabase
    .from('papers')
    .update({ status: 'ready' })
    .eq('id', paperId)

  await supabase
    .from('processing_jobs')
    .update({ status: 'done', progress: 100, current_step: 'Procesamiento completado' })
    .eq('paper_id', paperId)

  await update(97, 'Registrando en wiki_log')

  const logTitle = `"${paperTitle}" — ${wikiResult.conceptsCreated.length} conceptos nuevos, ${relations.length} relaciones propuestas`

  await supabase.from('wiki_log').insert({
    event_type: 'ingest',
    title:      logTitle,
    details: {
      paper_id:           paperId,
      paper_title:        paperTitle,
      concepts_created:   wikiResult.conceptsCreated,
      concepts_updated:   wikiResult.conceptsUpdated,
      relations_proposed: relations.length,
      relation_ids:       relations.map(r => r.relatedPaperId),
    },
  })

  await update(100, 'Procesamiento completado')

  const summary = [
    `✅ Paper "${paperTitle}" procesado exitosamente`,
    `   Conceptos: ${wikiResult.conceptsCreated.length} nuevos + ${wikiResult.conceptsUpdated.length} actualizados`,
    `   Relaciones propuestas: ${relations.length} (pendientes de aprobación del admin)`,
  ].join('\n')

  log(paperId, summary)
  console.log()
}
