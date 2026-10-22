import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ ok: false, error: 'この旧APIは終了しました。プロフィール画面を再読み込みしてください。' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } })
}
