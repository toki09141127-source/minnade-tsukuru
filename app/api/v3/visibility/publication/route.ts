import {v2Client} from '@/lib/v2/server'
import {handle,enabled} from '@/lib/rollback-rights/contract'
export const dynamic='force-dynamic'
const route=(req:Request)=>handle(req,enabled(process.env),()=>{
  const client=v2Client(req)
  return {
    authenticated:async()=>{const a=await client.auth.getUser(); return !a.error && !!a.data.user},
    rpc:async(args)=>{const {data,error}=await client.rpc('v3_visibility_20261114',args);return {data,error}},
  }
})
export const GET=route
export const POST=route
