import {notFound} from 'next/navigation'
import {v2Enabled} from '@/lib/v2/server'
import {uuid} from '@/lib/v2/domain'
import Work from '@/app/components/v2/Work'
export const dynamic='force-dynamic'
export default async function PublicLog({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!v2Enabled()||!uuid(id))notFound();return <Work roomId={id} logOnly/>}
