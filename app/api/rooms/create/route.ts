// app/api/rooms/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CATEGORY_VALUES = [
  '小説',
  '漫画',
  'アニメ',
  'ゲーム',
  'イラスト',
  '音楽',
  '動画',
  '企画',
  '雑談',
  'その他',
] as const

// DB側の work_type に合わせる（あなたのテーブル制約に応じて調整OK）
const WORK_TYPE_DEFAULT = 'room' // 例: 'room' / 'collab' など。DBのenum/制約に合わせて

export async function POST(req: Request) {
  try {
    // ルーム作成は client から JSON を飛ばしてる想定
    const body = await req.json().catch(() => ({}))

    const title = String(body?.title ?? '').trim()
    const categoryRaw = String(body?.category ?? 'その他').trim()
    const category = (CATEGORY_VALUES as readonly string[]).includes(categoryRaw) ? categoryRaw : 'その他'
    const isAdult = Boolean(body?.isAdult ?? body?.is_adult ?? false)

    const hoursNum = Number(body?.hours ?? 48)
    const hours = Math.max(1, Math.min(150, Math.floor(hoursNum)))

    if (!title) return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })

    // --- Auth: Bearer token ---
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    const user = userData.user

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const now = new Date()
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000)

    // rooms テーブルの NOT NULL 制約に合わせて、必要カラムを全部入れる
    // ※ ここはあなたの rooms テーブルの実カラムに合わせて最終調整してOK
    const insertPayload: any = {
      title,
      category,
      is_adult: isAdult,
      status: 'open',
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
      host_ids: [user.id],
      is_hidden: false,
      deleted_at: null,

      // ここが今回のポイント（NOT NULL 対策）
      time_limit_hours: hours,
      work_type: String(body?.workType ?? body?.work_type ?? WORK_TYPE_DEFAULT),
    }

    const { data: room, error: insErr } = await admin
      .from('rooms')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

    // 作成者を host として room_members に登録（host only 対策）
    const { error: memberErr } = await admin
      .from('room_members')
      .upsert(
        {
          room_id: room.id,
          user_id: user.id,
          role: 'host',
          joined_at: now.toISOString(),
          left_at: null,
        },
        { onConflict: 'room_id,user_id' }
      )

    if (memberErr) return NextResponse.json({ ok: false, error: memberErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, room })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
