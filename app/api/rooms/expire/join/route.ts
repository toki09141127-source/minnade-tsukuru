import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

function getUserClient(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null
  return { jwt }
}

export async function POST(req: Request) {
  const { jwt } = getUserClient(req)
  if (!jwt) return NextResponse.json({ ok: false, error: 'No auth' }, { status: 401 })

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  )

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { roomId } = await req.json()
  if (!roomId) return NextResponse.json({ ok: false, error: 'roomId required' }, { status: 400 })

  const userId = userData.user.id

  // ✅ service role (admin)
  const supabaseAdmin = createAdminClient()

  // roomの状態
  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, status')
    .eq('id', roomId)
    .single()

  if (roomErr || !room) return NextResponse.json({ ok: false, error: 'Room not found' }, { status: 404 })
  if (room.status !== 'open') return NextResponse.json({ ok: false, error: 'Room is closed' }, { status: 400 })

  // 既参加？
  const { data: already } = await supabaseAdmin
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()

  if (already) return NextResponse.json({ ok: true, joined: true, already: true })

  // 参加人数
  const { count: memberCount, error: cntErr } = await supabaseAdmin
    .from('room_members')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)

  if (cntErr) return NextResponse.json({ ok: false, error: cntErr.message }, { status: 500 })
  if ((memberCount ?? 0) >= 50) return NextResponse.json({ ok: false, error: '満員です（最大50人）' }, { status: 400 })

  // コア人数
  const { count: coreCount, error: coreErr } = await supabaseAdmin
    .from('room_members')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('is_core', true)

  if (coreErr) return NextResponse.json({ ok: false, error: coreErr.message }, { status: 500 })

  const isCore = (coreCount ?? 0) < 5

  // username（profiles優先、なければmetadata）
  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('user_id', userId)
    .maybeSingle()

  const username =
    prof?.username ??
    (userData.user.user_metadata?.username as string | undefined) ??
    null

  const { error: insErr } = await supabaseAdmin.from('room_members').insert({
    room_id: roomId,
    user_id: userId,
    username,
    is_core: isCore,
  })

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, joined: true, is_core: isCore })
}
