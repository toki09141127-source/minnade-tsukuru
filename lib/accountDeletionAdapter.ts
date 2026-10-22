import { deletionRpc, deletionCheckpoint, deletionEffect } from './accountDeletionControl'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeletionJob, DeletionPorts, DeletionStage } from './accountDeletion'

// No global admin client import: only a deliberately constructed worker may use this.
export type PreparationReceipt = {
  jobId: string
  actorId: string
  writesBlocked: boolean
  retainedWorksVerified: boolean
  attributionApplied: boolean
  foreignKeysVerified: boolean
  storageReadyForAuthDeletion: boolean
}
export interface DeletionPreparation {
  // Must be durable/idempotent and verify the same job/actor on retries.
  prepare(job: DeletionJob): Promise<PreparationReceipt | null>
  verify(job: DeletionJob): Promise<PreparationReceipt | null>
  finalize(job: DeletionJob): Promise<boolean>
}
const stages: DeletionStage[] = ['requested','prepared','auth_unknown','auth_deleted','completed','needs_review']
function validReceipt(job: DeletionJob, receipt: PreparationReceipt | null) {
  return receipt?.jobId===job.id && receipt.actorId===job.actorId &&
    receipt.writesBlocked===true && receipt.retainedWorksVerified===true &&
    receipt.attributionApplied===true && receipt.foreignKeysVerified===true &&
    receipt.storageReadyForAuthDeletion===true
}
export function createAccountDeletionPorts(
  client: SupabaseClient, preparation: DeletionPreparation
): DeletionPorts {
  let current: DeletionJob | null = null
  const rpc = (name: string, args: Record<string, unknown>) => deletionRpc(client, name, args)
  const renew = async (job: DeletionJob) => {
    await rpc('mvp_renew_deletion',{p_id:job.id,p_lease:job.lease,p_expected:job.stage})
  }
  const guarded = async (actorId: string) => {
    if(!current || current.actorId!==actorId || current.stage!=='auth_unknown')
      throw new Error('DELETION_CONTEXT_MISMATCH')
    await renew(current)
    if(!validReceipt(current,await preparation.verify(current)))
      throw new Error('DELETION_PREPARATION_NOT_VERIFIED')
    await renew(current)
  }
  return {
    async claim(id) {
      const rows=await rpc('mvp_claim_deletion',{p_id:id})
      if(Array.isArray(rows) && rows.length===0) return null
      if(!Array.isArray(rows) || rows.length!==1) throw new Error('DELETION_JOB_INVALID')
      const row=rows[0]
      if(row.id!==id || typeof row.actor_id!=='string' || !row.actor_id ||
        typeof row.lease_token!=='string' || !row.lease_token || !stages.includes(row.stage))
        throw new Error('DELETION_JOB_INVALID')
      current={id:row.id,actorId:row.actor_id,stage:row.stage,lease:row.lease_token}
      return current
    },
    async prepare(job) {
      await deletionCheckpoint(client, job, 'prepare')
      await renew(job)
      const receipt=await preparation.prepare(job)
      await deletionCheckpoint(client, job, 'after_prepare')
      await renew(job)
      return validReceipt(job,receipt)?'prepared':'needs_review'
    },
    async authExists(actorId) {
      await guarded(actorId)
      await deletionCheckpoint(client, current!, 'auth_lookup')
      const {data,error}=await client.auth.admin.getUserById(actorId)
      // Only the SDK's explicit user-not-found response proves absence.
      if(error) {
        if(error.status===404 && error.code==='user_not_found') return false
        throw new Error('DELETION_AUTH_LOOKUP_UNAVAILABLE')
      }
      if(!data.user || data.user.id!==actorId) throw new Error('DELETION_AUTH_LOOKUP_INVALID')
      return true
    },
    async deleteAuth(actorId) {
      await guarded(actorId)
      await deletionEffect(client, current!, 'auth_delete', null, async () => {
        const {error}=await client.auth.admin.deleteUser(actorId,false)
        if(error) throw new Error('DELETION_AUTH_RESULT_UNKNOWN')
      })
    },
    async finalize(job) {
      await deletionCheckpoint(client, job, 'finalize')
      await renew(job)
      if(!validReceipt(job,await preparation.verify(job))) return false
      const done=await preparation.finalize(job)
      await renew(job)
      return done===true
    },
    async advance(job,next) {
      await deletionCheckpoint(client, job, 'advance')
      await rpc('mvp_advance_deletion',{p_id:job.id,p_lease:job.lease,p_expected:job.stage,p_next:next})
    },
    async release(job) {
      await rpc('mvp_release_deletion',{p_id:job.id,p_lease:job.lease})
      current=null
    },
  }
}
// Until FK/Trigger/Storage audit has been reconciled, no retention side effect is allowed.
export const unauditedDeletionPreparation: DeletionPreparation = {
  async prepare(){return null},
  async verify(){return null},
  async finalize(){return false},
}
