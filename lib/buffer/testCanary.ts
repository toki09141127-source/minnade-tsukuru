import { BUFFER_TEST_BODY, BUFFER_CANCEL_TEST_BODY, validateTestCanary } from './promotionPlanner'
import type { PromotionCandidate, PlannedPromotion } from './promotionPlanner'
import type { createBufferSender } from './sender'

type Rpc = (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
type TestSnapshot = {
  snapshot: { now: string; candidates: PromotionCandidate[] }
  authorization: { enabled: boolean; event_id: string; room_id: string; due_at: string; body: string } | null
  receipt: { state: string } | null
}
/** Not called by cron. Requires a separately seeded, single TEST authorization. */
export async function runTestCanary(rpc: Rpc, sender: ReturnType<typeof createBufferSender>, dryRun = true, hold = false, manual = false) {
  const call = async (name: string, args?: Record<string, unknown>) => {
    const r = await rpc(name, args)
    if (r.error) throw new Error('CANARY_DB_UNAVAILABLE')
    return r.data
  }
  const load = () => call('buffer_test_snapshot') as Promise<TestSnapshot>
  const initial = await load(), a = initial.authorization
  if (!a || !a.enabled || ![BUFFER_TEST_BODY, BUFFER_CANCEL_TEST_BODY].includes(a.body)) throw new Error('CANARY_NOT_AUTHORIZED')
  const p: PlannedPromotion = {
    eventId: a.event_id, contentKey: 'completed:' + a.room_id, kind: 'completed', dueAt: a.due_at, text: a.body,
  }
  const eligible = (s: TestSnapshot) => s.authorization?.event_id === a.event_id &&
    s.authorization?.due_at === a.due_at && s.authorization?.body === a.body &&
    s.authorization?.enabled === true &&
    validateTestCanary(s.snapshot.candidates.find(c => c.id === a.event_id), p, s.snapshot.now)
  if (dryRun) return { mode: 'dry-run', eligible: eligible(initial), existing: !!initial.receipt, writes: 0, sends: 0 }
  if (initial.receipt && !['queued', 'failed'].includes(initial.receipt.state)) return { mode: 'canary', sends: 0, state: initial.receipt.state }
  if (!eligible(initial)) throw new Error('CANARY_INELIGIBLE')
  // Check the real channel before creating any persistent queue reservation.
  if (!await sender.preflight()) throw new Error('CANARY_CHANNEL_UNVERIFIED')
  await call('buffer_reserve_test')
  const q = await call(manual ? 'buffer_claim_test' : 'buffer_claim', { p_event: a.event_id }) as { token: string; body: string; due_at: string } | null
  if (!q) return { mode: 'canary', sends: 0 }
  const finish = async (state: string, code: string, id?: string, due?: string) => {
    const saved = await call('buffer_finish', { p_event: a.event_id, p_token: q.token, p_state: state, p_code: code, p_id: id ?? null, p_due: due ?? null })
    if (saved !== true) throw new Error('CANARY_RECEIPT_UNSAVED')
    return { mode: 'canary', state, code }
  }
  const fresh = await load()
  if (!eligible(fresh) || q.body !== p.text || Date.parse(q.due_at) !== Date.parse(p.dueAt) ||
      Date.parse(p.dueAt) < Date.now() + 60_000) return finish('cancelled', 'SOURCE_CHANGED')
  const result = await sender.send(p, hold)
  return finish(result.state, result.code, result.id, result.dueAt)
}
