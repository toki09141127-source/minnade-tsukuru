// app/api/rooms/leave/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return { url, anonKey, serviceKey }
}

async function getUserIdFromBearer(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return { userId: null, error: 'Unauthorized' }

  const { url, anonKey } = getEnv()
  const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return { userId: null, error: 'Unauthorized' }
  return { userId: data.user.id, error: null }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = String(body?.roomId ?? '').trim()
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })

    const { userId, error } = await getUserIdFromBearer(req)
    if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

    const { url, serviceKey } = getEnv()
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // membership取得（activeのみ）
    const { data: mem, error: memErr } = await admin
      .from('room_members')
      .select('role, joined_at, left_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
    if (!mem || mem.left_at != null) {
      return NextResponse.json({ ok: false, error: '参加していません' }, { status: 400 })
    }

    if (mem.role === 'creator') {
      return NextResponse.json({ ok: false, error: 'creatorは退出できません' }, { status: 403 })
    }

    const now = new Date()
    if (mem.role === 'core') {
      const joinedAt = mem.joined_at ? new Date(mem.joined_at) : null
      if (!joinedAt || Number.isNaN(joinedAt.getTime())) {
        return NextResponse.json({ ok: false, error: 'joined_atが不正のため退出できません' }, { status: 400 })
      }
      const diffMs = now.getTime() - joinedAt.getTime()
      const limitMs = 5 * 60 * 1000
      if (diffMs > limitMs) {
        return NextResponse.json({ ok: false, error: 'coreは参加から5分以内のみ退出できます' }, { status: 403 })
      }
    }

    const { error: updErr } = await admin
      .from('room_members')
      .update({ left_at: now.toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .is('left_at', null)

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
