import { validateScheduledPromotion } from './promotionPlanner'
import type { PlannedPromotion, PromotionCandidate } from './promotionPlanner'
import type { createBufferSender } from './sender'
import { runBuffer } from './worker'
import type { RunMode } from './worker'
type Rpc = (name: string, args?: Record<string, unknown>) => PromiseLike<{data: unknown; error: unknown}>
type Delivery = {event_id: string;content_key: string;kind: PlannedPromotion['kind'];due_at: string;body: string;buffer_id: string;delivery_token: string;cancel_requested: boolean;release_started_at?: string|null}
type Control = {enabled: boolean;reason: string}

export async function maintainBuffer(rpc: Rpc, sender: ReturnType<typeof createBufferSender>,
  validate: typeof validateScheduledPromotion = validateScheduledPromotion) {
  const call = async (name: string, args?: Record<string, unknown>) => {
    const r = await rpc(name,args)
    if (r.error) throw Error('BUFFER_DB_UNAVAILABLE')
    return r.data
  }
  const stop = (reason: string) => call('buffer_stop',{p_reason:reason})
  let processed = 0
  // A day has at most two posts. Bound each cron execution; old receipts progress fairly.
  for (let i=0;i<2;i++) {
    const q = await call('buffer_delivery_claim') as Delivery | null
    if (!q) break
    const p: PlannedPromotion = {eventId:q.event_id,contentKey:q.content_key,kind:q.kind,dueAt:q.due_at,text:q.body}
    const finish = async (state: string, sentAt?: string, externalUrl?: string) => {
      const saved = await call('buffer_delivery_finish',{p_event:q.event_id,p_token:q.delivery_token,p_state:state,p_sent:sentAt??null,p_external:externalUrl??null})
      if (saved !== true) { await stop('INTEGRITY'); throw Error('BUFFER_DELIVERY_FENCED') }
      processed++
    }
    try {
      const s = await call('buffer_snapshot') as {now:string;candidates:PromotionCandidate[]}
      const control = await call('buffer_control_state') as Control
      const eligible = validate(s.candidates.find(c=>c.id===q.event_id),p,s.now)
      if (!eligible) await stop('EXCLUDED')
      let mustCancel = q.cancel_requested || !eligible || !control.enabled
      if (mustCancel && !q.cancel_requested) {
        if (await call('buffer_delivery_cancel_mark',{p_event:q.event_id,p_token:q.delivery_token}) !== true) {
          await stop('INTEGRITY'); throw Error('BUFFER_DELIVERY_FENCED')
        }
      }
      const receipt = await sender.inspect(q.buffer_id,p)
      // Unexpected timed schedules are never left unattended in production.
      if (receipt.state === 'scheduled' && !q.release_started_at && !mustCancel) {
        await stop('INTEGRITY')
        mustCancel = true
        if (await call('buffer_delivery_cancel_mark',{p_event:q.event_id,p_token:q.delivery_token}) !== true) throw Error('BUFFER_DELIVERY_FENCED')
      }
      if (receipt.state === 'mismatch') { await stop('ACCOUNT_MISMATCH'); await finish('unknown'); continue }
      if (receipt.state === 'sent') { await finish('sent',receipt.sentAt,receipt.externalUrl); continue }
      if (receipt.state === 'failed') { await finish('failed'); continue }
      if (mustCancel) {
        if (['scheduled','held'].includes(receipt.state) && receipt.cancellable) {
          // Recheck control is intentionally unnecessary: cancellation must run while stopped.
          const cancelled = await sender.cancel(q.buffer_id)
          await finish(cancelled)
        } else { await finish('unknown') }
      } else if (receipt.state === 'held') {
        if (q.release_started_at) { await finish('unknown'); continue }
        if (Date.now() < Date.parse(q.due_at)) { await finish('scheduled'); continue }
        const fresh = await call('buffer_snapshot') as {now:string;candidates:PromotionCandidate[]}
        if (!validate(fresh.candidates.find(c=>c.id===q.event_id),p,fresh.now)) {
          await stop('EXCLUDED')
          await call('buffer_delivery_cancel_mark',{p_event:q.event_id,p_token:q.delivery_token})
          await finish(await sender.cancel(q.buffer_id))
          continue
        }
        if (await call('buffer_release_guard',{p_event:q.event_id,p_token:q.delivery_token}) !== true) {
          await stop('INTEGRITY')
          await call('buffer_delivery_cancel_mark',{p_event:q.event_id,p_token:q.delivery_token})
          await finish(await sender.cancel(q.buffer_id))
          continue
        }
        // Persist intent BEFORE the mutation; any timeout/crash forbids another release.
        await finish(await sender.release(q.buffer_id) === 'released' ? 'waiting' : 'unknown')
      } else if (receipt.state === 'scheduled') {
        if (Date.now() > Date.parse(q.due_at) + 10*60_000) await finish('unknown')
        else await finish('scheduled')
      } else if (receipt.state === 'publishing' && Date.now() <= Date.parse(q.due_at) + 10*60_000) {
        await finish('waiting')
      } else { await finish('pending') }
    } catch {
      await stop('INTEGRITY')
      throw Error('BUFFER_DELIVERY_STOPPED')
    }
  }
  return {processed,control:await call('buffer_control_state') as Control}
}

/** OFF stops new work but never disables cancellation / receipt reconciliation. */
export async function runManagedBuffer(rpc: Rpc,sender: ReturnType<typeof createBufferSender>,mode: RunMode,canaryEvent?: string) {
  if (mode === 'dry-run') return runBuffer(rpc,sender,mode,canaryEvent)
  const maintenance = await maintainBuffer(rpc,sender)
  if (!maintenance.control.enabled) return {mode,stopped:true,reason:maintenance.control.reason,processed:maintenance.processed,sends:0}
  const guardedSender = {...sender, preflight: async () => {
    const ok = await sender.preflight()
    if (!ok) {
      const r = await rpc('buffer_stop',{p_reason:'AUTH_FAILURE'})
      if (r.error) throw Error('BUFFER_STOP_FAILED')
    }
    return ok
  }}
  try {
    const result=await runBuffer(rpc,guardedSender,mode,canaryEvent,true)
    await maintainBuffer(rpc,sender)
    return result
  } catch {
    await rpc('buffer_stop',{p_reason:'INTEGRITY'})
    throw Error('BUFFER_MANAGED_STOPPED')
  }
}
