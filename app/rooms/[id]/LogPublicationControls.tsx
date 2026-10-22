'use client'
import {useState} from 'react'
import {supabase} from '@/lib/supabase/client'
export default function LogPublicationControls({roomId,postId}:{roomId:string;postId:string}) {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function review(approved:boolean){
  if(busy||!window.confirm(approved?'個人情報・権利・添付内容を確認し、このログを公開しますか？':'このログを公開対象から除外しますか？'))return
  setBusy(true)
  try{
   const {data}=await supabase.auth.getSession();if(!data.session)throw Error()
   const response=await fetch('/api/posts/publication',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},
    body:JSON.stringify({roomId,postId,approved,confirm:true})})
   const result=await response.json()
   setMessage(response.ok?(approved?'公開確認を保存しました':'公開から除外しました'):result.error||'保存できませんでした')
  }catch{setMessage('保存結果を確認できませんでした')}
  finally{setBusy(false)}
 }
 return <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
  <button disabled={busy} onClick={()=>review(true)}>確認済みとして公開対象にする</button>
  <button disabled={busy} onClick={()=>review(false)}>公開から除外</button>
  <span role="status">{message}</span>
 </div>
}
