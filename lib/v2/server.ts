import { createClient } from '@supabase/supabase-js'
export function v2Enabled(){return process.env.V2_ENABLED==='true' && process.env.NEXT_PUBLIC_SUPABASE_URL==='https://fwqucffxdmbdczspkcyr.supabase.co'}
export function v2Client(req:Request){const token=req.headers.get('authorization');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:token?{Authorization:token}:{}}})}
