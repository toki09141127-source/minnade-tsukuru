// app/api/uploads/public/[postId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params
    if (!postId) {
      return NextResponse.json({ ok: false, error: 'postId is required' }, { status: 400 })
    }

    // ここから下はあなたの既存ロジックに合わせて実装してOK。
    // 例：post_attachments から storage_path を引いて signed url を返す、など。

    // --- 例: post_attachments テーブルがある想定 ---
    const { data: att, error: attErr } = await supabaseAdmin
      .from('post_attachments')
      .select('storage_path, mime_type')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (attErr) {
      return NextResponse.json({ ok: false, error: attErr.message }, { status: 500 })
    }
    if (!att?.storage_path) {
      return NextResponse.json({ ok: false, error: 'attachment not found' }, { status: 404 })
    }

    // bucket 名はあなたの設計に合わせて（例: room_uploads）
    const bucket = 'room_uploads'

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(att.storage_path, 60) // 60秒など短期

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { ok: false, error: signErr?.message ?? 'failed to sign url' },
        { status: 500 }
      )
    }

    // 302 redirect（public route想定）
    return NextResponse.redirect(signed.signedUrl, { status: 302 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
