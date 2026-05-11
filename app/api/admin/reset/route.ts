import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/admin/reset
// Wipes ALL papers, ALL concept_nodes, the wiki_log AND empties the Storage bucket.
// This is a hard reset — there is no undo. Caller should require double confirmation.

const IMPOSSIBLE_UUID = '00000000-0000-0000-0000-000000000000'

export async function POST(_req: NextRequest) {
  const supabase = createServiceClient()

  const counts = { papers: 0, concepts: 0, storage: 0 }

  const { data: papers } = await supabase.from('papers').select('id', { count: 'exact', head: false })
  counts.papers = papers?.length ?? 0

  const { data: concepts } = await supabase.from('concept_nodes').select('id', { count: 'exact', head: false })
  counts.concepts = concepts?.length ?? 0

  // 1. Empty Storage bucket
  const { data: files, error: listErr } = await supabase.storage.from('papers').list()
  if (listErr) {
    return NextResponse.json({ error: `Storage list failed: ${listErr.message}` }, { status: 500 })
  }
  if (files && files.length > 0) {
    const paths = files.map(f => f.name)
    const { error: removeErr } = await supabase.storage.from('papers').remove(paths)
    if (removeErr) {
      console.error('[reset] storage cleanup partial failure:', removeErr.message)
    } else {
      counts.storage = paths.length
    }
  }

  // 2. Delete all papers (cascades to processing_jobs, paper_concepts, relations)
  const { error: papersErr } = await supabase.from('papers').delete().neq('id', IMPOSSIBLE_UUID)
  if (papersErr) {
    return NextResponse.json({ error: `Papers delete failed: ${papersErr.message}` }, { status: 500 })
  }

  // 3. Delete all concept_nodes (accumulated wiki)
  const { error: conceptsErr } = await supabase.from('concept_nodes').delete().neq('id', IMPOSSIBLE_UUID)
  if (conceptsErr) {
    return NextResponse.json({ error: `Concepts delete failed: ${conceptsErr.message}` }, { status: 500 })
  }

  // 4. Delete the wiki_log itself (so the reset event becomes the first entry)
  await supabase.from('wiki_log').delete().neq('id', IMPOSSIBLE_UUID)

  await supabase.from('wiki_log').insert({
    event_type: 'wiki_reset',
    title:      `Wiki reseteada — ${counts.papers} papers, ${counts.concepts} conceptos eliminados`,
    details:    counts,
  })

  return NextResponse.json({ reset: true, ...counts })
}
