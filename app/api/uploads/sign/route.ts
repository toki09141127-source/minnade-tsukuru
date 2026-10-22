import { isRoomAttachmentPath } from '../../../../lib/attachmentPath'
// app/api/uploads/sign/route.ts
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

    const body = await req.json().catch(() => ({}))
    const postId = String(body.postId ?? '').trim()
    if (!postId) return NextResponse.json({ ok: false, error: 'postId is required' }, { status: 400 })

    // 投稿取得（添付パス含む）
    const { data: post, error: postErr } = await supabaseAdmin
      .from('posts')
      .select('id, room_id, attachment_url, deleted_at, is_hidden')
      .eq('id', postId)
      .maybeSingle()

    if (postErr || !post || post.deleted_at || post.is_hidden !== false) {
      return NextResponse.json({ ok: false, error: 'post not found' }, { status: 404 })
    }
    const storagePath = (post.attachment_url ?? '').trim()
    if (!storagePath) return NextResponse.json({ ok: false, error: 'no attachment' }, { status: 400 })

    if (!isRoomAttachmentPath(storagePath, String(post.room_id))) {
      return NextResponse.json({ error: 'invalid attachment path' }, { status: 404 })
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, deleted_at, is_hidden')
      .eq('id', post.room_id)
      .maybeSingle()

    if (roomError) {
      return NextResponse.json({ ok: false, error: 'failed to load room' }, { status: 500 })
    }
    if (!room || room.deleted_at || room.is_hidden !== false) {
      return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    }

    // 参加者チェック
    const { data: mem } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', post.room_id)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()

    if (!mem) return NextResponse.json({ ok: false, error: 'not a member' }, { status: 403 })

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from('room_uploads')
      .createSignedUrl(storagePath, 60 * 5) // 5分

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: '処理できませんでした。時間をおいてお試しください' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, signedUrl: signed.signedUrl })
  } catch (error: unknown) {
    void error
    const message = '署名を作成できませんでした'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
