// app/rooms/[id]/core-requests/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'

type Params = { id: string }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id: roomId } = await params
  const supabase = await createUserClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // オーナー確認
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .single()

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 400 })
  if (room?.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('room_join_requests')
    .select('*')
    .eq('room_id', roomId)
    .eq('requested_role', 'core')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ requests: data ?? [] })
}
