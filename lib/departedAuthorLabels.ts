import type { SupabaseClient } from '@supabase/supabase-js'

// Fail closed: do not render a stale linked username when the attribution lookup fails.
export async function departedAuthorLabels(client: SupabaseClient, ids: string[]) {
  const labels = new Map<string, string>()
  const unique = [...new Set(ids)]
  for (let i=0;i<unique.length;i+=200) {
    const {data,error}=await client.rpc('mvp_departed_author_labels',{p_actors:unique.slice(i,i+200)})
    if(error || !Array.isArray(data)) throw new Error('AUTHOR_LABELS_UNAVAILABLE')
    for(const row of data) {
      if(typeof row.actor_id!=='string' || typeof row.public_name!=='string')
        throw new Error('AUTHOR_LABELS_INVALID')
      labels.set(row.actor_id,row.public_name)
    }
  }
  return labels
}
