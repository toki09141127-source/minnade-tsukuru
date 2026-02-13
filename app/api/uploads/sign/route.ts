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
      .select('id, room_id, attachment_url, deleted_at')
      .eq('id', postId)
      .maybeSingle()

    if (postErr || !post || post.deleted_at) {
      return NextResponse.json({ ok: false, error: 'post not found' }, { status: 404 })
    }
    const storagePath = (post.attachment_url ?? '').trim()
    if (!storagePath) return NextResponse.json({ ok: false, error: 'no attachment' }, { status: 400 })

    // 参加者チェック
    const { data: mem } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', post.room_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!mem) return NextResponse.json({ ok: false, error: 'not a member' }, { status: 403 })

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from('room_uploads')
      .createSignedUrl(storagePath, 60 * 5) // 5分

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: signErr?.message ?? 'sign failed' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, signedUrl: signed.signedUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
