import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { DEPT_COLORS } from '@/lib/data/mock'
import type { KGNodeData, KGLinkData } from '@/lib/data/mock'

// ── GET /api/papers ───────────────────────────────────────────────────────────
// Returns full graph data: papers + concept_nodes + approved relations + paper_concepts

export async function GET() {
  const supabase = createServiceClient()

  const [papersRes, conceptsRes, relationsRes, paperConceptsRes] = await Promise.all([
    supabase
      .from('papers')
      .select('id, title, title_en, department, year, authors, abstract_es, abstract_en')
      .eq('status', 'ready'),
    supabase
      .from('concept_nodes')
      .select('id, slug, name_es, name_en, type, summary_es, paper_count'),
    supabase
      .from('relations')
      .select('id, paper_a_id, paper_b_id, similarity, relation_type, explanation_es')
      .eq('status', 'approved'),
    supabase
      .from('paper_concepts')
      .select('paper_id, concept_id, relevance'),
  ])

  const error = papersRes.error ?? conceptsRes.error ?? relationsRes.error ?? paperConceptsRes.error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const papers     = papersRes.data     ?? []
  const concepts   = conceptsRes.data   ?? []
  const relations  = relationsRes.data  ?? []
  const paperConcepts = paperConceptsRes.data ?? []

  // Count approved connections per paper
  const connCount = new Map<string, number>()
  for (const r of relations) {
    connCount.set(r.paper_a_id, (connCount.get(r.paper_a_id) ?? 0) + 1)
    connCount.set(r.paper_b_id, (connCount.get(r.paper_b_id) ?? 0) + 1)
  }

  const nodes: KGNodeData[] = [
    ...papers.map(p => ({
      id: p.id,
      type: 'paper' as const,
      label: (p.title as string).length > 30
        ? (p.title as string).substring(0, 28) + '…'
        : (p.title as string),
      title:           p.title,
      title_en:        p.title_en ?? undefined,
      department:      p.department,
      departmentColor: DEPT_COLORS[p.department as string] ?? '#64748B',
      year:            p.year,
      authors:         p.authors ?? [],
      abstract_es:     p.abstract_es ?? undefined,
      abstract_en:     p.abstract_en ?? undefined,
      connectionCount: connCount.get(p.id) ?? 0,
    })),
    ...concepts.map(c => ({
      id: c.id,
      type: 'concept' as const,
      label:        c.name_es,
      name_es:      c.name_es,
      name_en:      c.name_en ?? undefined,
      slug:         c.slug,
      paper_count:  c.paper_count,
      concept_type: c.type as KGNodeData['concept_type'],
      summary_es:   c.summary_es ?? undefined,
    })),
  ]

  const links: KGLinkData[] = [
    ...relations.map(r => ({
      source:        r.paper_a_id,
      target:        r.paper_b_id,
      similarity:    r.similarity,
      relation_type: r.relation_type as KGLinkData['relation_type'],
      link_type:     'relation' as const,
      explanation_es: r.explanation_es ?? undefined,
    })),
    ...paperConcepts.map(pc => ({
      source:        pc.paper_id,
      target:        pc.concept_id,
      similarity:    pc.relevance,
      relation_type: 'thematic' as const,
      link_type:     'paper_concept' as const,
    })),
  ]

  return NextResponse.json({
    nodes,
    links,
    stats: {
      papers:    papers.length,
      relations: relations.length,
      concepts:  concepts.length,
    },
  })
}

// ── POST /api/papers ──────────────────────────────────────────────────────────
// Accepts multipart/form-data: file (PDF) + metadata
// Stores PDF in Supabase Storage, creates paper + processing_job, enqueues BullMQ job

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 })
  }

  const maxBytes = parseInt(process.env.MAX_PDF_SIZE_MB ?? '20') * 1024 * 1024
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `File exceeds ${process.env.MAX_PDF_SIZE_MB ?? 20} MB limit` }, { status: 413 })
  }

  const title      = formData.get('title') as string | null
  const department = formData.get('department') as string | null
  if (!title || !department) {
    return NextResponse.json({ error: 'title and department are required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Insert paper record (status='pending') to get the UUID
  const { data: paper, error: insertError } = await supabase
    .from('papers')
    .insert({
      title,
      title_en:    formData.get('title_en') ?? null,
      department,
      year:        parseInt(formData.get('year') as string) || new Date().getFullYear(),
      authors:     JSON.parse((formData.get('authors') as string) || '[]'),
      abstract_es: formData.get('abstract_es') ?? null,
      abstract_en: formData.get('abstract_en') ?? null,
      status:      'processing',
    })
    .select('id')
    .single()

  if (insertError || !paper) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create paper record' }, { status: 500 })
  }

  const paperId = paper.id
  const pdfPath = `${paperId}.pdf`

  // 2. Upload PDF to Supabase Storage
  const pdfBuffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('papers')
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    // Roll back the paper record
    await supabase.from('papers').delete().eq('id', paperId)
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
  }

  // 3. Update paper with pdf_path
  await supabase.from('papers').update({ pdf_path: pdfPath }).eq('id', paperId)

  // 4. Create processing_job record
  await supabase.from('processing_jobs').insert({
    paper_id:    paperId,
    status:      'queued',
    progress:    0,
    current_step: 'En cola',
  })

  // 5. Enqueue BullMQ job (lazy — skipped if REDIS_URL not set)
  if (process.env.REDIS_URL) {
    try {
      const { Queue } = await import('bullmq')
      const IORedis    = (await import('ioredis')).default
      const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      const queue      = new Queue('paper-processing', { connection })
      await queue.add('process-paper', { paperId, pdfPath, paperTitle: title })
      await queue.close()
      await connection.quit()
    } catch (err) {
      console.error('[api/papers] BullMQ enqueue failed:', err)
      // Non-fatal: paper is created, job can be re-queued manually
    }
  }

  return NextResponse.json({ id: paperId, status: 'pending' }, { status: 201 })
}
