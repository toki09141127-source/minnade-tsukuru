// app/api/storage/sign/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'room_uploads'
const EXPIRES_IN = 60 * 5 // 5分

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const path = (body?.path as string | undefined)?.trim()

    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    // 最低限の安全策
    if (path.includes('..')) {
      return NextResponse.json({ error: 'invalid path' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, EXPIRES_IN)

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? 'failed to sign url' },
        { status: 500 }
      )
    }

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch {
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}