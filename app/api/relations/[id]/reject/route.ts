import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/relations/[id]/reject

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
    .update({ status: 'rejected' })
    .eq('id', id)
    .eq('status', 'proposed')
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Relation not found or already resolved' }, { status: 404 })
  }

  return NextResponse.json(data)
}
