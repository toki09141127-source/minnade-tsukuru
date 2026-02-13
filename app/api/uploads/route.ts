// app/api/uploads/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'room_uploads'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

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

    const { data: userRes, error: userErr } =
      await supabaseAdmin.auth.getUser(token)

    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = userRes.user

    // -------------------------
    // 2) FormData取得
    // -------------------------
    const form = await req.formData()
    const roomId = String(form.get('roomId') ?? '').trim()
    const file = form.get('file') as File | null

    if (!roomId || !file) {
      return NextResponse.json(
        { error: 'roomId and file are required' },
        { status: 400 }
      )
    }

    // -------------------------
    // 3) バリデーション
    // -------------------------
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
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
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // -------------------------
    // 5) Storage Path生成
    // -------------------------
    const ext = file.name.split('.').pop() ?? 'png'
    const storagePath = `${roomId}/${user.id}/${crypto.randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // -------------------------
    // 6) Upload
    // -------------------------
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (upErr) {
      // 🔥 デバッグ情報を返す（原因確定用）
      const { data: buckets, error: bErr } =
        await supabaseAdmin.storage.listBuckets()

      return NextResponse.json(
        {
          error: upErr.message,
          debug: {
            bucketTried: BUCKET,
            envUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
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
      mimeType: file.type,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Server error' },
      { status: 500 }
    )
  }
}
