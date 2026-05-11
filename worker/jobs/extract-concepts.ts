// Paso 3 — Extracción de conceptos con LLM  [30%]
import OpenAI from 'openai'
import { supabase } from '../lib/supabase'
import { log } from '../lib/logger'
import type { ProgressUpdater, ExtractedConcepts } from '../lib/types'

const MAX_CHARS = 6000

const FALLBACK: ExtractedConcepts = {
  summary_es: 'Paper académico de la Universidad de Caldas.',
  summary_en: 'Academic paper from Universidad de Caldas.',
  methods: [],
  themes: [],
  keywords: [],
  field: 'Investigación',
}

export async function extractConcepts(
  paperId: string,
  fullText: string,
  update: ProgressUpdater
): Promise<ExtractedConcepts> {
  await update(25, 'Extrayendo conceptos con LLM')

  const truncated = fullText.slice(0, MAX_CHARS)
  log(paperId, `Llamando LLM (${truncated.length} chars)`)

  const client = new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    apiKey:  process.env.OPENROUTER_API_KEY ?? '',
    defaultHeaders: {
      'HTTP-Referer': 'https://ucaldas-kg.vercel.app',
      'X-Title': 'Knowledge Graph UC',
    },
  })

  const system = `Eres un analizador de papers académicos. Responde ÚNICAMENTE con JSON válido, sin markdown ni explicaciones.`
  const user = `Analiza este texto de un paper académico y responde con este JSON exacto:
{
  "summary_es": "resumen en español en 2-3 oraciones",
  "summary_en": "summary in English in 2-3 sentences",
  "methods": ["método1", "método2"],
  "themes": ["tema1", "tema2"],
  "keywords": ["kw1", "kw2", "kw3"],
  "field": "campo académico principal"
}

TEXTO:
${truncated}`

  let concepts = FALLBACK
  try {
    const res = await client.chat.completions.create({
      model: process.env.MODEL_STANDARD ?? 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      temperature: 0.1,
      max_tokens: 600,
    })
    const raw = (res.choices[0].message.content ?? '').replace(/```json\n?|\n?```/g, '').trim()
    concepts = JSON.parse(raw) as ExtractedConcepts
  } catch (err) {
    log(paperId, `LLM/parse error, usando fallback: ${err}`)
  }

  await update(30, 'Conceptos extraídos — guardando resumen')
  await supabase.from('papers').update({
    abstract_es: concepts.summary_es,
    abstract_en: concepts.summary_en,
    concepts:    { methods: concepts.methods, themes: concepts.themes, keywords: concepts.keywords },
  }).eq('id', paperId)

  log(paperId, `Conceptos: ${concepts.methods.length} métodos, ${concepts.themes.length} temas, ${concepts.keywords.length} keywords`)
  return concepts
}
