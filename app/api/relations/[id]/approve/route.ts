import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/relations/[id]/approve
// Sets relation status = 'approved'. Supabase Realtime automatically broadcasts
// the UPDATE event to all kiosk clients subscribed to the relations table.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Relation ID required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('relations')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'proposed')   // guard: only approve proposed ones
    .select('id, paper_a_id, paper_b_id, similarity, relation_type, explanation_es, explanation_en')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Relation not found or already resolved' }, { status: 404 })
  }

  // Log to wiki_log (append-only)
  await supabase.from('wiki_log').insert({
    event_type: 'relation_approved',
    title:      `Relación aprobada: ${data.relation_type} (similitud: ${(data.similarity * 100).toFixed(0)}%)`,
    details:    { relation_id: data.id, paper_a_id: data.paper_a_id, paper_b_id: data.paper_b_id },
  })

  return NextResponse.json(data)
}
