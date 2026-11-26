'use client'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '@/lib/supabase/client'
import {rights,revokeResult,type Grant,type Revoke} from '@/lib/rollback-rights/contract'
const endpoint='/api/v3/visibility/publication'
export default function Withdrawal({roomId}:{roomId:string}){
  const [items,setItems]=useState<Grant[]|null>(null), [reviewed,review]=useState(false), [busy,setBusy]=useState(false),[status,setStatus]=useState('')
  const actor=useRef<string|null>(null), epoch=useRef(0), pending=useRef<Revoke|null>(null), running=useRef(false)
  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      const next=session?.user.id??null
      if(actor.current===next)return
      actor.current=next; ++epoch.current; pending.current=null; running.current=false
      setItems(null);review(false);setBusy(false);setStatus('')
    })
    return()=>{++epoch.current;subscription.unsubscribe()}
  },[])
  async function operate(item?:Grant){
    if(running.current)return
    running.current=true;setBusy(true);setStatus('')
    const n=epoch.current
    try{
      const session=(await supabase.auth.getSession()).data.session
      if(!session||epoch.current!==n||actor.current!==session.user.id){if(epoch.current===n)setStatus('ログインしてからこの画面を開き直してください。');return}
      const headers={Authorization:'Bearer '+session.access_token}
      if(item){
        if(!reviewed||!item.canRevoke)return
        const p:Revoke=pending.current??{action:'revoke',roomId,requestId:crypto.randomUUID(),previewHash:item.previewHash,reviewed:true,itemId:item.id}
        if(p.previewHash!==item.previewHash||p.itemId!==item.id)return
        pending.current=p
        const result=await fetch(endpoint,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(p),cache:'no-store'})
        if(epoch.current!==n)return
        const outcome=result.ok?revokeResult(await result.json(),p):null
        if(epoch.current!==n)return
        if(!outcome){setStatus('撤回の結果が確認できません。同じ項目で再試行できます。');return}
        pending.current=null;review(false);setItems(null)
        setStatus(outcome==='revoked'?'撤回を受け付けました。':'撤回を確認中です。')
        return
      }
      const result=await fetch(endpoint+'?'+new URLSearchParams({view:'rights',roomId}),{headers,cache:'no-store'})
      if(epoch.current!==n)return
      const data=result.ok?rights(await result.json(),roomId):null
      if(epoch.current!==n)return
      setItems(data)
      if(!data)setStatus('本人の許諾を確認できませんでした。対象とログインを確認してください。')
    }catch{if(epoch.current===n)setStatus('処理結果を確認できませんでした。再試行してください。')}
    finally{if(epoch.current===n){running.current=false;setBusy(false)}}
  }
  return <section aria-label="本人の公開許諾・撤回">
    <p>ログインした本人の許諾だけ確認できます。この画面から作品を表示・公開することはできません。</p>
    <p><a href="/login">ログイン画面へ</a>（ログイン後、このページへ戻ってください）</p>
    <button type="button" disabled={busy} onClick={()=>void operate()}>現在の対象版・許諾を読み取る</button>
    {status&&<p role="status">{status}</p>}
    {items!==null&&<>
      {!items.length&&<p>確認できる許諾はありません。</p>}
      {items.some(i=>i.canRevoke)&&<label><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>review(e.target.checked)}/>選択した自分の許諾を撤回します</label>}
      <ul>{items.map(i=><li key={i.previewHash+':'+i.id}>
        <p>{i.target} · 版 {i.previewHash.slice(0,8)} · {i.granted?'現在有効':'非有効'}</p>
        {i.canRevoke&&<button type="button" disabled={busy||!reviewed||!!pending.current&&(pending.current.itemId!==i.id||pending.current.previewHash!==i.previewHash)} onClick={()=>void operate(i)}>この自分の許諾だけ撤回</button>}
      </li>)}</ul>
    </>}
  </section>
}
