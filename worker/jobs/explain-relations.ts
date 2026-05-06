// Paso 6 — Generación de explicaciones para cada relación     [92%]
// Producción: OpenRouter → llama-3.3-70b-instruct:free
// Prompt del spec §14 → explanation_es, explanation_en, relation_type
// INSERT INTO relations (status='proposed') para cada par

import { log, mockDB } from '../lib/logger'
import type { ProgressUpdater, CandidateRelation, ExplainedRelation } from '../lib/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// Frases de apertura por tipo — mock realista
const OPENERS: Record<string, { es: string; en: string }> = {
  methodological: {
    es: 'Comparten metodología de',
    en: 'Share methodology of',
  },
  thematic: {
    es: 'Convergen en el estudio de',
    en: 'Converge on the study of',
  },
  semantic: {
    es: 'Ambos investigan',
    en: 'Both investigate',
  },
}

export async function explainRelations(
  paperId: string,
  relations: CandidateRelation[],
  update: ProgressUpdater
): Promise<ExplainedRelation[]> {
  if (relations.length === 0) {
    await update(92, 'Sin relaciones a explicar')
    log(paperId, 'No hay relaciones candidatas para explicar')
    return []
  }

  await update(82, `Generando explicaciones para ${relations.length} relaciones`)
  log(paperId, `Explicando ${relations.length} relaciones con LLM`)

  const explained: ExplainedRelation[] = []

  for (let i = 0; i < relations.length; i++) {
    const relation = relations[i]
    const progress = 82 + Math.round((i / relations.length) * 10)
    await update(progress, `Explicando relación ${i + 1}/${relations.length}`)

    // PRODUCCIÓN — prompt del spec §14:
    // const system = `Eres un experto en análisis de redes de conocimiento académico.`
    // const user = buildRelationPrompt(paperId, relation, sharedConceptNodes)
    // const res = await openrouter.chat.completions.create({
    //   model: process.env.LLM_MODEL_STANDARD ?? 'meta-llama/llama-3.3-70b-instruct:free',
    //   messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    //   temperature: 0.1,
    // })
    // const explanation = JSON.parse(res.choices[0].message.content ?? '{}')
    mockDB(paperId, `openrouter.chat.completions.create({ model: 'llama-3.3-70b-instruct:free', relation: '${paperId}↔${relation.relatedPaperId}' })`)
    await delay(800)

    const opener = OPENERS[relation.relation_type]
    const sharedLabel = relation.sharedConceptSlugs.join(', ').replace(/-/g, ' ')

    const explanationEs = `${opener.es} ${sharedLabel} en contextos rurales colombianos`
    const explanationEn = `${opener.en} ${sharedLabel} in Colombian rural contexts`

    // PRODUCCIÓN — INSERT en relations como 'proposed':
    // await supabase.from('relations').insert({
    //   paper_a_id: paperId, paper_b_id: relation.relatedPaperId,
    //   similarity: relation.similarity, relation_type: relation.relation_type,
    //   shared_concepts: relation.sharedConceptSlugs,
    //   explanation_es: explanationEs, explanation_en: explanationEn,
    //   status: 'proposed', proposed_at: new Date().toISOString(),
    // })
    mockDB(paperId, `relations.insert({ paper_a: '${paperId}', paper_b: '${relation.relatedPaperId}', similarity: ${relation.similarity}, status: 'proposed' })`)

    explained.push({ ...relation, explanation_es: explanationEs, explanation_en: explanationEn })

    log(paperId, `  ✓ Relación [${relation.relation_type}] → "${relation.relatedPaperTitle}"`)
    log(paperId, `    ES: "${explanationEs}"`)
  }

  await update(92, `${explained.length} relaciones propuestas — pendientes de aprobación admin`)
  return explained
}
