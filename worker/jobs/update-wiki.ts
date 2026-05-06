// Paso 4 — Actualización de la Wiki (concept_nodes)          [65%]
// CRÍTICO: este es el paso que distingue el sistema de RAG puro.
//
// Para cada concepto extraído:
//   a) Buscar concept_node existente por similitud semántica (embedding > 0.90)
//   b) Si existe → LLM integra el nuevo paper al resumen acumulado
//   c) Si no existe → crear nuevo concept_node
//   d) Crear/actualizar paper_concepts (paper ↔ concepto + relevance)
//
// Producción: OpenRouter → deepseek-r1:free (razonamiento complejo)
// Prompt del spec §14 → JSON con summary_es, summary_en, contradiction_noted

import { log, mockDB } from '../lib/logger'
import type { ProgressUpdater, ExtractedConcepts, WikiUpdateResult } from '../lib/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function updateWiki(
  paperId: string,
  concepts: ExtractedConcepts,
  update: ProgressUpdater
): Promise<WikiUpdateResult> {
  await update(55, 'Actualizando wiki de conceptos')

  const allConcepts = [
    ...concepts.methods.map(c => ({ term: c, type: 'method' as const })),
    ...concepts.themes.map(c => ({ term: c, type: 'theme' as const })),
    // keywords como field/theory si son suficientemente específicos
  ]

  log(paperId, `Procesando ${allConcepts.length} conceptos en la wiki`)

  const created: string[] = []
  const updated: string[] = []

  for (const { term, type } of allConcepts) {
    await delay(300) // simula llamada a DB + LLM por concepto

    // PRODUCCIÓN PASO a) — fuzzy match via embedding en concept_nodes:
    // const termEmbedding = await githubModels.generateEmbedding(term)
    // const { data: matches } = await supabase.rpc('match_concepts', {
    //   query_embedding: termEmbedding,
    //   match_threshold: 0.90,
    //   match_count: 1,
    // })
    // const existing = matches?.[0] ?? null
    mockDB(paperId, `rpc('match_concepts', { query: '${term}', threshold: 0.90 })`)

    // Simular 40% nuevo / 60% existente
    const isExisting = Math.random() > 0.4

    if (isExisting) {
      // PRODUCCIÓN PASO b) — integrar con LLM (deepseek-r1):
      // const prompt = buildWikiUpdatePrompt(term, existing.summary_es, paperId, concepts)
      // const update = await openrouter.updateWikiNode({ conceptName: term, existingSummaryEs: existing.summary_es, ... })
      // await supabase.from('concept_nodes').update({ summary_es: update.summary_es, ... }).eq('id', existing.id)
      // await supabase.rpc('increment_paper_count', { concept_id: existing.id })
      mockDB(paperId, `concept_nodes.update({ summary_es: '[integrado]' }) WHERE slug='${slugify(term)}'`)
      mockDB(paperId, `paper_concepts.upsert({ paper_id, concept_id, relevance: 0.8, context_es: '...' })`)

      log(paperId, `  [WIKI] ACTUALIZADO: "${term}" (tipo: ${type})`)
      updated.push(term)
    } else {
      // PRODUCCIÓN PASO c) — crear nuevo concept_node:
      // const embedding = await githubModels.generateEmbedding(term)
      // await supabase.from('concept_nodes').insert({
      //   slug: slugify(term), name_es: term, name_en: translateToEn(term),
      //   type, summary_es: `Concepto mencionado en paper ${paperId}`, embedding,
      //   paper_count: 1, first_seen_at: new Date().toISOString(),
      // })
      mockDB(paperId, `concept_nodes.insert({ slug: '${slugify(term)}', name_es: '${term}', type: '${type}', paper_count: 1 })`)
      mockDB(paperId, `paper_concepts.insert({ paper_id: '${paperId}', concept_id: '[new-id]', relevance: 0.7 })`)

      log(paperId, `  [WIKI] CREADO: "${term}" (tipo: ${type})`)
      created.push(term)
    }
  }

  await update(65, `Wiki actualizada — ${created.length} nuevos, ${updated.length} actualizados`)
  log(paperId, `Wiki: ${created.length} conceptos creados, ${updated.length} actualizados`)

  return { conceptsCreated: created, conceptsUpdated: updated }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}
