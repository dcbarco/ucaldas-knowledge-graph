// Paso 5 — Búsqueda de relaciones por similitud               [80%]
// Búsqueda dual en pgvector:
//   A) Similitud directa de embedding paper ↔ paper
//   B) Papers que comparten concept_nodes en paper_concepts
// Combina y deduplica. Filtra por SIMILARITY_THRESHOLD.

import { log, mockDB } from '../lib/logger'
import type { ProgressUpdater, CandidateRelation } from '../lib/types'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD ?? '0.72')
const MAX_RELATIONS = parseInt(process.env.MAX_RELATIONS_PER_PAPER ?? '10')

export async function findRelations(
  paperId: string,
  _embedding: number[],
  update: ProgressUpdater
): Promise<CandidateRelation[]> {
  await update(72, 'Buscando papers similares por embedding (pgvector)')

  // PRODUCCIÓN — Búsqueda A) por embedding:
  // const { data: byEmbedding } = await supabase.rpc('match_papers_by_embedding', {
  //   query_embedding: embedding,
  //   match_threshold: THRESHOLD,
  //   match_count: MAX_RELATIONS,
  //   exclude_paper_id: paperId,
  // })
  // SQL equivalente:
  //   SELECT p.id, p.title, 1 - (p.embedding <=> $1) AS similarity
  //   FROM papers p
  //   WHERE p.id != $2 AND p.status = 'ready'
  //     AND 1 - (p.embedding <=> $1) > $3
  //   ORDER BY similarity DESC LIMIT $4
  mockDB(paperId, `rpc('match_papers_by_embedding', { threshold: ${THRESHOLD}, exclude: '${paperId}' })`)
  await delay(600)

  await update(76, 'Buscando papers con conceptos compartidos en la wiki')

  // PRODUCCIÓN — Búsqueda B) por concept_nodes compartidos:
  // const { data: byConceptsRaw } = await supabase.rpc('match_papers_by_concepts', {
  //   source_paper_id: paperId,
  //   min_shared_concepts: 2,
  // })
  // SQL equivalente:
  //   SELECT p.id, p.title, COUNT(*) AS shared_count,
  //     ARRAY_AGG(cn.slug) AS shared_slugs
  //   FROM paper_concepts pc1
  //   JOIN paper_concepts pc2 ON pc2.concept_id = pc1.concept_id AND pc2.paper_id != $1
  //   JOIN papers p ON p.id = pc2.paper_id
  //   JOIN concept_nodes cn ON cn.id = pc1.concept_id
  //   WHERE pc1.paper_id = $1
  //   GROUP BY p.id, p.title HAVING COUNT(*) >= $2
  mockDB(paperId, `rpc('match_papers_by_concepts', { source_paper_id: '${paperId}', min_shared: 2 })`)
  await delay(500)

  // Mock: simula 3 relaciones candidatas
  const allMock: CandidateRelation[] = [
    {
      relatedPaperId:     'paper-mock-1',
      relatedPaperTitle:  'Tecnología IoT en agricultura de precisión',
      similarity:         0.87,
      sharedConceptSlugs: ['metodologia-mixta', 'tecnologia-rural'],
      relation_type:      'methodological',
    },
    {
      relatedPaperId:     'paper-mock-2',
      relatedPaperTitle:  'Resiliencia comunitaria ante eventos climáticos en Caldas',
      similarity:         0.79,
      sharedConceptSlugs: ['comunidades-rurales', 'sostenibilidad'],
      relation_type:      'thematic',
    },
    {
      relatedPaperId:     'paper-mock-3',
      relatedPaperTitle:  'Redes sociales y capital social en zonas rurales',
      similarity:         0.74,
      sharedConceptSlugs: ['analisis-redes-sociales'],
      relation_type:      'semantic',
    },
  ]
  const mockRelations = allMock.filter(r => r.similarity >= THRESHOLD).slice(0, MAX_RELATIONS)

  await update(80, `${mockRelations.length} relaciones candidatas encontradas`)
  log(paperId, `Relaciones candidatas: ${mockRelations.length} (umbral: ${THRESHOLD})`)
  mockRelations.forEach(r =>
    log(paperId, `  → "${r.relatedPaperTitle}" [${r.relation_type}] (sim: ${r.similarity})`)
  )

  return mockRelations
}
