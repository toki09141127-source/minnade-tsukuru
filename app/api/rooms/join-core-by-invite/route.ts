import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function POST() {
 return NextResponse.json({ok:false,error:'このCore参加経路は終了しました。Member参加後にCreatorへ申請してください。'},
  {status:410,headers:{'Cache-Control':'no-store'}})
}
