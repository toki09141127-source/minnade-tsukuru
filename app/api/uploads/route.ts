// app/api/uploads/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'room_uploads'

// 許可MIME
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
])

// 容量制限
const MAX_IMAGE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO = 50 * 1024 * 1024 // 50MB

function safeExtFromName(name: string) {
  const raw = name.split('.').pop()?.toLowerCase() || ''
  // 変な拡張子を防ぐ（最低限）
  if (!/^[a-z0-9]{1,8}$/.test(raw)) return ''
  return raw
}

function extFromMime(mime: string, fallback: string) {
  // mimeから拡張子を寄せる（保険）
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'video/mp4':
      return 'mp4'
    case 'video/webm':
      return 'webm'
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
    // 3) バリデーション（MIME / size）
    // -------------------------
    const mime = String(file.type ?? '').toLowerCase()

    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mime || 'unknown'}` },
        { status: 400 }
      )
    }

    const isImage = mime.startsWith('image/')
    const isVideo = mime.startsWith('video/')

    const max = isImage ? MAX_IMAGE : isVideo ? MAX_VIDEO : 0
    if (!max) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    if (file.size > max) {
      return NextResponse.json(
        { error: isImage ? 'File too large (max 10MB)' : 'File too large (max 50MB)' },
        { status: 400 }
      )
    }

    // -------------------------
    // 4) ルーム存在確認
    // -------------------------
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // -------------------------
    // 5) Storage Path（images/videos に分岐）
    // rooms/{roomId}/images/xxxx.jpg
    // rooms/{roomId}/videos/xxxx.mp4
    // -------------------------
    const folder = isImage ? 'images' : 'videos'
    const nameExt = safeExtFromName(file.name)
    const ext = extFromMime(mime, nameExt)
    const storagePath = `rooms/${roomId}/${folder}/${crypto.randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // -------------------------
    // 6) Upload（private bucket 前提）
    // -------------------------
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false,
      })

    if (upErr) {
      // デバッグ情報（必要最小限）
      const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets()

      return NextResponse.json(
        {
          error: upErr.message,
          debug: {
            bucketTried: BUCKET,
            hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            buckets: bErr
              ? `listBuckets error: ${bErr.message}`
              : (buckets ?? []).map((b) => ({
                  id: b.id,
                  name: b.name,
                  public: b.public,
                })),
          },
        },
        { status: 400 }
      )
    }

    // -------------------------
    // 7) 成功
    // -------------------------
    return NextResponse.json({
      ok: true,
      storagePath,
      mimeType: mime,
      // size: file.size, // 必要ならデバッグ用に返してもOK
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
