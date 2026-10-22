'use client'
import SupportContact from '@/components/SupportContact'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabase/client'
export default function DeleteAccountButton() {
  const [enabled,setEnabled]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>{let live=true;void fetch('/api/account/delete',{cache:'no-store'}).then(r=>r.json()).then(r=>{if(live)setEnabled(r.enabled===true)}).catch(()=>{});return ()=>{live=false}},[])
  async function request() {
    if(!confirmed || busy) return
    setBusy(true);setMessage('')
    try{
      const {data}=await supabase.auth.getSession()
      if(!data.session){setMessage('ログインしてください');return}
      const response=await fetch('/api/account/delete',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},
        body:JSON.stringify({confirm:true,attribution:'anonymous',policyVersion:'withdrawal-draft-2026-10-21'})})
      const result=await response.json()
      if(response.status===409 && result.code==='UNPUBLISHED_CREATOR_ROOMS') {setMessage('公開前のルームを削除してから退会してください');return}
      if(response.status===409 && result.code==='ACTIVE_CORE_ROOMS') {setMessage('制作中のCoreとして参加しています。Creatorに降格を依頼するか、作品の公開後に退会してください');return}
      if(response.status===200 && result.completed===true && result.state==='completed') {
        setEnabled(false)
        setMessage('退会が完了しました。共同作品と制作履歴は匿名の名義で保持されます。')
        // Completion is confirmed by the server; a local sign-out failure cannot undo deletion.
        await supabase.auth.signOut({scope:'local'}).catch(()=>{})
        return
      }
      if(response.status!==202 || result.completed!==false) {setMessage('申請を確認できませんでした。時間をおいてお試しください');return}
      const detail=result.state==='paused'?'退会処理は安全確認のため一時停止中です。受付番号を控えて運営へお問い合わせください。':result.state==='retry'?'処理を再試行する必要があります。同じ申請を再送するか、受付番号を運営へお知らせください。':
        result.state==='needs_review'?'安全確認のため運営の確認を待っています。':
        result.state==='busy'?'現在、退会処理中です。':'退会申請を受け付けました。'
      setMessage(detail+'まだ退会は完了していません。受付番号：'+result.requestId)
    } catch {setMessage('受付結果を確認できません。同じ名義選択で再送して確認できます')}
    finally {setBusy(false)}
  }
  return <section aria-labelledby="account-deletion-heading" style={{marginTop:18}}>
    <h2 id="account-deletion-heading">退会</h2>
    {!enabled ? <p>安全な退会処理を準備中のため、現在は退会できません。この画面では退会申請は受け付けていません。</p> : <>
      <p>共同作品・過去投稿は原則残り、アカウント情報とは分けて処理します。個人情報・権利侵害を含む内容は個別の確認が必要です。申請直後はアカウントが残り、受付と削除完了は異なります。</p>
      <p>作品の名義は固定の匿名名へ変更します。作成した未公開ルームがある場合は、先に削除してください。</p>
      <label style={{display:'block'}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />保持と名義について確認しました</label>
      <button onClick={request} disabled={!confirmed||busy}>{busy?'申請中…':'退会を申請する'}</button>
    </>}
    <p role="status">{message}</p>
    <p><SupportContact /></p>
  </section>
}
