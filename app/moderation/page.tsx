'use client'
import ReportQueue from './ReportQueue'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
export default function ModerationPage() {
  const [targetType,setType]=useState('post'),[targetId,setId]=useState(''),[reason,setReason]=useState('privacy')
  const [hidden,setHidden]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const generation=useRef(0),active=useRef<number|null>(null),requests=useRef(new Map<string,string>())
  useEffect(()=>{
    const epoch=generation,operation=active
    const {data}=supabase.auth.onAuthStateChange(()=>{
      epoch.current++;operation.current=null;requests.current.clear();setBusy(false);setMessage('');setId('')
    })
    return()=>{epoch.current++;operation.current=null;data.subscription.unsubscribe()}
  },[])
  async function submit(event:React.FormEvent) {
    event.preventDefault()
    if(active.current!==null || !window.confirm(hidden?'対象を非表示にしますか？':'対象の公開を復旧しますか？')) return
    const g=++generation.current;active.current=g
    const current=()=>generation.current===g&&active.current===g
    const key=JSON.stringify([targetType,targetId,reason,hidden])
    setBusy(true);setMessage('')
    try {
      const {data}=await supabase.auth.getSession()
      if(!current())return
      if(!data.session) {setMessage('運営アカウントでログインしてください');return}
      if(!requests.current.has(key))requests.current.set(key,crypto.randomUUID())
      const response=await fetch('/api/moderation',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},
        body:JSON.stringify({targetType,targetId,reason,hidden,requestId:requests.current.get(key)})})
      if(!current())return
      if(response.ok)requests.current.delete(key)
      setMessage(response.ok?'処理しました。対象の公開状態を確認してください。':'処理できませんでした。権限・機能設定・対象を確認してください。')
    } catch {if(current())setMessage('結果を確認できません。対象の状態を確認してから再操作してください。')}
    finally {if(current()){active.current=null;setBusy(false)}}
  }
  return <main style={{maxWidth:640,margin:'auto',padding:24}}>
    <h1>運営の非表示・復旧</h1>
    <p>運営担当者専用です。作品本文は編集しません。復旧前に通報内容と対応結果を確認してください。</p>
    <form onSubmit={submit} style={{display:'grid',gap:12}}>
      <label>対象<select value={targetType} onChange={e=>setType(e.target.value)}><option value="post">投稿</option><option value="room">ルーム・作品</option></select></label>
      <label>対象ID<input required value={targetId} onChange={e=>setId(e.target.value)} style={{width:'100%'}} /></label>
      <label>理由<select value={reason} onChange={e=>setReason(e.target.value)}>
        <option value="privacy">個人情報</option><option value="copyright">無断転載・著作権</option>
        <option value="harassment">誹謗中傷</option><option value="inappropriate">不適切内容</option><option value="other">その他</option>
      </select></label>
      <label><input type="checkbox" checked={hidden} onChange={e=>setHidden(e.target.checked)} />非表示にする（解除時は復旧）</label>
      <button disabled={busy}>{busy?'処理中…':'実行する'}</button>
    </form><p role="status">{message}</p><ReportQueue />
  </main>
}
