import type { SupabaseClient } from '@supabase/supabase-js'

// No global client, scheduler or production flag: caller must deliberately construct this worker.
export async function cleanupOneExpiredUpload(client: SupabaseClient): Promise<'idle'|'deleted'|'retry'|'needs_review'> {
 try {
  const {data,error}=await client.rpc('mvp_claim_upload_cleanup')
  if(error||!Array.isArray(data)||data.length>1)return 'retry'
  if(data.length===0)return 'idle'
  const row=data[0]
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if(!row||!uuid.test(row.id)||!uuid.test(row.room_id)||!uuid.test(row.cleanup_token)||
   row.bucket!=='room_uploads'||typeof row.storage_path!=='string')return 'needs_review'
  // Accept only the exact server-generated namespace; never infer ownership of legacy paths.
  const prefix='rooms/'+row.room_id+'/'
  const tail=row.storage_path.startsWith(prefix)?row.storage_path.slice(prefix.length):''
  const parts=tail.split('/')
  const file=parts[1]??'',ext=file.slice(row.id.length+1)
  const allowed:Record<string,string[] >= {images:['png','jpg','gif','webp'],videos:['mp4','webm'],files:['pdf','txt']}
  if(parts.length!==2||!file.startsWith(row.id+'.')||!allowed[parts[0]]?.includes(ext))return 'needs_review'
  const {error:removeError}=await client.storage.from('room_uploads').remove([row.storage_path])
  // Do not interpret arbitrary 404/transport errors as proven success.
  if(removeError)return 'retry'
  const {error:finishError}=await client.rpc('mvp_finish_upload_cleanup',{p_id:row.id,p_token:row.cleanup_token})
  return finishError?'retry':'deleted'
 }catch{return 'retry'}
}
