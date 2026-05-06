import OpenAI, { APIError } from 'openai'
import type {
  LLMProvider,
  PaperConcepts,
  WikiUpdate,
  RelationExplanation,
  PaperMeta,
  WikiQueryContext,
} from '../types'

// ─── Helpers ─────────────────────────────────────────────────

// Extrae JSON de respuestas que pueden incluir markdown fences o
// bloques <think>...</think> de DeepSeek R1.
function parseJSON<T>(raw: string): T {
  let text = raw.trim()
  // Eliminar bloques de razonamiento de DeepSeek R1
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  // Extraer contenido entre markdown code fences si existen
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
  if (fenced) text = fenced[1].trim()
  return JSON.parse(text) as T
}

// ─── Factory: crea un proveedor LLM con cualquier baseURL ─────
// Todos los proveedores comparten la misma lógica de prompts;
// solo difieren en cliente OpenAI y modelos disponibles.

export interface LLMProviderConfig {
  baseURL: string
  apiKey: string
  defaultHeaders?: Record<string, string>
  models: {
    heavy: string    // razonamiento complejo (wiki updates)
    standard: string // tareas estándar (extracción, relaciones)
    fast: string     // tareas rápidas (clasificación, slugs)
  }
}

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  let _client: OpenAI | null = null
  function client(): OpenAI {
    if (!_client) {
      _client = new OpenAI({
        baseURL: config.baseURL,
        apiKey: config.apiKey || 'no-key',
        defaultHeaders: config.defaultHeaders,
      })
    }
    return _client
  }

  const MAX_EXTRACTION = parseInt(
    process.env.MAX_TEXT_CHARS_FOR_EXTRACTION ?? '6000'
  )

  async function generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    model: string
  ): Promise<string> {
    const res = await client().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    })
    return res.choices[0]?.message?.content ?? ''
  }

  async function extractConcepts(text: string): Promise<PaperConcepts> {
    const truncated = text.slice(0, MAX_EXTRACTION)
    const system = `Eres un analizador de papers académicos. Responde ÚNICAMENTE en JSON válido.`
    const user = `Analiza este paper académico y extrae la siguiente información.
Responde SOLO con este JSON sin texto adicional:
{
  "summary_es": "Resumen de 3 oraciones claras en español",
  "summary_en": "3-sentence clear summary in English",
  "methods": ["metodología 1", "metodología 2"],
  "themes": ["tema principal 1", "tema principal 2", "tema principal 3"],
  "keywords": ["concepto clave 1", "concepto clave 2", "concepto clave 3", "concepto clave 4", "concepto clave 5", "concepto clave 6", "concepto clave 7", "concepto clave 8"],
  "field": "área disciplinar principal"
}

Paper (texto parcial):
${truncated}`
    const raw = await generateCompletion(system, user, config.models.standard)
    return parseJSON<PaperConcepts>(raw)
  }

  async function updateWikiNode(params: {
    conceptName: string
    existingSummaryEs: string
    paperTitle: string
    paperContext: string
  }): Promise<WikiUpdate> {
    const system = `Eres un curador de base de conocimiento académico.
Tu tarea es INTEGRAR nueva información en un resumen existente, no reemplazarlo.
Responde ÚNICAMENTE en JSON válido.`
    const user = `El concepto "${params.conceptName}" ya tiene este resumen acumulado:
"${params.existingSummaryEs}"

Un nuevo paper lo menciona con este contexto:
Título del paper: ${params.paperTitle}
Cómo lo usa: ${params.paperContext}

Actualiza el resumen integrando esta nueva perspectiva.
Si el nuevo paper contradice algo del resumen, nótalo.
Si aporta un matiz nuevo, inclúyelo.
Mantén el resumen conciso (máximo 4 oraciones).

Responde SOLO con JSON:
{
  "summary_es": "resumen actualizado en español",
  "summary_en": "updated summary in English",
  "contradiction_noted": true,
  "new_dimension_added": "descripción breve del matiz nuevo, o null"
}`
    const raw = await generateCompletion(system, user, config.models.heavy)
    return parseJSON<WikiUpdate>(raw)
  }

  async function explainRelation(
    paperA: PaperMeta,
    paperB: PaperMeta,
    sharedConcepts: string[],
    similarityScore: number
  ): Promise<RelationExplanation> {
    const conceptosA = paperA.concepts
      ? [...paperA.concepts.methods, ...paperA.concepts.themes].join(', ')
      : 'N/A'
    const conceptosB = paperB.concepts
      ? [...paperB.concepts.methods, ...paperB.concepts.themes].join(', ')
      : 'N/A'

    const system = `Eres un experto en análisis de redes de conocimiento académico.`
    const user = `Dos papers de investigación están relacionados con una similitud de ${similarityScore.toFixed(2)}.

Paper A — ${paperA.title}
Conceptos wiki que comparten: ${sharedConcepts.join(', ') || 'ninguno identificado'}
Conceptos propios A: ${conceptosA}

Paper B — ${paperB.title}
Conceptos propios B: ${conceptosB}

Genera una explicación breve (máximo 20 palabras cada una) de POR QUÉ están relacionados,
priorizando los conceptos wiki compartidos como evidencia.
Responde SOLO con JSON:
{
  "explanation_es": "Ambos investigan... / Comparten metodología de... / Convergen en...",
  "explanation_en": "Both investigate... / Share methodology of... / Converge on...",
  "relation_type": "semantic"
}`
    const raw = await generateCompletion(system, user, config.models.standard)
    return parseJSON<RelationExplanation>(raw)
  }

  async function quickClassify(prompt: string): Promise<string> {
    const system = `Responde de forma concisa y directa, sin explicaciones adicionales.`
    return generateCompletion(system, prompt, config.models.fast)
  }

  async function wikiQuery(
    question: string,
    context: WikiQueryContext
  ): Promise<string> {
    const system = `Eres un asistente de investigación académica con acceso a una base de conocimiento estructurada de la Universidad de Caldas. Responde siempre con citas a los papers y conceptos específicos que fundamentan tu respuesta.`
    const user = `Contexto de la wiki (concept_nodes relevantes):
${JSON.stringify(context.concept_nodes, null, 2)}

Papers relacionados:
${JSON.stringify(context.papers, null, 2)}

${question}

Responde de forma concisa y académica. Siempre cita los papers por título.
Si la respuesta requiere comparar departamentos, hazlo explícitamente.
Si no hay suficiente información en la wiki para responder, dilo claramente.`
    return generateCompletion(system, user, config.models.standard)
  }

  return {
    generateCompletion,
    extractConcepts,
    updateWikiNode,
    explainRelation,
    quickClassify,
    wikiQuery,
  }
}

// ─── Instancia de OpenRouter (hub principal) ──────────────────
// Requiere headers HTTP-Referer y X-Title para no ser rechazado.
export const openrouter = createLLMProvider({
  baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    'X-Title': 'Knowledge Graph UC',
  },
  models: {
    heavy:    process.env.LLM_MODEL_HEAVY    ?? 'deepseek/deepseek-r1:free',
    standard: process.env.LLM_MODEL_STANDARD ?? 'meta-llama/llama-3.3-70b-instruct:free',
    fast:     process.env.LLM_MODEL_FAST     ?? 'meta-llama/llama-3.2-3b-instruct:free',
  },
})

// Re-exportar para que cerebras/groq puedan importar sin circular deps
export { APIError }
