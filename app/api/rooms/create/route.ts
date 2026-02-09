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
  'その他',
] as const

function toBool(v: any) {
  if (v === true) return true
  if (v === false) return false
  if (typeof v === 'string') return v.toLowerCase() === 'true'
  if (typeof v === 'number') return v === 1
  return false
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const title = String(body?.title ?? '').trim()
    const type = String(body?.type ?? 'novel').trim()
    const categoryRaw = String(body?.category ?? 'その他').trim()
    const category = (CATEGORY_VALUES as readonly string[]).includes(categoryRaw) ? categoryRaw : 'その他'
    const isAdult = toBool(body?.isAdult)

    const hoursNum = Number(body?.hours ?? 48)
    const hours = Math.max(1, Math.min(150, Math.floor(hoursNum)))

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const user = userData.user

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const now = new Date()
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000)

    const { data: room, error: insErr } = await admin
      .from('rooms')
      .insert({
        title,
        type,
        category,
        is_adult: isAdult,
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
