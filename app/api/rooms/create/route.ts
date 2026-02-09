// app/api/rooms/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const title = (body?.title as string | undefined)?.trim() || '（無題）'
    const kind = (body?.kind as string | undefined)?.trim() || 'novel'
    const is_adult = !!body?.is_adult

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

    // expires_at の決め方は既存ロジックに合わせて（例：48h後）
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: inserted, error: insErr } = await admin
      .from('rooms')
      .insert({
        title,
        kind,
        status: 'open',
        expires_at: expiresAt,
        owner_id: user.id,
        is_adult,
      })
      .select('id')
      .single()

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, roomId: inserted.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
