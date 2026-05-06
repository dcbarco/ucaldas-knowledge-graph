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

// ── Subscribe to relations that get approved ─────────────────────────────────
// Fires whenever a row in `relations` is UPDATEd to status='approved'.
// The Realtime replication must be enabled on the `relations` table (002_realtime.sql).
export function subscribeToApprovedRelations(
  onApproved: (relation: RelationRow) => void
): Unsubscribe {
  const client = createClient()
  const channel = client
    .channel('kg:relations')
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
    .channel('kg:processing_jobs')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'processing_jobs' },
      (payload) => onUpdate(payload.new as ProcessingJobRow)
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
    .channel('kg:concept_nodes')
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
