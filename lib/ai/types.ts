// ─── Datos del paper extraídos por el LLM ────────────────────
export interface PaperConcepts {
  summary_es: string
  summary_en: string
  methods: string[]
  themes: string[]
  keywords: string[]
  field: string
}

// ─── Resultado de actualizar un nodo de la wiki ───────────────
export interface WikiUpdate {
  summary_es: string
  summary_en: string
  contradiction_noted: boolean
  new_dimension_added: string | null
}

// ─── Explicación generada para un par de papers relacionados ──
export interface RelationExplanation {
  explanation_es: string
  explanation_en: string
  relation_type: 'semantic' | 'methodological' | 'thematic'
}

// ─── Metadatos mínimos de paper para el router ────────────────
export interface PaperMeta {
  id: string
  title: string
  department?: string
  abstract_es?: string
  concepts?: {
    methods: string[]
    themes: string[]
    keywords: string[]
  }
}

// ─── Contexto para consulta semántica a la wiki ───────────────
export interface WikiQueryContext {
  concept_nodes: Array<{
    slug: string
    name_es: string
    summary_es: string
    type: string
  }>
  papers: PaperMeta[]
}

// ─── Tipos de tarea para el router de fallback ────────────────
export type TaskType =
  | 'embedding'
  | 'extract_concepts'
  | 'wiki_update'
  | 'explain_relation'
  | 'quick_classify'
  | 'wiki_query'

// ─── Interfaz compartida por todos los proveedores LLM ───────
export interface LLMProvider {
  generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    model: string
  ): Promise<string>
  extractConcepts(text: string): Promise<PaperConcepts>
  updateWikiNode(params: {
    conceptName: string
    existingSummaryEs: string
    paperTitle: string
    paperContext: string
  }): Promise<WikiUpdate>
  explainRelation(
    paperA: PaperMeta,
    paperB: PaperMeta,
    sharedConcepts: string[],
    similarityScore: number
  ): Promise<RelationExplanation>
  quickClassify(prompt: string): Promise<string>
  wikiQuery(question: string, context: WikiQueryContext): Promise<string>
}

// ─── Interfaz para proveedores de embeddings ─────────────────
export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>
}
