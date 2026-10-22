import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeletionJob } from './accountDeletion'

export async function deletionRpc(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(error.message === 'DELETION_PAUSED' ? 'DELETION_PAUSED' : 'DELETION_DATABASE_UNAVAILABLE')
  return data
}
export async function deletionCheckpoint(client: SupabaseClient, job: DeletionJob, phase: string) {
  await deletionRpc(client, 'mvp_deletion_checkpoint', { p_id: job.id, p_lease: job.lease, p_phase: phase })
}
export async function deletionEffect(client: SupabaseClient, job: DeletionJob,
  effect: 'storage_delete' | 'auth_delete', uploadId: string | null, action: () => Promise<void>) {
  const id = await deletionRpc(client, 'mvp_begin_deletion_effect', {
    p_id: job.id, p_lease: job.lease, p_effect: effect, p_upload: uploadId,
  })
  if (typeof id !== 'string') throw new Error('DELETION_EFFECT_INVALID')
  let success = false
  try { await action(); success = true }
  finally {
    // Recording an already dispatched result is allowed while paused. Failure leaves a visible in-flight record.
    await deletionRpc(client, 'mvp_end_deletion_effect', {
      p_id: job.id, p_lease: job.lease, p_effect_id: id, p_success: success,
    })
  }
}
