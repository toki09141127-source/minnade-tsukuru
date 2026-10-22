import {NextResponse} from 'next/server'
import {scheduleAi} from '@/lib/ai/worker'
import {v2Enabled} from '@/lib/v2/server'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET
 if(!v2Enabled()||!secret)return NextResponse.json({error:'Unavailable'},{status:503})
 if(req.headers.get('authorization')!=='Bearer '+secret)return NextResponse.json({error:'Unauthorized'},{status:401})
 try{return NextResponse.json(await scheduleAi(),{headers:{'Cache-Control':'no-store'}})}
 catch{return NextResponse.json({error:'AI unavailable; human creation continues'},{status:503})}
}