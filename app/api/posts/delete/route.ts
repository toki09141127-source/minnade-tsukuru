// app/api/posts/delete/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

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
    const body = await req.json().catch(() => ({}))
    const postId = String(body.postId ?? '').trim()
    if (!postId) return NextResponse.json({ ok: false, error: 'postId is required' }, { status: 400 })

    // 1) 投稿取得（所有者チェック）
    const { data: post, error: postErr } = await supabaseAdmin
      .from('posts')
      .select('id, room_id, user_id, deleted_at')
      .eq('id', postId)
      .maybeSingle()

    if (postErr || !post) {
      return NextResponse.json({ ok: false, error: 'post not found' }, { status: 404 })
    }

    // 既に削除済みならOK
    if (post.deleted_at) {
      return NextResponse.json({ ok: true })
    }

    // ✅ 他人の投稿は絶対に不可
    if (post.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    // 2) ルーム確認（open以外は操作不可：安全側）
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, status')
      .eq('id', post.room_id)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ ok: false, error: roomErr.message }, { status: 500 })
    if (!room) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    if (room.status !== 'open') {
      return NextResponse.json(
        { ok: false, error: `このルームは ${room.status} のため操作できません` },
        { status: 403 }
      )
    }

    // 3) ✅ 参加者チェック（投稿者本人でも、参加から抜けてたら不可）
    const { data: mem, error: memErr } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', post.room_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
    if (!mem) {
      return NextResponse.json(
        { ok: false, error: 'ルームに参加してから操作してください' },
        { status: 403 }
      )
    }

    // 4) 論理削除（deleted_at を now）
    const { error: updErr } = await supabaseAdmin
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('user_id', user.id) // 二重ガード

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
