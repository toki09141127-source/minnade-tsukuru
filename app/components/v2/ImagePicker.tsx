'use client'
import {useState} from 'react'
import {v2Request} from '@/lib/v2/client'
import Attachment from './Attachment'
export default function ImagePicker({roomId,value,onChange}:{roomId:string;value:string;onChange:(value:string)=>void}){
 const [items,setItems]=useState<{id:string;content:string;created_at:string}[]>([]),[cursor,setCursor]=useState<{at:string;id:string}|null>(null),[more,setMore]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function load(){setBusy(true);try{const q=new URLSearchParams({roomId,filter:'image'});if(cursor){q.set('after',cursor.at);q.set('afterId',cursor.id)}const r=await v2Request('log',undefined,q);setItems(a=>[...a,...r.posts.filter((p:{id:string})=>!a.some(x=>x.id===p.id))]);const last=r.posts.at(-1);if(last)setCursor({at:last.created_at,id:last.id});setMore(r.hasMore);setError('')}catch(e){setError(e instanceof Error?e.message:'読み込めませんでした。')}finally{setBusy(false)}}
 return <div><label>制作ログの画像<select aria-label="制作ログの画像" value={value} onChange={e=>onChange(e.target.value)}><option value="">画像を選択</option>{value&&!items.some(i=>i.id===value)&&<option value={value}>保存中の画像</option>}{items.map(p=><option key={p.id} value={p.id}>{p.content.slice(0,40)||'画像'} · {new Date(p.created_at).toLocaleString('ja-JP')}</option>)}</select></label>{more&&<button type="button" disabled={busy} onClick={load}>{items.length?'次の画像を読み込む':'画像の候補を読み込む'}</button>}{value&&<Attachment postId={value} mime="image/png"/>}<p>公開前に、制作ログ側でこの画像の公開内容を確認してください。</p><p role="status">{error}</p></div>
}
