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

    const { data: room, error: roomError } = await supabaseAdmin.from('rooms')
      .select('id, status, is_hidden, deleted_at, expires_at').eq('id', roomId).maybeSingle()
    if (roomError) return NextResponse.json({ error: 'ルームを確認できません' }, { status: 503 })
    if (!room || room.is_hidden !== false || room.deleted_at != null) {
      return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
    }

    if (room.status !== 'open' || (room.expires_at && new Date(room.expires_at).getTime() <= Date.now())) return NextResponse.json({ error: '公開後は変更できません' }, { status: 403 })

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
      .select('id, room_id, is_marked, marked_by, marked_at, deleted_at, is_hidden')
      .eq('id', postId)
      .maybeSingle()

    if (postErr) {
      return NextResponse.json({ error: '投稿の取得に失敗しました' }, { status: 500 })
    }
    if (!post || post.deleted_at != null || post.is_hidden !== false) {
      return NextResponse.json({ error: '投稿が存在しません' }, { status: 404 })
    }
    if (post.room_id !== roomId) {
      return NextResponse.json({ error: '投稿がルームに属していません' }, { status: 400 })
    }


    if (process.env.MVP_MEMBERSHIP_GUARDS_ENABLED === 'true') {
      const { data: marked, error: markError } = await supabaseAdmin.rpc('mvp_highlight', {
        p_actor: userId, p_room: roomId, p_post: postId, p_expected: !!post.is_marked,
      })
      if (markError) return NextResponse.json({ error: '状態が変わりました。再読み込みしてください' }, { status: 409 })
      return NextResponse.json({ post: marked })
    }
    return NextResponse.json({ok:false,error:'現在この機能は利用できません。時間をおいてお試しください。'}, {status:503,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ error: '更新を処理できませんでした' }, { status: 500 })
  }
}
