// External side effects must only be wired after schema/Storage review.
// This workflow never interprets a network error as an absent Auth user.
export type DeletionStage = 'requested' | 'prepared' | 'auth_unknown' | 'auth_deleted' | 'completed' | 'needs_review'
export type DeletionJob = { id: string; actorId: string; stage: DeletionStage; lease: string }
export interface DeletionPorts {
  claim(id: string): Promise<DeletionJob | null>
  prepare(job: DeletionJob): Promise<'prepared' | 'needs_review'>
  authExists(actorId: string): Promise<boolean>
  deleteAuth(actorId: string): Promise<void>
  finalize(job: DeletionJob): Promise<boolean>
  advance(job: DeletionJob, stage: DeletionStage): Promise<void>
  release(job: DeletionJob): Promise<void>
}
export async function resumeAccountDeletion(id: string, ports: DeletionPorts) {
  let job: DeletionJob | null
  try { job = await ports.claim(id) } catch (error) { return (error as { message?: unknown } | null)?.message === 'DELETION_PAUSED' ? 'paused' as const : 'retry' as const }
  if (!job) return 'busy' as const
  try {
    if (job.stage === 'completed' || job.stage === 'needs_review') return job.stage
    const advance = async (stage: DeletionStage) => {
      await ports.advance(job, stage) // Must compare lease AND expected stage in durable storage.
      job.stage = stage
    }
    if (job.stage === 'requested') {
      const prepared = await ports.prepare(job)
      await advance(prepared)
      if (prepared === 'needs_review') return prepared
    }
    if (job.stage === 'prepared') await advance('auth_unknown')
    if (job.stage === 'auth_unknown') {
      if (await ports.authExists(job.actorId)) await ports.deleteAuth(job.actorId)
      // Confirm absence; HTTP success alone is insufficient.
      if (await ports.authExists(job.actorId)) return 'retry' as const
      await advance('auth_deleted')
    }
    if (job.stage === 'auth_deleted') {
      if (!await ports.finalize(job)) return 'retry' as const
      await advance('completed')
    }
    return job.stage
  } catch (error) {
    return (error as { message?: unknown } | null)?.message === 'DELETION_PAUSED' ? 'paused' as const : 'retry' as const
  } finally {
    // Lease expiry is the recovery path if release itself fails.
    try { await ports.release(job) } catch { /* no raw error logging */ }
  }
}
