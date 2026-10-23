import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export function databaseGuardsEnabled() {
  return process.env.MVP_DB_GUARDS_ENABLED === 'true'
}

export async function limitAction(admin: SupabaseClient, actor: string, action: string) {
  if (!databaseGuardsEnabled()) return NextResponse.json({error:'現在この機能は利用できません'}, {status:503,headers:{'Cache-Control':'no-store'}})
  if(process.env.ADMIN_ENABLED==='true'&&process.env.V2_ENABLED==='true'&&process.env.VERCEL_ENV!=='production'&&process.env.NEXT_PUBLIC_SUPABASE_URL==='https://fwqucffxdmbdczspkcyr.supabase.co'&&!['moderation','account','reports'].includes(action)){
    const feature:Record<string,string>={rooms:'room_creation',posts:'posts',uploads:'uploads',join:'joins'};
    if(feature[action]){const guard=await admin.rpc('v25_check_operation',{p_feature:feature[action],p_actor:actor,p_room:null});if(guard.error||guard.data!==true)return NextResponse.json({error:'この機能は現在停止中、またはこのアカウントでは利用できません。'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
  const { data, error } = await admin.rpc('mvp_take_rate_limit', { p_actor: actor, p_action: action })
  if (error) return NextResponse.json({ error: '現在この操作を利用できません。時間をおいてお試しください。' }, { status: 503, headers: { 'Cache-Control':'no-store' } })
  if (data !== true) return NextResponse.json({ error: '操作が多すぎます。時間をおいてお試しください。' },
    { status: 429, headers: { 'Cache-Control':'no-store', 'Retry-After': ['rooms','account'].includes(action) ? '3600' : '60' } })
  return null
}
