'use client'
import { useEffect,useRef,useState } from 'react'
import { supabase } from '@/lib/supabase/client'
type Item={id:string;target_type:string;target_id:string;reason:string;created_at:string}
type Cursor={afterTime:string;afterId:string}
export default function ReportQueue(){
 const [items,setItems]=useState<Item[]>([]),[next,setNext]=useState<Cursor|null>(null)
 const [summary,setSummary]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [notes,setNotes]=useState<Record<string,string>>({})
 const requests=useRef(new Map<string,string>()),generation=useRef(0),active=useRef<number|null>(null)
 useEffect(()=>{
  const epoch=generation,operation=active
  const {data}=supabase.auth.onAuthStateChange(()=>{
   epoch.current++;operation.current=null;setBusy(false);setMessage('')
   setItems([]);setSummary('');setNext(null);setNotes({});requests.current.clear()
  })
  return()=>{epoch.current++;operation.current=null;data.subscription.unsubscribe()}
 },[])
 function begin(){if(active.current!==null)return null;const g=++generation.current;active.current=g;return g}
 function current(g:number){return generation.current===g&&active.current===g}
 function finish(g:number){if(current(g)){active.current=null;setBusy(false)}}
 async function auth(){const {data}=await supabase.auth.getSession();if(!data.session)throw Error();return {Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'}}
 async function load(cursor:Cursor|null=null){
  const g=begin();if(g===null)return
  setBusy(true);setItems([]);setMessage('');setSummary('');setNext(null)
  try{
   const h=await auth();if(!current(g))return
   const query=cursor?'?'+new URLSearchParams(cursor).toString():''
   const res=await fetch('/api/moderation/reports'+query,{headers:h,cache:'no-store'})
   const data=await res.json();if(!current(g))return
   if(!res.ok)throw Error()
   setItems(data.items);setNext(data.next)
   setSummary('未対応 '+data.total+'件 ／ 24時間以上 '+data.overdue+'件 ／ 最古 '+(data.oldest??'なし')+' ／ 確認時刻 '+data.checkedAt)
  }catch{if(current(g))setMessage('一覧を取得できません。運営権限・ログイン・機能設定を確認してください。')}
  finally{finish(g)}
 }
 async function resolve(item:Item,outcome:string){
  if(active.current!==null)return
  const note=(notes[item.id]??'').trim()
  if(!note){setMessage('対応理由を入力してください');return}
  if(!window.confirm(outcome==='hidden'?'対象を非表示にして対応済みにしますか？':'対象の公開状態を変えず、対応済みにしますか？'))return
  const g=begin();if(g===null)return
  setBusy(true);setMessage('')
  try{
   const h=await auth();if(!current(g))return
   const key=JSON.stringify([item.id,outcome,note])
   if(!requests.current.has(key))requests.current.set(key,crypto.randomUUID())
   const res=await fetch('/api/moderation/reports',{method:'POST',headers:h,body:JSON.stringify({receiptId:item.id,outcome,note,requestId:requests.current.get(key),confirm:true})})
   if(!current(g))return
   if(!res.ok)throw Error()
   setItems(list=>list.filter(x=>x.id!==item.id));setSummary('対応を保存しました。件数は一覧を更新して確認してください。')
   setMessage('対応結果を監査記録に保存しました。')
  }catch{if(current(g))setMessage('結果を確認できません。内容を保持しています。同じ操作の再試行または一覧更新で確認してください。')}
  finally{finish(g)}
 }
 return <section style={{marginTop:32}}><h2>処理待ち通報</h2>
 <p>自動処理が完了しなかった通報です。24時間は滞留確認の目安です。</p>
 <button disabled={busy} onClick={()=>void load()}>一覧を更新</button>
 <p role="status">{summary}</p><p role="alert">{message}</p>
 {items.map(item=><article key={item.id} style={{border:'1px solid #ccc',padding:12,marginTop:12,overflowWrap:'anywhere'}}>
 <p>受付：{item.created_at}</p><p>対象：{item.target_type} ／ {item.target_id}</p>
 <p style={{whiteSpace:'pre-wrap'}}>{item.reason}</p>
 <label>対応理由<textarea maxLength={1000} value={notes[item.id]??''} onChange={e=>setNotes({...notes,[item.id]:e.target.value})} style={{width:'100%'}} /></label>
 <button disabled={busy} onClick={()=>void resolve(item,'hidden')}>非表示にして対応済み</button>{' '}
 <button disabled={busy} onClick={()=>void resolve(item,'no_action')}>変更不要として対応済み</button>
 </article>)}
 {next&&<button disabled={busy} onClick={()=>void load(next)}>次の50件</button>}
 </section>
}
