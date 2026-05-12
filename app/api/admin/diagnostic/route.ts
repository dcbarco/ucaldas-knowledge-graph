import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/diagnostic — snapshot of DB state for debugging the pipeline

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const k = String(r[key] ?? 'null')
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export async function GET() {
  const supabase = createServiceClient()

  const [papersRes, conceptsRes, relationsRes, paperConceptsRes, jobsRes, logRes] = await Promise.all([
    supabase.from('papers').select('id, title, status, embedding, concepts, abstract_es, department, created_at').order('created_at', { ascending: false }),
    supabase.from('concept_nodes').select('id, slug, name_es, type, paper_count').order('paper_count', { ascending: false }),
    supabase.from('relations').select('id, status, similarity, relation_type, paper_a_id, paper_b_id, explanation_es'),
    supabase.from('paper_concepts').select('paper_id, concept_id, relevance'),
    supabase.from('processing_jobs').select('paper_id, status, progress, current_step, error_message, updated_at').order('updated_at', { ascending: false }),
    supabase.from('wiki_log').select('event_type, title, created_at, details').order('created_at', { ascending: false }).limit(15),
  ])

  const papers = papersRes.data ?? []

  const paperSamples = papers.slice(0, 3).map(p => {
    let embeddingInfo: { type: string; length?: number; preview?: string } = { type: 'null' }
    if (p.embedding) {
      const t = typeof p.embedding
      if (t === 'string') {
        const s = p.embedding as string
        embeddingInfo = { type: 'string', length: s.length, preview: s.slice(0, 60) + '...' }
      } else if (Array.isArray(p.embedding)) {
        embeddingInfo = { type: 'array', length: (p.embedding as number[]).length }
      } else {
        embeddingInfo = { type: t }
      }
    }

    return {
      id:           p.id,
      title:        p.title,
      status:       p.status,
      department:   p.department,
      has_abstract: !!p.abstract_es,
      abstract_es:  p.abstract_es?.slice(0, 100),
      concepts:     p.concepts,
      embedding:    embeddingInfo,
    }
  })

  return NextResponse.json({
    summary: {
      papers:         papers.length,
      papers_ready:   papers.filter(p => p.status === 'ready').length,
      concept_nodes:  (conceptsRes.data ?? []).length,
      relations:      (relationsRes.data ?? []).length,
      relations_proposed: (relationsRes.data ?? []).filter(r => r.status === 'proposed').length,
      relations_approved: (relationsRes.data ?? []).filter(r => r.status === 'approved').length,
      paper_concepts: (paperConceptsRes.data ?? []).length,
    },
    papers: {
      by_status: countBy(papers, 'status'),
      samples: paperSamples,
    },
    concept_nodes: {
      top10:  (conceptsRes.data ?? []).slice(0, 10).map(c => ({ slug: c.slug, name: c.name_es, type: c.type, papers: c.paper_count })),
    },
    relations: {
      by_status: countBy(relationsRes.data ?? [], 'status'),
      samples:   (relationsRes.data ?? []).slice(0, 5),
    },
    processing_jobs: {
      latest: (jobsRes.data ?? []).slice(0, 10),
    },
    recent_log:  logRes.data ?? [],
    env: {
      SIMILARITY_THRESHOLD:    process.env.SIMILARITY_THRESHOLD    ?? '(unset, fallback 0.5)',
      MAX_RELATIONS_PER_PAPER: process.env.MAX_RELATIONS_PER_PAPER ?? '(unset, fallback 10)',
    },
    errors: {
      papers:    papersRes.error?.message,
      concepts:  conceptsRes.error?.message,
      relations: relationsRes.error?.message,
      paper_concepts: paperConceptsRes.error?.message,
      jobs:      jobsRes.error?.message,
      log:       logRes.error?.message,
    },
  })
}
