import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeletionPreparation } from './accountDeletionAdapter'

// Only the recovery snapshot is implemented here. Never certify FK, write-fence,
// Storage or public attribution readiness merely because a backup was saved.
export function createRetentionSnapshotPreparation(client: SupabaseClient): DeletionPreparation {
  return {
    async prepare(job) {
      const { data, error } = await client.rpc('mvp_snapshot_deletion_history', {
        p_id: job.id, p_lease: job.lease,
      })
      if (error || typeof data !== 'number' || !Number.isSafeInteger(data) || data < 0)
        throw new Error('RETENTION_SNAPSHOT_UNAVAILABLE')
      return null // Persisted snapshot is not completed retention/anonymization.
    },
    async verify() { return null },
    async finalize() { return false },
  }
}
