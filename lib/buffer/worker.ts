import { planPromotions, validateQueuedPromotion } from './promotionPlanner'
import type { PlannedPromotion, PromotionCandidate, PromotionHistory, PromotionKind } from './promotionPlanner'
import type { createBufferSender } from './sender'

type QueueItem = {
  event_id: string; content_key: string; kind: PromotionKind; due_at: string; body: string; token: string
}
type Snapshot = { now: string; candidates: PromotionCandidate[]; history: PromotionHistory[]; queue: QueueItem[] }
type Rpc = (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
export type RunMode = 'dry-run' | 'enqueue' | 'canary' | 'automatic'
const planned = (q: QueueItem): PlannedPromotion => ({
  eventId: q.event_id, contentKey: q.content_key, kind: q.kind, dueAt: q.due_at, text: q.body,
})

export async function runBuffer(
  rpc: Rpc,
  sender: ReturnType<typeof createBufferSender>,
  mode: RunMode,
  canaryEvent?: string,
  guarded = false,
) {
  const call = async (name: string, args?: Record<string, unknown>) => {
    const r = await rpc(name, args)
    if (r.error) throw new Error('BUFFER_DB_UNAVAILABLE')
    return r.data
  }
  const snapshot = () => call('buffer_snapshot') as Promise<Snapshot>
  const initial = await snapshot()
  let plan = planPromotions(initial.candidates, initial.history, initial.now)
  // Canary only reserves/claims the one operator-selected stable event.
  if (mode === 'canary') {
    if (!canaryEvent) throw new Error('CANARY_NOT_CONFIGURED')
    plan = planPromotions(initial.candidates.filter(c => c.id === canaryEvent), initial.history, initial.now)
  }
  if (mode === 'dry-run') {
    const checks = [...plan, ...initial.queue.map(planned)].map(p =>
      validateQueuedPromotion(initial.candidates.find(c => c.id === p.eventId), p, initial.now))
    return { mode, candidates: initial.candidates.length, planned: plan.length,
      queued: initial.queue.length, preSendEligible: checks.filter(Boolean).length, writes: 0, sends: 0 }
  }
  const reserved = await call('buffer_reserve', { p_plan: plan })
  if (mode === 'enqueue') return { mode, reserved, sends: 0 }
  const q = await call('buffer_claim', { p_event: mode === 'canary' ? canaryEvent : null }) as QueueItem | null
  if (!q) return { mode, reserved, sends: 0 }
  const finish = async (state: string, code: string, id?: string, dueAt?: string) => {
    const saved = await call('buffer_finish', {
      p_event: q.event_id, p_token: q.token, p_state: state, p_code: code,
      p_id: id ?? null, p_due: dueAt ?? null,
    })
    if (saved !== true) throw new Error('BUFFER_RECEIPT_NOT_SAVED')
    return { mode, reserved, state, code }
  }
  // Everything before send() can be retried safely. An interrupted claim is unknown.
  try {
    if (!await sender.preflight()) return await finish('failed', 'PRECHECK_FAILED')
    // Read again AFTER network preflight so the final safety snapshot is fresh.
    const fresh = await snapshot(), p = planned(q)
    if (!validateQueuedPromotion(fresh.candidates.find(c => c.id === q.event_id), p, fresh.now)) {
      return await finish('cancelled', 'SOURCE_CHANGED')
    }
    // Refuse late scheduling even if network preflight used up the available window.
    if (Date.parse(p.dueAt) <= Date.now() + 60_000) return await finish('cancelled', 'SOURCE_CHANGED')
  } catch {
    // DB unavailable leaves 'sending'; stale-claim recovery marks unknown, never reclaims.
    throw new Error('BUFFER_PRECHECK_OR_PERSISTENCE_FAILED')
  }
  if (guarded && await call('buffer_send_guard', { p_event: q.event_id, p_token: q.token }) !== true) {
    return finish('cancelled', 'SOURCE_CHANGED')
  }
  const outcome = await sender.send(planned(q))
  // Receipt-save failure must propagate without repeating the mutation.
  return finish(outcome.state, outcome.code, outcome.id, outcome.dueAt)
}
