// app/api/uploads/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

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

    // --- form-data ---
    const form = await req.formData()
    const roomId = String(form.get('roomId') ?? '').trim()
    const file = form.get('file')

    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })
    }

    const mime = file.type || ''
    const size = file.size || 0

    // 制限（まず画像のみ）
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Only image/* is allowed' }, { status: 400 })
    }
    if (size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // --- room exists & member check ---
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr || !room) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })

    const { data: mem } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!mem) return NextResponse.json({ ok: false, error: 'not a member' }, { status: 403 })

    // ファイル名を安全化
    const original = (file.name || 'upload').replace(/[^\w.\-()]/g, '_')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const path = `${roomId}/${user.id}/${ts}_${original}`

    const arrayBuf = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)

    const { error: upErr } = await supabaseAdmin.storage
      .from('room_uploads')
      .upload(path, bytes, {
        contentType: mime,
        upsert: false,
      })

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      storagePath: path,
      mimeType: mime,
      sizeBytes: size,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'server error' }, { status: 500 })
  }
}
