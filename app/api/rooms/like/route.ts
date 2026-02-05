import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

function userClientFromToken(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ ok: false, error: 'no token' }, { status: 401 })

  const supaUser = userClientFromToken(token)
  const { data: u } = await supaUser.auth.getUser()
  const uid = u.user?.id
  if (!uid) return NextResponse.json({ ok: false, error: 'no user' }, { status: 401 })

  const { roomId } = await req.json()
  if (!roomId) return NextResponse.json({ ok: false, error: 'roomId required' }, { status: 400 })

  const { data: exists } = await supabaseAdmin
    .from('room_likes')
    .select('room_id')
    .eq('room_id', roomId)
    .eq('user_id', uid)
    .maybeSingle()

  if (exists) {
    await supabaseAdmin.from('room_likes').delete().eq('room_id', roomId).eq('user_id', uid)
    return NextResponse.json({ ok: true, liked: false })
  } else {
    const { error } = await supabaseAdmin.from('room_likes').insert({ room_id: roomId, user_id: uid })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, liked: true })
  }
}
