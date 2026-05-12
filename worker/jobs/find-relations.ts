// Paso 5 — Búsqueda de relaciones por similitud               [80%]
import { supabase } from '../lib/supabase'
import { log } from '../lib/logger'
import type { ProgressUpdater, CandidateRelation } from '../lib/types'

const THRESHOLD    = parseFloat(process.env.SIMILARITY_THRESHOLD      ?? '0.5')
const MAX_RELATIONS = parseInt(process.env.MAX_RELATIONS_PER_PAPER    ?? '10')

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null
  const str = typeof raw === 'string' ? raw : JSON.stringify(raw)
  try {
    const parsed = JSON.parse(str.startsWith('[') ? str : `[${str}]`)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function findRelations(
  paperId: string,
  embedding: number[],
  update: ProgressUpdater
): Promise<CandidateRelation[]> {
  await update(72, 'Buscando papers similares por embedding (JS cosine)')

  // Fetch all ready papers except the current one
  const { data: papers, error } = await supabase
    .from('papers')
    .select('id, title, embedding')
    .eq('status', 'ready')
    .neq('id', paperId)

  if (error) {
    log(paperId, `Error fetching papers for similarity: ${error.message}`)
    return []
  }

  const byEmbedding: CandidateRelation[] = []

  for (const paper of papers ?? []) {
    const vec = parseEmbedding(paper.embedding)
    if (!vec || vec.length !== embedding.length) continue
    const sim = cosineSimilarity(embedding, vec)
    if (sim >= THRESHOLD) {
      byEmbedding.push({
        relatedPaperId:     paper.id,
        relatedPaperTitle:  paper.title ?? paper.id,
        similarity:         Math.round(sim * 1000) / 1000,
        sharedConceptSlugs: [],
        relation_type:      'semantic',
      })
    }
  }

  log(paperId, `Embedding similarity: ${byEmbedding.length} candidatos (umbral: ${THRESHOLD})`)

  await update(76, 'Buscando papers con conceptos compartidos en la wiki')

  // Shared concepts via paper_concepts join
  const { data: shared } = await supabase
    .from('paper_concepts')
    .select('concept_id, concept_nodes(slug)')
    .eq('paper_id', paperId)

  const myConcepts = new Map<string, string>()  // concept_id → slug
  for (const row of shared ?? []) {
    const slug = (row.concept_nodes as unknown as { slug: string } | null)?.slug
    if (slug) myConcepts.set(row.concept_id, slug)
  }

  const { data: otherPaperConcepts } = myConcepts.size > 0
    ? await supabase
        .from('paper_concepts')
        .select('paper_id, concept_id, papers(id, title, status)')
        .in('concept_id', [...myConcepts.keys()])
        .neq('paper_id', paperId)
    : { data: [] }

  // Group by paper_id to count shared concepts
  const sharedMap = new Map<string, { title: string; slugs: string[] }>()
  for (const row of otherPaperConcepts ?? []) {
    const p = row.papers as unknown as { id: string; title: string; status: string } | null
    if (!p || p.status !== 'ready') continue
    const slug = myConcepts.get(row.concept_id)
    if (!slug) continue
    const existing = sharedMap.get(row.paper_id)
    if (existing) {
      existing.slugs.push(slug)
    } else {
      sharedMap.set(row.paper_id, { title: p.title ?? row.paper_id, slugs: [slug] })
    }
  }

  // Merge concept-sharing results into byEmbedding list
  const resultMap = new Map<string, CandidateRelation>()
  for (const rel of byEmbedding) resultMap.set(rel.relatedPaperId, rel)

  for (const [pid, { title, slugs }] of sharedMap.entries()) {
    if (slugs.length < 2) continue  // need at least 2 shared concepts
    const existing = resultMap.get(pid)
    if (existing) {
      existing.sharedConceptSlugs = slugs
      // Promote type based on concept overlap
      if (existing.relation_type === 'semantic' && slugs.length >= 3) {
        existing.relation_type = 'thematic'
      }
    } else {
      // Concept-only match (below embedding threshold) — score based on count
      const sim = Math.min(0.70 + slugs.length * 0.02, THRESHOLD + 0.05)
      if (sim >= THRESHOLD) {
        resultMap.set(pid, {
          relatedPaperId:     pid,
          relatedPaperTitle:  title,
          similarity:         Math.round(sim * 1000) / 1000,
          sharedConceptSlugs: slugs,
          relation_type:      'thematic',
        })
      }
    }
  }

  const candidates = [...resultMap.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_RELATIONS)

  await update(80, `${candidates.length} relaciones candidatas encontradas`)
  log(paperId, `Relaciones candidatas: ${candidates.length} (umbral: ${THRESHOLD})`)
  candidates.forEach(r =>
    log(paperId, `  → "${r.relatedPaperTitle}" [${r.relation_type}] (sim: ${r.similarity})`)
  )

  return candidates
}
