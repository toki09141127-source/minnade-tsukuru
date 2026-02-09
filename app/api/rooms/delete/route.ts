// app/api/rooms/delete/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const roomId = String(body?.roomId ?? body?.id ?? '').trim()
    if (!roomId) return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 })

    // --- Auth: Bearer token ---
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // auth client (user lookup)
    const supabaseAuth = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    const user = userData.user

    // admin client (DB ops)
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // ① rooms を取得（host_ids / created_by を見る）
    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('id, created_by, host_ids')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) return NextResponse.json({ ok: false, error: roomErr.message }, { status: 500 })
    if (!room) return NextResponse.json({ ok: false, error: 'room not found' }, { status: 404 })

    // ② room_members も確認（role=host を見る）
    const { data: member, error: memberErr } = await admin
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    // memberErr は「無い」でもよく起きるので、致命エラー以外は握る
    if (memberErr && !/Results contain 0 rows/i.test(memberErr.message)) {
      return NextResponse.json({ ok: false, error: memberErr.message }, { status: 500 })
    }

    const hostIds = Array.isArray((room as any).host_ids) ? ((room as any).host_ids as string[]) : []
    const isHostByHostIds = hostIds.includes(user.id)
    const isHostByCreatedBy = String((room as any).created_by ?? '') === user.id
    const isHostByMemberRole = (member as any)?.role === 'host'

    const isHost = isHostByHostIds || isHostByCreatedBy || isHostByMemberRole
    if (!isHost) return NextResponse.json({ ok: false, error: 'host only' }, { status: 403 })

    // ③ “論理削除” がある設計なら deleted_at を使う（カラムが無ければ物理削除）
    // まず deleted_at が存在するかは環境依存なので、ここは物理削除に寄せるのが安全。
    // ※ もし deleted_at を採用したいなら、rooms に deleted_at を追加してここを書き換える。

    // ④ 関連データ削除（必要なら）
    // room_members / posts / likes などが FK で詰まる場合があるので先に消す
    await admin.from('room_members').delete().eq('room_id', roomId)

    // 投稿テーブル名が posts なら削除（無い環境でもエラーになるので、ここはあなたの構成次第）
    // await admin.from('posts').delete().eq('room_id', roomId)

    // ⑤ rooms 本体削除
    const { error: delErr } = await admin.from('rooms').delete().eq('id', roomId)
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
