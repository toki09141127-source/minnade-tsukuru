// app/api/rooms/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const title = (body?.title as string | undefined)?.trim()
    const category = (body?.category as string | undefined)?.trim() ?? 'その他'
    const audience = (body?.audience as string | undefined)?.trim() ?? 'general'
    const durationMinutes = Number(body?.duration_minutes ?? 60)

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json({ error: 'duration_minutes is invalid' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()

    const { data, error } = await admin
      .from('rooms')
      .insert({
        title,
        category,
        audience, // general / adult
        status: 'open',
        expires_at: expiresAt,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, room: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
