import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidHttpUrlOrEmpty, normalizeHttpUrlOrEmpty } from '../../../lib/validators/url'

type Body = {
  x_url?: string
  youtube_url?: string
  instagram_url?: string
  tiktok_url?: string
  website_url?: string
}

function getBearerToken(req: Request) {
  const h = req.headers.get('authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m?.[1] ?? null
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req)
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as Body

    // 正規化（前後の空白除去、空は空のまま）
    const payload = {
      x_url: normalizeHttpUrlOrEmpty(body.x_url ?? ''),
      youtube_url: normalizeHttpUrlOrEmpty(body.youtube_url ?? ''),
      instagram_url: normalizeHttpUrlOrEmpty(body.instagram_url ?? ''),
      tiktok_url: normalizeHttpUrlOrEmpty(body.tiktok_url ?? ''),
      website_url: normalizeHttpUrlOrEmpty(body.website_url ?? ''),
    }

    // URLバリデーション（空ならOK）
    for (const [k, v] of Object.entries(payload)) {
      if (!isValidHttpUrlOrEmpty(v)) {
        return NextResponse.json(
          { ok: false, error: `Invalid URL: ${k} must start with http:// or https:// (or empty)` },
          { status: 400 }
        )
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: 'Server env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }

    // ① token検証（Bearer token）
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 })
    }

    const userId = userData.user.id

    // ② profiles更新（サービスロールで実行：RLSの影響を受けにくい）
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .update(payload)
      .eq('id', userId)

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
