import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export function databaseGuardsEnabled() {
  return process.env.MVP_DB_GUARDS_ENABLED === 'true'
}

export async function limitAction(admin: SupabaseClient, actor: string, action: string) {
  if (!databaseGuardsEnabled()) return NextResponse.json({error:'現在この機能は利用できません'}, {status:503,headers:{'Cache-Control':'no-store'}})
  const { data, error } = await admin.rpc('mvp_take_rate_limit', { p_actor: actor, p_action: action })
  if (error) return NextResponse.json({ error: '現在この操作を利用できません。時間をおいてお試しください。' }, { status: 503, headers: { 'Cache-Control':'no-store' } })
  if (data !== true) return NextResponse.json({ error: '操作が多すぎます。時間をおいてお試しください。' },
    { status: 429, headers: { 'Cache-Control':'no-store', 'Retry-After': ['rooms','account'].includes(action) ? '3600' : '60' } })
  return null
}
