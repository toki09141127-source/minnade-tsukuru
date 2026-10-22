import { timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fixed official channel. This endpoint never creates posts.
const channelId = '6ad9a93b778b240e2f8816f0'
const query = 'query BufferConnectionCheck { channel(input: { id: "6ad9a93b778b240e2f8816f0" }) { id name service isDisconnected isLocked isQueuePaused } }'

function result(status: number, code: string, ok = false) {
  return Response.json({ ok, code }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return result(503, 'CHECK_NOT_CONFIGURED')
  const supplied = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from('Bearer ' + secret)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return result(401, 'UNAUTHORIZED')
  }
  const key = process.env.BUFFER_API_KEY
  if (!key) return result(503, 'BUFFER_NOT_CONFIGURED')
  try {
    const response = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ query }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 401 || response.status === 403) return result(502, 'BUFFER_ACCESS_DENIED')
    if (response.status === 429) return result(503, 'BUFFER_RATE_LIMITED')
    if (!response.ok) return result(502, 'BUFFER_UNAVAILABLE')
    // Never return upstream errors or payloads; they may contain sensitive data.
    const body = await response.json()
    if (!body || (body.errors !== undefined && (!Array.isArray(body.errors) || body.errors.length > 0))) {
      return result(502, 'BUFFER_QUERY_FAILED')
    }
    const channel = body.data?.channel
    if (!channel || channel.id !== channelId || channel.service !== 'twitter' ||
        typeof channel.name !== 'string' || channel.name.replace(/^@/, '').toLowerCase() !== 'minnade_tsukuru') {
      return result(502, 'BUFFER_CHANNEL_MISMATCH')
    }
    if (channel.isDisconnected !== false || channel.isLocked !== false) return result(503, 'BUFFER_CHANNEL_UNAVAILABLE')
    if (channel.isQueuePaused !== false) return result(503, 'BUFFER_QUEUE_PAUSED')
    return result(200, 'BUFFER_CONNECTED', true)
  } catch {
    return result(502, 'BUFFER_CHECK_FAILED')
  }
}

