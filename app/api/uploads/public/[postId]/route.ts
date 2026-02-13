// app/api/uploads/public/[postId]/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: { postId: string } }) {
  try {
    const postId = String(params.postId ?? '').trim()
    if (!postId) return NextResponse.json({ ok: false, error: 'postId is required' }, { status: 400 })

    const { data: post, error: postErr } = await supabaseAdmin
      .from('posts')
      .select('id, room_id, attachment_url, deleted_at, is_hidden')
      .eq('id', postId)
      .maybeSingle()

    if (postErr || !post || post.deleted_at || post.is_hidden) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    }

    const storagePath = (post.attachment_url ?? '').trim()
    if (!storagePath) return NextResponse.json({ ok: false, error: 'no attachment' }, { status: 404 })

    // 作品として公開されているかチェック
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, status, is_hidden, deleted_at')
      .eq('id', post.room_id)
      .maybeSingle()

    if (roomErr || !room || room.deleted_at || room.is_hidden) {
      return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    }
    if (room.status !== 'forced_publish') {
      return NextResponse.json({ ok: false, error: 'not published' }, { status: 403 })
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from('room_uploads')
      .createSignedUrl(storagePath, 60 * 10) // 10分

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: signErr?.message ?? 'sign failed' }, { status: 400 })
    }

    return NextResponse.redirect(signed.signedUrl, 302)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
