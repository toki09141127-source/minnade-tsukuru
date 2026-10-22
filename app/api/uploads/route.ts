import { sanitizeImage } from '../../../lib/imagePrivacy'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'
import { databaseGuardsEnabled, limitAction } from '../../../lib/apiGuards'
import { MAX_UPLOAD_BYTES, validateUpload } from '../../../lib/uploadValidation'

export const dynamic = 'force-dynamic'
const BUCKET = 'room_uploads'

export async function POST(req: Request) {
  try {
    if (process.env.MVP_UPLOADS_ENABLED !== 'true') return NextResponse.json({error:'現在、添付のアップロードは停止中です'}, {status:503,headers:{'Cache-Control':'no-store'}})
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = data.user
    const limited = await limitAction(supabaseAdmin, user.id, 'uploads')
    if (limited) return limited
    if (Number(req.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES + 100_000) {
      return NextResponse.json({ error: 'ファイルは4MB以下にしてください' }, { status: 413 })
    }
    const form = await req.formData()
    const roomId = String(form.get('roomId') ?? '').trim()
    const file = form.get('file')
    if (!roomId || !file || typeof file === 'string') return NextResponse.json({ error: 'ルームとファイルを指定してください' }, { status: 400 })
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'ファイルは4MB以下にしてください' }, { status: 413 })
    const { data: room, error: roomError } = await supabaseAdmin.from('rooms')
      .select('id, status, deleted_at, is_hidden, expires_at').eq('id', roomId).maybeSingle()
    if (roomError) return NextResponse.json({ error: 'ルームを確認できません' }, { status: 503 })
    if (!room || room.deleted_at || room.is_hidden !== false) return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
    if (room.status !== 'open' || (room.expires_at && new Date(room.expires_at).getTime() <= Date.now())) return NextResponse.json({ error: '終了したルームにはアップロードできません' }, { status: 403 })
    const { data: member, error: memberError } = await supabaseAdmin.from('room_members')
      .select('id').eq('room_id', roomId).eq('user_id', user.id).is('left_at', null).maybeSingle()
    if (memberError) return NextResponse.json({ error: '参加状態を確認できません' }, { status: 503 })
    if (!member) return NextResponse.json({ error: 'ルームに参加してください' }, { status: 403 })
    if (!databaseGuardsEnabled()) return NextResponse.json({ error: '添付機能は安全確認中です。本文のみ投稿できます。' }, { status: 503 })
    let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer())
    const mime = file.type.toLowerCase().trim()
    const rule = validateUpload(file.name, mime, bytes)
    if (!rule || bytes.length !== file.size) return NextResponse.json({ error: '対応形式・拡張子・ファイル内容を確認してください' }, { status: 415 })
    try { bytes = await sanitizeImage(bytes, mime) } catch {
      return NextResponse.json({ error: '画像を安全に処理できません。別の画像をお試しください。' }, { status: 415 })
    }
    const uploadId = crypto.randomUUID()
    const storagePath = `rooms/${roomId}/${rule.folder}/${uploadId}.${rule.ext}`
    const { error: reserveError } = await supabaseAdmin.from('attachment_uploads').insert({
      id: uploadId, user_id: user.id, room_id: roomId, bucket: BUCKET, storage_path: storagePath,
      status: 'reserved', mime_type: mime, size_bytes: bytes.length,
    })
    if (reserveError) return NextResponse.json({ error: '添付を準備できません。時間をおいてお試しください。' }, { status: 503 })
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, Buffer.from(bytes), { contentType: mime, upsert: false })
    if (uploadError) {
      await supabaseAdmin.from('attachment_uploads').update({ status: 'failed' }).eq('id', uploadId).eq('status', 'reserved')
      return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 503 })
    }
    const { data: completed, error: completeError } = await supabaseAdmin.from('attachment_uploads')
      .update({ status: 'uploaded', uploaded_at: new Date().toISOString() })
      .eq('id', uploadId).eq('user_id', user.id).eq('status', 'reserved').select('id').maybeSingle()
    if (completeError || !completed) return NextResponse.json({ error: '添付の完了確認に失敗しました。再度お試しください。' }, { status: 503 })
    return NextResponse.json({ ok: true, uploadId, storagePath, mimeType: mime, fileSize: bytes.length })
  } catch {
    return NextResponse.json({ error: 'アップロードを処理できませんでした' }, { status: 500 })
  }
}
