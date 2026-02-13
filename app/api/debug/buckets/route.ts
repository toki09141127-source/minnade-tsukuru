import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await admin.storage.listBuckets()

  if (error) {
    return NextResponse.json(
      { ok: false, url, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    url,
    buckets: (data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      public: b.public,
    })),
  })
}
