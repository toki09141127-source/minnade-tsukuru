import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

type WorkType = 'novel' | 'manga' | 'game' | 'music' | 'video' | 'other'

export async function POST(req: Request) {
  try {
    // --- auth ---
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user

    // --- body ---
    const body = await req.json()
    const title = String(body.title ?? '').trim()
    const workType = String(body.workType ?? 'novel') as WorkType
    const timeLimitHours = Number(body.timeLimitHours ?? 50)

    if (!title) return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
    if (title.length > 60) {
      return NextResponse.json({ ok: false, error: 'title is too long (max 60)' }, { status: 400 })
    }

    const allowedTypes: WorkType[] = ['novel', 'manga', 'game', 'music', 'video', 'other']
    if (!allowedTypes.includes(workType)) {
      return NextResponse.json({ ok: false, error: 'invalid workType' }, { status: 400 })
    }

    const allowedHours = [1, 3, 6, 12, 24, 48, 50, 72, 100]
    if (!Number.isFinite(timeLimitHours) || !allowedHours.includes(timeLimitHours)) {
      return NextResponse.json({ ok: false, error: 'invalid timeLimitHours' }, { status: 400 })
    }

    const expiresAt = new Date(Date.now() + timeLimitHours * 60 * 60 * 1000).toISOString()

    // username（無ければ名無し）
    let username = (user.user_metadata?.username as string | undefined) ?? null
    if (!username) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()
      username = (prof?.username ?? '').trim() || null
    }
    const safeUsername = username ?? '名無し'

    // ✅ rooms の実在カラムだけ送る（host_id 系は送らない）
    const insertPayload = {
      title,
      work_type: workType,
      time_limit_hours: timeLimitHours,
      status: 'open',
      expires_at: expiresAt,
      like_count: 0,

      // ✅ あなたのDBは host_ids NOT NULL
      host_ids: [user.id],
    }

    const { data: room, error: insErr } = await supabaseAdmin
      .from('rooms')
      .insert(insertPayload)
      .select('id, title, work_type, status, time_limit_hours, created_at, expires_at, like_count')
      .single()

    if (insErr || !room) {
      return NextResponse.json({ ok: false, error: insErr?.message ?? 'insert failed' }, { status: 400 })
    }

    // 作成者をコア参加にする
    const { error: memErr } = await supabaseAdmin.from('room_members').insert({
      room_id: room.id,
      user_id: user.id,
      username: safeUsername,
      is_core: true,
    })
    if (memErr) {
      // ルーム作成は成功してるので、参加失敗はエラーにしてもいいけど一旦返す
      return NextResponse.json({ ok: true, room, warn: memErr.message })
    }

    return NextResponse.json({ ok: true, room })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
