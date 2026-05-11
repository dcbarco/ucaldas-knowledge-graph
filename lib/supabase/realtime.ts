import { createClient } from './client'

// ── Payload shapes from Supabase postgres_changes ────────────────────────────

export interface RelationRow {
  id: string
  paper_a_id: string
  paper_b_id: string
  similarity: number
  relation_type: 'semantic' | 'methodological' | 'thematic'
  status: string
  explanation_es: string | null
  explanation_en: string | null
  approved_at: string | null
}

export interface ProcessingJobRow {
  id: string
  paper_id: string
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: number
  current_step: string | null
  error_message: string | null
}

export interface ConceptNodeRow {
  id: string
  slug: string
  name_es: string
  name_en: string | null
  type: 'method' | 'theme' | 'theory' | 'field'
  summary_es: string | null
  paper_count: number
}

type Unsubscribe = () => void

// Unique suffix prevents "cannot add callbacks after subscribe()" when the
// singleton Supabase client returns an already-subscribed channel by name
// (happens with React StrictMode double-invoking effects in development).
function uid() { return Math.random().toString(36).slice(2) }

// ── Subscribe to relations that get approved ─────────────────────────────────
export function subscribeToApprovedRelations(
  onApproved: (relation: RelationRow) => void
): Unsubscribe {
  const client = createClient()
  const channel = client
    .channel(`kg:relations:${uid()}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'relations' },
      (payload) => {
        const row = payload.new as RelationRow
        if (row.status === 'approved') {
          onApproved(row)
        }
      }
    )
    .subscribe()

  return () => { client.removeChannel(channel) }
}

// ── Subscribe to processing_jobs progress updates ────────────────────────────
export function subscribeToProcessingJobs(
  onUpdate: (job: ProcessingJobRow) => void
): Unsubscribe {
  const client = createClient()
  const channel = client
    .channel(`kg:processing_jobs:${uid()}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'processing_jobs' },
      (payload) => onUpdate(payload.new as ProcessingJobRow)
    )
    .subscribe()

  return () => { client.removeChannel(channel) }
}

// ── Subscribe to papers becoming ready (status='ready') ─────────────────────
export function subscribeToReadyPapers(
  onReady: (paperId: string) => void
): Unsubscribe {
  const client = createClient()
  const channel = client
    .channel(`kg:papers:${uid()}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'papers' },
      (payload) => {
        const row = payload.new as { id: string; status: string }
        if (row.status === 'ready') onReady(row.id)
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'papers' },
      (payload) => {
        const row = payload.new as { id: string; status: string }
        if (row.status === 'ready') onReady(row.id)
      }
    )
    .subscribe()

  return () => { client.removeChannel(channel) }
}

// ── Subscribe to new/updated concept_nodes ───────────────────────────────────
export function subscribeToConceptNodes(
  onChange: (node: ConceptNodeRow, eventType: 'INSERT' | 'UPDATE') => void
): Unsubscribe {
  const client = createClient()
  const channel = client
    .channel(`kg:concept_nodes:${uid()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'concept_nodes' },
      (payload) => onChange(payload.new as ConceptNodeRow, 'INSERT')
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'concept_nodes' },
      (payload) => onChange(payload.new as ConceptNodeRow, 'UPDATE')
    )
    .subscribe()

  return () => { client.removeChannel(channel) }
}
