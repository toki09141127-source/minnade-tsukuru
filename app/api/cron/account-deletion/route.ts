import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resumeAccountDeletion } from '@/lib/accountDeletion'
import { createAccountDeletionPorts } from '@/lib/accountDeletionAdapter'
import { createFinalDeletionPreparation } from '@/lib/accountDeletionPreparation'

export const dynamic = 'force-dynamic'

// Explicitly invoked worker only. No automatic schedule or production flag is configured here.
export async function POST(req: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const secret = process.env.CRON_SECRET
  if (!secret || process.env.MVP_ACCOUNT_FINALIZE_ENABLED !== 'true')
    return NextResponse.json({ ok: false, error: '退会処理は停止中です' }, { status: 503, headers })
  if (req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers })
  const body = await req.json().catch(() => null)
  if (typeof body?.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId))
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400, headers })
  const state = await resumeAccountDeletion(body.requestId,
    createAccountDeletionPorts(supabaseAdmin, createFinalDeletionPreparation(supabaseAdmin)))
  return NextResponse.json({ ok: state === 'completed', state },
    { status: state === 'completed' ? 200 : 202, headers })
}

