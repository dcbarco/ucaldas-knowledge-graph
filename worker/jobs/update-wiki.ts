// Paso 4 — Actualización de concept_nodes (wiki acumulativa)  [65%]
import { supabase } from '../lib/supabase'
import { log } from '../lib/logger'
import type { ProgressUpdater, ExtractedConcepts, WikiUpdateResult } from '../lib/types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 80)
}

export async function updateWiki(
  paperId: string,
  concepts: ExtractedConcepts,
  update: ProgressUpdater
): Promise<WikiUpdateResult> {
  await update(55, 'Actualizando wiki de conceptos')

  const items = [
    ...concepts.methods.map(t => ({ term: t, type: 'method'  as const })),
    ...concepts.themes.map( t => ({ term: t, type: 'theme'   as const })),
  ]

  log(paperId, `Procesando ${items.length} conceptos en la wiki`)

  const created: string[] = []
  const updated: string[] = []

  for (const { term, type } of items) {
    if (!term.trim()) continue
    const slug = slugify(term)

    const { data: existing } = await supabase
      .from('concept_nodes')
      .select('id, paper_count')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await supabase.from('concept_nodes')
        .update({ paper_count: existing.paper_count + 1 })
        .eq('id', existing.id)
      if (updErr) log(paperId, `  [WIKI][ERR] update concept_nodes: ${updErr.message}`)

      const { error: pcErr } = await supabase.from('paper_concepts')
        .upsert({ paper_id: paperId, concept_id: existing.id, relevance: 0.8 }, { onConflict: 'paper_id,concept_id' })
      if (pcErr) log(paperId, `  [WIKI][ERR] upsert paper_concepts: ${pcErr.message}`)

      log(paperId, `  [WIKI] actualizado: "${term}"`)
      updated.push(term)
    } else {
      const { data: newNode, error: insErr } = await supabase
        .from('concept_nodes')
        .insert({
          slug,
          name_es:    term,
          name_en:    term,
          type,
          summary_es: `${type === 'method' ? 'Metodología' : 'Tema'} identificado en investigación de la Universidad de Caldas.`,
          paper_count: 1,
        })
        .select('id')
        .single()

      if (insErr || !newNode) {
        log(paperId, `  [WIKI][ERR] insert concept_node "${term}" (slug=${slug}): ${insErr?.message ?? 'no row returned'}`)
        continue
      }

      const { error: pcErr } = await supabase.from('paper_concepts')
        .insert({ paper_id: paperId, concept_id: newNode.id, relevance: 0.75 })
      if (pcErr) log(paperId, `  [WIKI][ERR] insert paper_concepts: ${pcErr.message}`)

      log(paperId, `  [WIKI] creado: "${term}" (${type})`)
      created.push(term)
    }
  }

  await update(65, `Wiki actualizada — ${created.length} nuevos, ${updated.length} actualizados`)
  return { conceptsCreated: created, conceptsUpdated: updated }
}
