// app/profile/set-bio/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // Auth (Bearer)
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userRes.user.id

    const body = await req.json().catch(() => ({} as any))
    const raw = typeof body?.bio === 'string' ? body.bio : null

    const trimmed = (raw ?? '').trim()
    const value = trimmed.length === 0 ? null : trimmed

    if (value && value.length > 300) {
      return NextResponse.json({ ok: false, error: '紹介文は300文字以内にしてください' }, { status: 400 })
    }

    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .update({ bio: value })
      .eq('id', userId)

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
