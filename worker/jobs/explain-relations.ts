// Paso 6 — Generación de explicaciones para cada relación     [92%]
import OpenAI from 'openai'
import { supabase } from '../lib/supabase'
import { log } from '../lib/logger'
import type { ProgressUpdater, CandidateRelation, ExplainedRelation } from '../lib/types'

interface ExplanationJSON {
  explanation_es: string
  explanation_en: string
  relation_type:  'semantic' | 'methodological' | 'thematic'
}

const FALLBACK_EXPLANATIONS: Record<string, ExplanationJSON> = {
  methodological: {
    explanation_es: 'Ambos trabajos comparten metodologías de investigación similares.',
    explanation_en: 'Both works share similar research methodologies.',
    relation_type:  'methodological',
  },
  thematic:       {
    explanation_es: 'Ambos trabajos abordan temáticas convergentes.',
    explanation_en: 'Both works address converging themes.',
    relation_type:  'thematic',
  },
  semantic:       {
    explanation_es: 'Ambos trabajos presentan afinidad semántica en sus contenidos.',
    explanation_en: 'Both works share semantic affinity in their contents.',
    relation_type:  'semantic',
  },
}

export async function explainRelations(
  paperId: string,
  paperTitle: string,
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

  const client = new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    apiKey:  process.env.OPENROUTER_API_KEY ?? '',
    defaultHeaders: {
      'HTTP-Referer': 'https://ucaldas-kg.vercel.app',
      'X-Title': 'Knowledge Graph UC',
    },
  })

  const explained: ExplainedRelation[] = []

  for (let i = 0; i < relations.length; i++) {
    const relation = relations[i]
    const progress = 82 + Math.round((i / relations.length) * 10)
    await update(progress, `Explicando relación ${i + 1}/${relations.length}`)

    const sharedLabel = relation.sharedConceptSlugs.map(s => s.replace(/-/g, ' ')).join(', ')

    const userPrompt = `Dos papers académicos de la Universidad de Caldas están relacionados.
Paper A: "${paperTitle}"
Paper B: "${relation.relatedPaperTitle}"
Tipo de relación: ${relation.relation_type}
Conceptos compartidos: ${sharedLabel || 'similitud semántica general'}
Similitud: ${relation.similarity}

Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "explanation_es": "una oración en español explicando cómo se relacionan",
  "explanation_en": "one sentence in English explaining how they are related",
  "relation_type": "${relation.relation_type}"
}`

    let expl: ExplanationJSON = FALLBACK_EXPLANATIONS[relation.relation_type]

    try {
      const res = await client.chat.completions.create({
        model: process.env.MODEL_STANDARD ?? 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          { role: 'system', content: 'Eres un experto en análisis de redes de conocimiento académico. Responde ÚNICAMENTE con JSON válido.' },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens:  200,
      })
      const raw = (res.choices[0].message.content ?? '').replace(/```json\n?|\n?```/g, '').trim()
      expl = JSON.parse(raw) as ExplanationJSON
    } catch (err) {
      log(paperId, `LLM/parse error para relación ${i + 1}, usando fallback: ${err}`)
    }

    // INSERT into relations as 'proposed'
    const { error: insertErr } = await supabase.from('relations').insert({
      paper_a_id:       paperId,
      paper_b_id:       relation.relatedPaperId,
      similarity:       relation.similarity,
      relation_type:    expl.relation_type ?? relation.relation_type,
      shared_concepts:  relation.sharedConceptSlugs,
      explanation_es:   expl.explanation_es,
      explanation_en:   expl.explanation_en,
      status:           'proposed',
      proposed_at:      new Date().toISOString(),
    })

    if (insertErr) {
      log(paperId, `Error insertando relación: ${insertErr.message}`)
    }

    explained.push({
      ...relation,
      relation_type:   expl.relation_type ?? relation.relation_type,
      explanation_es:  expl.explanation_es,
      explanation_en:  expl.explanation_en,
    })

    log(paperId, `  ✓ Relación [${relation.relation_type}] → "${relation.relatedPaperTitle}"`)
    log(paperId, `    ES: "${expl.explanation_es}"`)
  }

  await update(92, `${explained.length} relaciones propuestas — pendientes de aprobación admin`)
  return explained
}
