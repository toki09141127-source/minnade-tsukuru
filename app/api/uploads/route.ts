// app/api/uploads/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'room_uploads'

// 容量制限
const MAX_IMAGE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO = 50 * 1024 * 1024 // 50MB
const MAX_FILE = 25 * 1024 * 1024 // 25MB

// 危険な実行系だけブロック
const BLOCKED_EXT = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'sh',
  'js',
  'jar',
  'apk',
])

function safeExtFromName(name: string) {
  const raw = name.split('.').pop()?.toLowerCase() || ''
  if (!/^[a-z0-9]{1,12}$/.test(raw)) return ''
  return raw
}

function extFromMime(mime: string, fallback: string) {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'video/mp4':
      return 'mp4'
    case 'video/webm':
      return 'webm'
    case 'application/pdf':
      return 'pdf'
    case 'text/plain':
      return 'txt'
    case 'application/zip':
      return 'zip'
    case 'application/x-zip-compressed':
      return 'zip'
    default:
      return fallback || 'bin'
  }
}

export async function POST(req: Request) {
  try {
    // -------------------------
    // 1) Auth
    // -------------------------
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = userRes.user

    // -------------------------
    // 2) FormData
    // -------------------------
    const form = await req.formData()
    const roomId = String(form.get('roomId') ?? '').trim()
    const file = form.get('file') as File | null

    if (!roomId || !file) {
      return NextResponse.json({ error: 'roomId and file are required' }, { status: 400 })
    }

    // -------------------------
    // 3) バリデーション（size / ext）
    // -------------------------
    const mime = String(file.type ?? '').toLowerCase().trim()
    const nameExt = safeExtFromName(file.name)

    if (nameExt && BLOCKED_EXT.has(nameExt)) {
      return NextResponse.json(
        { error: `This file type is not allowed: .${nameExt}` },
        { status: 400 }
      )
    }

    const isImage = mime.startsWith('image/')
    const isVideo = mime.startsWith('video/')
    const max = isImage ? MAX_IMAGE : isVideo ? MAX_VIDEO : MAX_FILE

    if (file.size > max) {
      return NextResponse.json(
        {
          error: isImage
            ? 'File too large (max 10MB)'
            : isVideo
            ? 'File too large (max 50MB)'
            : 'File too large (max 25MB)',
        },
        { status: 400 }
      )
    }

    // -------------------------
    // 4) ルーム存在 + 状態確認
    // -------------------------
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) {
      return NextResponse.json({ error: roomErr.message }, { status: 500 })
    }

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    if (room.status !== 'open') {
      return NextResponse.json(
        { error: `This room is ${room.status} and cannot accept uploads` },
        { status: 403 }
      )
    }

    // -------------------------
    // 5) 参加者チェック
    // -------------------------
    const { data: member, error: memberErr } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 })
    }

    if (!member) {
      return NextResponse.json(
        { error: 'You must join the room before uploading' },
        { status: 403 }
      )
    }

    // -------------------------
    // 6) Storage Path
    // -------------------------
    const folder = isImage ? 'images' : isVideo ? 'videos' : 'files'
    const ext = extFromMime(mime, nameExt)
    const storagePath = `rooms/${roomId}/${folder}/${crypto.randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // -------------------------
    // 7) Upload
    // -------------------------
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime || 'application/octet-stream',
        upsert: false,
      })

    if (upErr) {
      console.error('Upload failed:', upErr)
      return NextResponse.json({ error: 'Upload failed' }, { status: 400 })
    }

    // -------------------------
    // 8) 成功
    // -------------------------
    return NextResponse.json({
      ok: true,
      storagePath,
      mimeType: mime || 'application/octet-stream',
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (e: any) {
    console.error('Upload route error:', e)
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}