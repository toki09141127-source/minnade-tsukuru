import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: Request) {
  try {
    // -------------------------
    // 1) Auth (Bearer)
    // -------------------------
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userRes.user.id

    // -------------------------
    // 2) Params
    // -------------------------
    const url = new URL(req.url)
    const excludeSelf = url.searchParams.get('excludeSelf') !== '0' // default true

    // -------------------------
    // 3) Get memberships (active only)
    // -------------------------
    const { data: mems, error: memErr } = await supabaseAdmin
      .from('room_members')
      .select('room_id,last_seen_at')
      .eq('user_id', userId)
      .is('left_at', null)

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 })
    }
    if (!mems || mems.length === 0) {
      return NextResponse.json({ ok: true, map: {} }, { status: 200 })
    }

    // -------------------------
    // 4) Unread aggregation per room
    //    (Room数が多いときにN+1にならないよう、まとめて取る)
    // -------------------------
    const roomIds = mems.map(m => m.room_id)
    const lastSeenMap = new Map<string, string | null>()
    for (const m of mems) lastSeenMap.set(m.room_id, m.last_seen_at ?? null)

    // ここは「全部の投稿」を取ると重いので、
    // created_at > min(last_seen_at) を条件に付けて絞る
    const lastSeenValues = mems
      .map(m => m.last_seen_at)
      .filter(Boolean) as string[]
    const minLastSeen = lastSeenValues.length
      ? new Date(Math.min(...lastSeenValues.map(v => new Date(v).getTime()))).toISOString()
      : null

    let postsQuery = supabaseAdmin
      .from('posts')
      .select('room_id,created_at,user_id')
      .in('room_id', roomIds)

    if (minLastSeen) {
      postsQuery = postsQuery.gt('created_at', minLastSeen)
    }

    if (excludeSelf) {
      postsQuery = postsQuery.neq('user_id', userId)
    }

    const { data: posts, error: postsErr } = await postsQuery
    if (postsErr) {
      return NextResponse.json({ error: postsErr.message }, { status: 500 })
    }

    // -------------------------
    // 5) Count unread per room
    // -------------------------
    const map: Record<string, number> = {}
    for (const roomId of roomIds) map[roomId] = 0

    for (const p of posts ?? []) {
      const lastSeen = lastSeenMap.get(p.room_id) // string|null|undefined
      const lastSeenTime = lastSeen ? new Date(lastSeen).getTime() : 0
      const postTime = new Date(p.created_at).getTime()

      // last_seen_at が null の場合は「全部未読」扱いになる（仕様として自然）
      if (postTime > lastSeenTime) {
        map[p.room_id] = (map[p.room_id] ?? 0) + 1
      }
    }

    return NextResponse.json({ ok: true, map }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}