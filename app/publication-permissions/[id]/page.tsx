import {enabled,uuid} from '@/lib/rollback-rights/contract'
import Withdrawal from './Withdrawal'
export const dynamic='force-dynamic'
export const metadata={title:'自分の公開許諾の撤回',robots:{index:false,follow:false},referrer:'no-referrer'}
export default async function Page({params}:{params:Promise<{id:string}>}){
  const roomId=(await params).id
  return <main style={{maxWidth:'48rem',margin:'2rem auto',padding:'1rem'}}>
    <h1>自分の公開許諾の撤回</h1>
    {enabled(process.env)&&uuid(roomId)?<Withdrawal key={roomId} roomId={roomId}/>:<p>現在この受付は停止しています。</p>}
  </main>
}
