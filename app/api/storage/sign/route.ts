import { isRoomAttachmentPath } from '../../../../lib/attachmentPath'
// app/api/storage/sign/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'room_uploads'
const EXPIRES_IN = 60 * 5 // 5分

export async function POST(req: Request) {
  try {
    if (process.env.MVP_DRAFTS_ENABLED !== 'true') return NextResponse.json({error:'現在この機能は利用できません'}, {status:503,headers:{'Cache-Control':'no-store'}})
    const body = await req.json().catch(() => ({}))
    const postId = String(body?.postId ?? '').trim()

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    }

    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('room_id, attachment_url, deleted_at, is_hidden')
      .eq('id', postId)
      .maybeSingle()

    if (postError) {
      return NextResponse.json({ error: 'failed to load post' }, { status: 500 })
    }

    if (!post || post.deleted_at || post.is_hidden !== false) {
      return NextResponse.json({ error: 'post not found' }, { status: 404 })
    }

    const storagePath = String(post.attachment_url ?? '').trim()
    if (!storagePath) {
      return NextResponse.json({ error: 'attachment not found' }, { status: 404 })
    }

    if (!isRoomAttachmentPath(storagePath, String(post.room_id))) {
      return NextResponse.json({ error: 'invalid attachment path' }, { status: 404 })
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('status, deleted_at, is_hidden')
      .eq('id', post.room_id)
      .maybeSingle()

    if (roomError) {
      return NextResponse.json({ error: 'failed to load room' }, { status: 500 })
    }

    if (
      !room ||
      room.status !== 'forced_publish' ||
      room.deleted_at ||
      room.is_hidden !== false
    ) {
      return NextResponse.json({ error: 'work not found' }, { status: 404 })
    }


    if (process.env.MVP_DRAFTS_ENABLED === 'true') {
      const {data:allowed,error:reviewError}=await supabaseAdmin.rpc('mvp_public_post_allowed',{p_post:postId})
      if(reviewError) return NextResponse.json({error:'公開状態を確認できません'}, {status:503})
      if(allowed!==true) return NextResponse.json({error:'添付が見つかりません'}, {status:404})
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, EXPIRES_IN)

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: '処理できませんでした。時間をおいてお試しください' },
        { status: 500 }
      )
    }

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch {
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
