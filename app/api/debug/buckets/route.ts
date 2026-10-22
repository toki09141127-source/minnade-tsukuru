import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Retired unsafe endpoint. Keep an explicit response without constructing an admin client.
export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'This endpoint has been retired' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  )
}
