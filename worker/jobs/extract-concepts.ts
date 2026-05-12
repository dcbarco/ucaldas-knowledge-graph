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

// Models tried in order — first one that returns valid concepts wins.
// Free tier models on OpenRouter are flaky; chaining gives resilience.
const MODEL_CHAIN = [
  process.env.MODEL_STANDARD ?? 'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
]

function extractJSON(raw: string): string {
  let s = raw.replace(/```json\n?|\n?```/g, '').trim()
  const first = s.indexOf('{')
  const last  = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  return s
}

function isValidConcepts(c: Partial<ExtractedConcepts> | null): c is ExtractedConcepts {
  return !!c
    && typeof c.summary_es === 'string'
    && Array.isArray(c.methods)
    && Array.isArray(c.themes)
    && Array.isArray(c.keywords)
    && ((c.methods.length + c.themes.length) > 0)
}

async function tryModel(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  paperId: string
): Promise<ExtractedConcepts | null> {
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      temperature: 0.1,
      max_tokens: 700,
    })

    const raw = res.choices[0]?.message?.content ?? ''
    if (!raw.trim()) {
      log(paperId, `  [LLM] "${model}" devolvió respuesta vacía`)
      return null
    }

    const cleaned = extractJSON(raw)
    let parsed: Partial<ExtractedConcepts>
    try {
      parsed = JSON.parse(cleaned) as Partial<ExtractedConcepts>
    } catch (e) {
      log(paperId, `  [LLM] "${model}" JSON inválido — preview: ${cleaned.slice(0, 200)}`)
      log(paperId, `  [LLM] parse error: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }

    if (!isValidConcepts(parsed)) {
      log(paperId, `  [LLM] "${model}" JSON válido pero conceptos vacíos: ${JSON.stringify(parsed).slice(0, 200)}`)
      return null
    }

    log(paperId, `  [LLM] ✓ "${model}" devolvió ${parsed.methods.length} métodos, ${parsed.themes.length} temas`)
    return parsed
  } catch (err) {
    log(paperId, `  [LLM] "${model}" error de red/API: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
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

  const system = `Eres un analizador de papers académicos. Lee el texto y extrae conceptos clave.
Responde ÚNICAMENTE con un JSON válido — sin markdown, sin texto antes ni después, sin explicaciones.
El JSON debe tener exactamente esta forma:
{"summary_es": "...", "summary_en": "...", "methods": [...], "themes": [...], "keywords": [...], "field": "..."}`

  const user = `Analiza este paper académico y extrae:
- summary_es: resumen en español (2-3 oraciones)
- summary_en: summary in English (2-3 sentences)
- methods: array de 2-5 metodologías o técnicas usadas (ej: "machine learning", "encuesta cualitativa")
- themes: array de 2-5 temas principales (ej: "cambio climático", "salud mental")
- keywords: array de 3-7 palabras clave
- field: campo académico principal (ej: "Medicina", "Biología", "Ciencias Sociales")

REGLAS IMPORTANTES:
- methods y themes DEBEN tener al menos 1 elemento cada uno. NUNCA devuelvas arrays vacíos.
- Si el texto está en inglés, traduce los conceptos al español para methods/themes/keywords.

TEXTO DEL PAPER:
${truncated}`

  let concepts: ExtractedConcepts | null = null

  for (const model of MODEL_CHAIN) {
    concepts = await tryModel(client, model, system, user, paperId)
    if (concepts) break
  }

  if (!concepts) {
    log(paperId, `❌ Todos los modelos fallaron — usando FALLBACK vacío`)
    concepts = FALLBACK
  }

  await update(30, 'Conceptos extraídos — guardando resumen')
  const { error } = await supabase.from('papers').update({
    abstract_es: concepts.summary_es,
    abstract_en: concepts.summary_en,
    concepts:    { methods: concepts.methods, themes: concepts.themes, keywords: concepts.keywords },
  }).eq('id', paperId)

  if (error) log(paperId, `  [DB] error guardando concepts en papers: ${error.message}`)

  log(paperId, `Conceptos finales: ${concepts.methods.length} métodos, ${concepts.themes.length} temas, ${concepts.keywords.length} keywords`)
  return concepts
}
