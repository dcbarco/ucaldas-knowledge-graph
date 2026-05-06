// Tipos compartidos entre todos los jobs del worker

export interface PaperJobData {
  paperId: string
  pdfPath: string          // Path interno en Supabase Storage
  paperTitle?: string
}

// Función que cada job llama para actualizar processing_jobs en Supabase
export type ProgressUpdater = (progress: number, step: string) => Promise<void>

// Resultado del Paso 2 — extract-concepts
export interface ExtractedConcepts {
  summary_es: string
  summary_en: string
  methods: string[]
  themes: string[]
  keywords: string[]
  field: string
}

// Relación candidata generada en find-relations
export interface CandidateRelation {
  relatedPaperId: string
  relatedPaperTitle: string
  similarity: number
  sharedConceptSlugs: string[]
  relation_type: 'semantic' | 'methodological' | 'thematic'
}

// Relación con explicaciones generadas en explain-relations
export interface ExplainedRelation extends CandidateRelation {
  explanation_es: string
  explanation_en: string
}

// Resultado del Paso 4 — update-wiki
export interface WikiUpdateResult {
  conceptsCreated: string[]   // términos de conceptos nuevos creados
  conceptsUpdated: string[]   // términos de conceptos existentes actualizados
}
