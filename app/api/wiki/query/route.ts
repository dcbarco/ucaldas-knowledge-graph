import { NextRequest, NextResponse } from 'next/server'
import { createAnonServerClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/ai'
import { wikiQuery } from '@/lib/ai'

// Cosine similarity between two vectors
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na  += a[i] * a[i]
    nb  += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

// POST /api/wiki/query
// Body: { query: string, lang?: 'es' | 'en' }
// Response: { answer: string, sources: ConceptNode[] }

export async function POST(req: NextRequest) {
  let body: { query?: string; lang?: 'es' | 'en' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { query, lang = 'es' } = body
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const supabase = createAnonServerClient()

  // 1. Fetch concept_nodes (including embeddings for similarity search)
  const { data: concepts, error } = await supabase
    .from('concept_nodes')
    .select('id, slug, name_es, name_en, type, summary_es, summary_en, embedding, paper_count')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!concepts?.length) {
    return NextResponse.json({ answer: lang === 'es'
      ? 'La wiki aún no tiene conceptos indexados. Sube artículos para comenzar.'
      : 'The wiki has no indexed concepts yet. Upload papers to get started.',
      sources: [],
    })
  }

  // 2. Generate query embedding; fall back to keyword search if unavailable
  let topConcepts = concepts.slice(0, 5) // keyword fallback

  try {
    const queryEmbedding = await generateEmbedding(query)
    const withSim = concepts
      .filter(c => Array.isArray(c.embedding))
      .map(c => ({ ...c, sim: cosineSim(queryEmbedding, c.embedding as number[]) }))
      .sort((a, b) => b.sim - a.sim)

    if (withSim.length > 0) {
      topConcepts = withSim.slice(0, 5)
    } else {
      // Keyword fallback: match against name_es
      const q = query.toLowerCase()
      topConcepts = concepts
        .filter(c => c.name_es?.toLowerCase().includes(q) || c.summary_es?.toLowerCase().includes(q))
        .slice(0, 5)
    }
  } catch {
    // Embedding service unavailable — use keyword fallback
  }

  // 3. Build context for LLM and call wiki query
  const wikiContext = {
    concept_nodes: topConcepts.map(c => ({
      slug:       c.slug,
      name_es:    c.name_es,
      summary_es: c.summary_es ?? '',
      type:       c.type,
    })),
    papers: [],
  }

  let answer: string
  try {
    answer = await wikiQuery(query, wikiContext)
  } catch (err) {
    console.error('[wiki/query] LLM error:', err)
    answer = lang === 'es'
      ? `Basado en la wiki, los conceptos más relevantes son: ${topConcepts.map(c => c.name_es).join(', ')}.`
      : `Based on the wiki, the most relevant concepts are: ${topConcepts.map(c => c.name_es).join(', ')}.`
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sources = topConcepts.map(({ embedding: _embedding, ...rest }) => rest)

  return NextResponse.json({ answer, sources })
}
