// app/api/rooms/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CATEGORY_VALUES = [
  '小説',
  '漫画',
  'アニメ',
  'ゲーム',
  'イラスト',
  '企画',
  '雑談',
  'その他',
] as const

function categoryToWorkType(category: string) {
  switch (category) {
    case '小説':
      return 'novel'
    case '漫画':
      return 'manga'
    case 'アニメ':
      return 'anime'
    case 'ゲーム':
      return 'game'
    case 'イラスト':
      return 'illustration'
    case '企画':
      return 'plan'
    case '雑談':
      return 'chat'
    default:
      return 'other'
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const title = String(body?.title ?? '').trim()
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const categoryRaw = String(body?.category ?? 'その他').trim()
    const category = (CATEGORY_VALUES as readonly string[]).includes(categoryRaw) ? categoryRaw : 'その他'

    const isAdult = Boolean(body?.isAdult ?? body?.is_adult ?? false)

    // ★ hours: 1〜150
    const hoursNum = Number(body?.hours ?? 48)
    const hours = Math.max(1, Math.min(150, Math.floor(hoursNum)))

    // --- Auth: Bearer token ---
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const user = userData.user

    // --- Admin (service role) ---
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const now = new Date()
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000)

    // ★ DB必須の work_type
    const workType = String(body?.workType ?? body?.work_type ?? '').trim() || categoryToWorkType(category)

    const { data: room, error: insErr } = await admin
      .from('rooms')
      .insert({
        title,
        category,
        is_adult: isAdult,

        // ★ 必須（NOT NULL）
        work_type: workType,

        // ★ 必須（NOT NULL）
        time_limit_hours: hours,

        // 既存
        status: 'open',
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        host_ids: [user.id],
        is_hidden: false,
        deleted_at: null,
      })
      .select('*')
      .single()

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, room })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
