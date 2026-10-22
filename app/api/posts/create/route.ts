import { databaseGuardsEnabled, limitAction } from '../../../../lib/apiGuards'
import { isRoomAttachmentPath } from '../../../../lib/attachmentPath'
// app/api/posts/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type MemberRow = {
  id: string
  role: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = typeof body?.roomId === 'string' ? body.roomId.trim() : ''
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    const post_type_raw = typeof body?.post_type === 'string' ? body.post_type.trim() : ''
    const post_type = post_type_raw === 'final' ? 'final' : 'log' // 表記揺れ防止

    // attachment_url は「Storageのpath」を入れる（署名URLは入れない）
    if (body?.attachment_url != null && typeof body.attachment_url !== 'string') return NextResponse.json({ error: 'invalid attachment' }, { status: 400 })
    const attachment_url_raw = typeof body?.attachment_url === 'string' ? body.attachment_url : null
    const attachment_url = attachment_url_raw?.trim() || null

    if (!roomId || !content) {
      return NextResponse.json({ error: 'roomId / content is required' }, { status: 400 })
    }

    if (attachment_url && !isRoomAttachmentPath(attachment_url, roomId)) {
      return NextResponse.json({ error: 'invalid attachment path' }, { status: 400 })
    }

    if (content.length > 20000) return NextResponse.json({ error: '本文は20000文字以下にしてください' }, { status: 413 })

    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const user = userData.user

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // ルーム確認
    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, status, deleted_at, is_hidden, expires_at')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ error: 'ルームを確認できません' }, { status: 500 })
    if (!room || room.deleted_at || room.is_hidden !== false) return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
    if (room.status !== 'open' || (room.expires_at && new Date(room.expires_at).getTime() <= Date.now())) {
      return NextResponse.json(
        { error: `このルームは ${room.status} のため投稿できません` },
        { status: 403 }
      )
    }

    // ✅ 参加者チェック（left_at is null のみ参加中）
    const { data: mem, error: memErr } = await admin
      .from('room_members')
      .select('id, role')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()

    if (memErr) return NextResponse.json({ error: '参加状態を確認できません' }, { status: 500 })
    if (!mem) {
      return NextResponse.json({ error: 'ルームに参加してから投稿してください' }, { status: 403 })
    }

    // ✅ final は core/creator のみ許可（API側ガード）
    if (post_type === 'final') {
      const role = String((mem as MemberRow).role ?? '')
      const ok = role === 'creator' || role === 'core'
      if (!ok) {
        return NextResponse.json({ error: '最終提出はcore/creatorのみ投稿できます' }, { status: 403 })
      }
    }

    // Legacy paths are never accepted as evidence of ownership, even when the ledger is disabled.
    if (attachment_url) return NextResponse.json({ error: '添付を再アップロードしてください' }, { status: 400 })
    const uploadId = typeof body.uploadId === 'string' ? body.uploadId : null
    const requestId = typeof body.requestId === 'string' ? body.requestId : crypto.randomUUID()
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if ((uploadId && !uuid.test(uploadId)) || !uuid.test(requestId)) {
      return NextResponse.json({ error: '投稿リクエストが不正です' }, { status: 400 })
    }
    if (uploadId && !databaseGuardsEnabled()) return NextResponse.json({ error: '添付機能は安全確認中です' }, { status: 503 })
    const limited = await limitAction(admin, user.id, 'posts')
    if (limited) return limited
    if (databaseGuardsEnabled()) {
      const { data: postId, error: createError } = await admin.rpc('create_post_with_upload', {
        p_actor: user.id, p_room: roomId, p_content: content, p_post_type: post_type,
        p_upload: uploadId, p_request_key: requestId,
      })
      if (createError) {
        const conflict = /UPLOAD_UNAVAILABLE|REQUEST_CONFLICT|POST_UNAVAILABLE/.test(createError.message)
        const forbidden = /NOT_MEMBER|FINAL_FORBIDDEN|ROOM_UNAVAILABLE/.test(createError.message)
        return NextResponse.json({ error: conflict ? '添付や投稿の状態が変わりました。再確認してください。' : '投稿を保存できませんでした' },
          { status: conflict ? 409 : forbidden ? 403 : 503 })
      }
      return NextResponse.json({ ok: true, postId })
    }
    return NextResponse.json({ok:false,error:'現在この機能は利用できません。時間をおいてお試しください。'}, {status:503,headers:{'Cache-Control':'no-store'}})
  } catch (error: unknown) {
    void error
    const message = '投稿を処理できませんでした'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
