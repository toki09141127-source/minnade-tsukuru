// app/api/posts/toggle-mark/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Body = {
  postId?: string
  roomId?: string
}

export async function POST(req: Request) {
  try {
    // -------------------------
    // 1) Auth
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
    // 2) Body
    // -------------------------
    const body = (await req.json().catch(() => ({}))) as Body
    const postId = String(body.postId ?? '').trim()
    const roomId = String(body.roomId ?? '').trim()

    if (!postId || !roomId) {
      return NextResponse.json({ error: 'postId と roomId は必須です' }, { status: 400 })
    }

    // -------------------------
    // 3) 権限チェック：room_members（core/creatorのみ）
    // -------------------------
    const { data: mem, error: memErr } = await supabaseAdmin
      .from('room_members')
      .select('role, left_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (memErr) {
      return NextResponse.json({ error: '権限確認に失敗しました' }, { status: 500 })
    }

    const myRole = mem?.left_at == null ? mem?.role : null
    const canMark = myRole === 'core' || myRole === 'creator'
    if (!canMark) {
      return NextResponse.json({ error: 'core/creator のみ操作できます' }, { status: 403 })
    }

    // -------------------------
    // 4) post が room に属するか確認 + 現在状態取得
    // -------------------------
    const { data: post, error: postErr } = await supabaseAdmin
      .from('posts')
      .select('id, room_id, is_marked, marked_by, marked_at, deleted_at')
      .eq('id', postId)
      .maybeSingle()

    if (postErr) {
      return NextResponse.json({ error: '投稿の取得に失敗しました' }, { status: 500 })
    }
    if (!post || post.deleted_at) {
      return NextResponse.json({ error: '投稿が存在しません' }, { status: 404 })
    }
    if (post.room_id !== roomId) {
      return NextResponse.json({ error: '投稿がルームに属していません' }, { status: 400 })
    }

    const current = !!post.is_marked
    const next = !current
    const nowIso = new Date().toISOString()

    // -------------------------
    // 5) 同時更新対策：現在値一致を条件にUPDATE（楽観ロック）
    // -------------------------
    const updatePayload = next
      ? { is_marked: true, marked_by: userId, marked_at: nowIso }
      : { is_marked: false, marked_by: null, marked_at: null }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from('posts')
      .update(updatePayload)
      .eq('id', postId)
      .eq('room_id', roomId)
      .eq('is_marked', current) // ← 競合を減らす
      .select('id, is_marked, marked_by, marked_at')
      .maybeSingle()

    if (upErr) {
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
    }

    // 競合などで0件更新になった場合：最新を返す
    if (!updated) {
      const { data: latest } = await supabaseAdmin
        .from('posts')
        .select('id, is_marked, marked_by, marked_at')
        .eq('id', postId)
        .maybeSingle()

      return NextResponse.json(
        {
          post: latest ?? null,
          conflict: true,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ post: updated }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
