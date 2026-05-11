import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// DELETE /api/papers/[id]
// Deletes the paper row (cascades to processing_jobs, paper_concepts, relations)
// AND removes the PDF from Supabase Storage. Logs to wiki_log.

export async function DELETE(
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
    .select('pdf_path, title')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
  }

  if (paper.pdf_path) {
    const { error: storageErr } = await supabase.storage
      .from('papers')
      .remove([paper.pdf_path])
    if (storageErr) {
      console.error('[DELETE paper] storage cleanup failed:', storageErr.message)
    }
  }

  const { error: deleteErr } = await supabase.from('papers').delete().eq('id', id)
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  await supabase.from('wiki_log').insert({
    event_type: 'paper_deleted',
    title:      `Paper eliminado: "${paper.title}"`,
    details:    { paper_id: id, pdf_path: paper.pdf_path },
  })

  return NextResponse.json({ id, deleted: true })
}
