// app/api/uploads/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'room_uploads'
const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_PREFIX = 'image/' // まず画像だけ

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

    // --- multipart ---
    const form = await req.formData()
    const roomId = String(form.get('roomId') ?? '').trim()
    const file = form.get('file')

    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })
    }

    if (!file.type || !file.type.startsWith(ALLOWED_PREFIX)) {
      return NextResponse.json({ ok: false, error: 'Only image files are allowed' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'File is too large (max 10MB)' }, { status: 400 })
    }

    // ✅ 1) ルーム存在 & open
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr || !room) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })
    if (room.status !== 'open') {
      return NextResponse.json({ ok: false, error: `room is ${room.status}` }, { status: 400 })
    }

    // ✅ 2) 参加者チェック
    const { data: mem } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!mem) return NextResponse.json({ ok: false, error: 'not a member' }, { status: 403 })

    // ✅ 3) upload（service_role）
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const safeExt = ext.replace(/[^a-z0-9]/g, '')
    const filename = `${crypto.randomUUID()}.${safeExt}`
    const storagePath = `rooms/${roomId}/${user.id}/${Date.now()}_${filename}`

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
    }

    // 返す（投稿APIで attachment_url/type に入れる用）
    return NextResponse.json({
      ok: true,
      storagePath,
      mimeType: file.type,
      size: file.size,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
