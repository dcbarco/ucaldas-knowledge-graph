// Paso 3 — Extracción de conceptos con LLM                   [30%]
// Producción: OpenRouter → llama-3.3-70b-instruct:free
// Prompt del spec §14 → JSON con methods, themes, keywords, etc.

import { log, mockDB } from '../lib/logger'
import type { ProgressUpdater, ExtractedConcepts } from '../lib/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const MAX_CHARS = parseInt(process.env.MAX_TEXT_CHARS_FOR_EXTRACTION ?? '6000')

export async function extractConcepts(
  paperId: string,
  fullText: string,
  update: ProgressUpdater
): Promise<ExtractedConcepts> {
  await update(25, 'Extrayendo conceptos con LLM')

  const truncated = fullText.slice(0, MAX_CHARS)
  log(paperId, `Llamando a LLM para extracción (${truncated.length} chars de contexto)`)

  // PRODUCCIÓN: prompt del spec §14
  // const system = `Eres un analizador de papers académicos. Responde ÚNICAMENTE en JSON válido.`
  // const user = `Analiza este paper y extrae: summary_es, summary_en, methods[], themes[], keywords[], field`
  // const client = new OpenAI({ baseURL: process.env.OPENROUTER_BASE_URL, apiKey: process.env.OPENROUTER_API_KEY,
  //   defaultHeaders: { 'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL, 'X-Title': 'Knowledge Graph UC' } })
  // const res = await client.chat.completions.create({
  //   model: process.env.LLM_MODEL_STANDARD ?? 'meta-llama/llama-3.3-70b-instruct:free',
  //   messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  //   temperature: 0.1,
  // })
  // const concepts = JSON.parse(res.choices[0].message.content ?? '{}') as ExtractedConcepts
  mockDB(paperId, `openrouter.chat.completions.create({ model: 'llama-3.3-70b-instruct:free', ... })`)
  await delay(1200) // simula latencia LLM

  const mockConcepts: ExtractedConcepts = {
    summary_es: `[MOCK] Este paper examina metodologías para el análisis de comunidades rurales en Caldas.`,
    summary_en: `[MOCK] This paper examines methodologies for rural community analysis in Caldas.`,
    methods:    ['análisis de redes sociales', 'etnografía digital', 'metodología mixta'],
    themes:     ['comunidades rurales', 'sostenibilidad', 'tecnología rural'],
    keywords:   ['Caldas', 'redes sociales', 'resiliencia', 'capital social', 'Colombia', 'ruralidad'],
    field:      'Ciencias Sociales',
  }

  await update(30, 'Conceptos extraídos — persistiendo en papers')
  log(paperId, `Conceptos: ${mockConcepts.methods.length} métodos, ${mockConcepts.themes.length} temas, ${mockConcepts.keywords.length} keywords`)

  // PRODUCCIÓN:
  // await supabase.from('papers').update({
  //   abstract_es: concepts.summary_es, abstract_en: concepts.summary_en,
  //   concepts: { methods: concepts.methods, themes: concepts.themes, keywords: concepts.keywords }
  // }).eq('id', paperId)
  mockDB(paperId, `papers.update({ abstract_es, abstract_en, concepts: {...} }).eq('id', '${paperId}')`)

  return mockConcepts
}
