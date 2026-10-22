import { limitAction } from '../../../../lib/apiGuards'
// app/api/rooms/create/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeAiLevel } from '@/lib/aiLevel' // ← パスはあなたの構成に合わせて調整

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

const WORK_TYPE_DEFAULT = 'room'
const MAX_CONCEPT_LENGTH = 300

function normalizeInviteCode(raw: unknown) {
  return String(raw ?? '').trim().toUpperCase()
}

function isValidInviteCode(code: string) {
  if (!code) return false
  if (code.length < 6 || code.length > 32) return false
  if (!/^[A-Z0-9]+$/.test(code)) return false
  return true
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const title = String(body?.title ?? '').trim()

    const categoryRaw = String(body?.category ?? 'その他').trim()
    const category = (CATEGORY_VALUES as readonly string[]).includes(categoryRaw)
      ? categoryRaw
      : 'その他'

    const isAdult = Boolean(body?.isAdult ?? body?.is_adult ?? false)
    const conceptRaw = String(body?.concept ?? '').trim()

    const hoursNum = Number(body?.hours ?? 48)
    const hours = Math.max(1, Math.min(150, Math.floor(hoursNum)))

    // ✅ AIレベル（未指定/不正はDB defaultと同じ "assist"）
    // 互換：ai_level を正としつつ、aiLevel も拾う
    const aiLevel = normalizeAiLevel(body?.ai_level ?? body?.aiLevel, 'assist')

    // ✅ core参加方式
    const enableCoreApproval =
      body?.enable_core_approval === undefined ? false : Boolean(body?.enable_core_approval)

    const enableCoreInvite = Boolean(body?.enable_core_invite ?? false)
    const coreInviteCode = enableCoreInvite ? normalizeInviteCode(body?.core_invite_code) : null

    if (!Number.isFinite(hoursNum)) return NextResponse.json({ ok: false, error: '期限が不正です' }, { status: 400 })
    if (title.length > 120) return NextResponse.json({ ok: false, error: 'タイトルは120文字以内で入力してください' }, { status: 400 })
    if (!title) {
      return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
    }

    if (conceptRaw.length > MAX_CONCEPT_LENGTH) {
      return NextResponse.json(
        { ok: false, error: 'コンセプトは300文字以内で入力してください' },
        { status: 400 }
      )
    }

    if (enableCoreInvite) {
      if (!coreInviteCode || !isValidInviteCode(coreInviteCode)) {
        return NextResponse.json(
          { ok: false, error: '招待コードが不正です（英数字・6〜32文字）' },
          { status: 400 }
        )
      }
    }

    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // token検証（anonでOK）
    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    const user = userData.user
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const limited = await limitAction(admin, user.id, 'rooms')
    if (limited) return limited

    if(process.env.MVP_ROOM_CREATION_ENABLED==='true'){
      if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId))
        return NextResponse.json({ok:false,error:'作成画面を再読み込みしてください'},{status:400})
      const {data:id,error}=await admin.rpc('mvp_create_room',{p_actor:user.id,p_request:body.requestId,p_settings:{
        title,category,is_adult:isAdult,time_limit_hours:hours,work_type:String(body?.workType ?? body?.work_type ?? WORK_TYPE_DEFAULT),
        concept:conceptRaw||null,ai_level:aiLevel,enable_core_approval:enableCoreApproval,
        enable_core_invite:enableCoreInvite,core_invite_code:coreInviteCode,
      }})
      if(error||typeof id!=='string')return NextResponse.json({ok:false,error:'作成結果を確認できません。同じ内容で再試行してください'},{status:409,headers:{'Cache-Control':'no-store'}})
      return NextResponse.json({ok:true,room:{id}},{headers:{'Cache-Control':'no-store'}})
    }
    return NextResponse.json({ok:false,error:'現在この機能は利用できません。時間をおいてお試しください。'}, {status:503,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ ok: false, error: '処理に失敗しました。時間をおいてお試しください' }, { status: 500 })
  }
}
