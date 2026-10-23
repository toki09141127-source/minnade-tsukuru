import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createBufferSender } from '../../../../lib/buffer/sender'
import { runManagedBuffer } from '../../../../lib/buffer/lifecycle'
import type { RunMode } from '../../../../lib/buffer/worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const response = (status: number, value: unknown) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(req: Request) {
  const secret = process.env.BUFFER_CRON_SECRET || process.env.CRON_SECRET
  if (!secret) return response(503, { code: 'BUFFER_DISABLED' })
  const expected = Buffer.from('Bearer ' + secret)
  const supplied = Buffer.from(req.headers.get('authorization') ?? '')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return response(401, { code: 'UNAUTHORIZED' })
  }
  // Request parameters cannot enable sending. Default is read-only.
  const mode = (new URL(req.url).searchParams.get('dryRun') === '1' ? 'dry-run' : (process.env.BUFFER_RUN_MODE ?? 'dry-run')) as RunMode
  if (!['dry-run', 'enqueue', 'canary', 'automatic'].includes(mode)) {
    return response(503, { code: 'INVALID_MODE' })
  }
  // Staging/Preview may inspect the queue but never mutate or contact Buffer/X.
  const sandbox = process.env.VERCEL_ENV === 'preview' || process.env.STAGING_TEST === 'true' || process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://fwqucffxdmbdczspkcyr.supabase.co'
  if (sandbox && mode !== 'dry-run') return response(503, { code: 'STAGING_BUFFER_READ_ONLY' })
  if (mode === 'automatic' && process.env.BUFFER_CANARY_ACCEPTED !== 'true') {
    return response(503, { code: 'CANARY_REQUIRED' })
  }
  if (mode === 'canary' && !process.env.BUFFER_CANARY_EVENT_ID) {
    return response(503, { code: 'CANARY_NOT_CONFIGURED' })
  }
  if (['canary', 'automatic'].includes(mode) && !process.env.BUFFER_API_KEY) {
    return response(503, { code: 'BUFFER_NOT_CONFIGURED' })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return response(503, { code: 'DB_NOT_CONFIGURED' })
  try {
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) },
    })
    const result = await runManagedBuffer((name, args) => client.rpc(name, args),
      createBufferSender(process.env.BUFFER_API_KEY ?? ''), mode, process.env.BUFFER_CANARY_EVENT_ID)
    return response(200, result)
  } catch {
    return response(503, { code: 'BUFFER_RUN_STOPPED' })
  }
}
