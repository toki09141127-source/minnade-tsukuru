import {NextResponse} from 'next/server'
import {scheduleAi} from '@/lib/ai/worker'
import {v2Enabled} from '@/lib/v2/server'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET
 if(!v2Enabled()||!secret)return NextResponse.json({error:'Unavailable'},{status:503})
 if(req.headers.get('authorization')!=='Bearer '+secret)return NextResponse.json({error:'Unauthorized'},{status:401})
 try{const result=await scheduleAi();await adminEvent('cron_ai_ok');return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}})}
 catch{await adminEvent('cron_failed');return NextResponse.json({error:'AI unavailable; human creation continues'},{status:503})}
}
async function adminEvent(kind:string){if(process.env.ADMIN_ENABLED==='true'){await import('@/lib/admin/server').then(m=>m.adminEvent(kind)).catch(()=>{});}}
