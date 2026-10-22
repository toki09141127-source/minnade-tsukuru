import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!token) return NextResponse.json({ ok: false, error: 'ログインしてください' }, { status: 401 })
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) return NextResponse.json({ ok: false, error: 'ログインしてください' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const roomId = String(body.roomId ?? body.id ?? '').trim()
    if (!roomId) return NextResponse.json({ ok: false, error: 'ルームを指定してください' }, { status: 400 })
    const { data: room, error: readError } = await supabaseAdmin.from('rooms')
      .select('id, created_by, status, deleted_at, is_hidden').eq('id', roomId).maybeSingle()
    if (readError) return NextResponse.json({ ok: false, error: '確認できませんでした' }, { status: 503 })
    if (!room || room.is_hidden !== false) return NextResponse.json({ ok: false, error: 'ルームが見つかりません' }, { status: 404 })
    if (room.created_by !== data.user.id) return NextResponse.json({ ok: false, error: 'Creatorのみ操作できます' }, { status: 403 })
    if (room.status !== 'open') return NextResponse.json({ ok: false, error: '公開済みのルームは削除できません' }, { status: 403 })
    if (room.deleted_at) return NextResponse.json({ ok: true })
    // No physical deletion. Publication is rechecked in the same UPDATE.
    const { data: updated, error: updateError } = await supabaseAdmin.from('rooms')
      .update({ deleted_at: new Date().toISOString() }).eq('id', roomId)
      .eq('created_by', data.user.id).eq('status', 'open').eq('is_hidden', false).is('deleted_at', null)
      .select('id').maybeSingle()
    if (updateError) return NextResponse.json({ ok: false, error: '削除できませんでした' }, { status: 503 })
    if (!updated) return NextResponse.json({ ok: false, error: '状態が変わりました。再読み込みしてください' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: '削除できませんでした' }, { status: 503 })
  }
}
