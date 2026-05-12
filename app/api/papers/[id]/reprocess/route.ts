import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/papers/[id]/reprocess
// Re-enqueues an existing paper through the worker pipeline. Useful when the
// first pass produced empty concepts (LLM failure) or no relations.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Paper ID required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: paper, error: fetchErr } = await supabase
    .from('papers')
    .select('id, pdf_path, title')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!paper)   return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  if (!paper.pdf_path) {
    return NextResponse.json({ error: 'Paper has no pdf_path — cannot reprocess' }, { status: 400 })
  }

  // Clean derived data so the pipeline starts fresh.
  // CASCADE on FKs takes care of relations and paper_concepts when we DELETE
  // those rows directly. For the paper itself we just reset its fields.
  await supabase.from('relations').delete().or(`paper_a_id.eq.${id},paper_b_id.eq.${id}`)
  await supabase.from('paper_concepts').delete().eq('paper_id', id)
  await supabase.from('papers').update({
    status:      'processing',
    abstract_es: null,
    abstract_en: null,
    concepts:    null,
    embedding:   null,
    full_text:   null,
  }).eq('id', id)

  await supabase.from('processing_jobs').upsert({
    paper_id:     id,
    status:       'queued',
    progress:     0,
    current_step: 'En cola (reproceso)',
    error_message: null,
  }, { onConflict: 'paper_id' })

  if (!process.env.REDIS_URL) {
    return NextResponse.json({ error: 'REDIS_URL not configured' }, { status: 500 })
  }

  try {
    const { Queue } = await import('bullmq')
    const IORedis    = (await import('ioredis')).default
    const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    const queue      = new Queue('paper-processing', { connection })
    await queue.add('process-paper', { paperId: id, pdfPath: paper.pdf_path, paperTitle: paper.title })
    await queue.close()
    await connection.quit()
  } catch (err) {
    console.error('[reprocess] BullMQ enqueue failed:', err)
    return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 })
  }

  return NextResponse.json({ id, reprocessing: true })
}
