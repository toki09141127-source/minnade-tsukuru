'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
type Member = { user_id: string; username: string | null; role: string }
export default function MemberManagement({roomId}:{roomId:string}) {
  const [members,setMembers]=useState<Member[]>([])
  const [enabled,setEnabled]=useState(false)
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    let live=true
    void (async()=>{
      try {
        const {data}=await supabase.auth.getSession()
        if(!data.session) return
        const response=await fetch('/api/rooms/manage-member?roomId='+encodeURIComponent(roomId),{
          headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store',
        })
        const result=await response.json()
        if(!response.ok) throw new Error('メンバーを確認できませんでした')
        if(live) {setEnabled(result.enabled===true);setMembers(result.members ?? [])}
      } catch {if(live) setMessage('メンバー管理を読み込めませんでした')}
    })()
    return ()=>{live=false}
  },[roomId])
  async function manage(target:Member,action:'kick'|'demote') {
    if(busy || !window.confirm(action==='kick' ? '追放すると再参加できません。過去の投稿・添付は残ります。実行しますか？':'Core権限を解除し、メンバーに変更しますか？')) return
    setBusy(true);setMessage('')
    try {
      const {data}=await supabase.auth.getSession()
      if(!data.session) throw new Error()
      const response=await fetch('/api/rooms/manage-member',{method:'POST',
        headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({roomId,targetUserId:target.user_id,action})})
      if(!response.ok) throw new Error()
      setMembers(current=>action==='kick'?current.filter(m=>m.user_id!==target.user_id):
        current.map(m=>m.user_id===target.user_id?{...m,role:'supporter'}:m))
      setMessage('変更しました')
    } catch {setMessage('変更できませんでした。再読み込みして参加状態を確認してください')}
    finally {setBusy(false)}
  }
  return <section aria-label="メンバー管理">
    <h3>メンバー管理</h3>
    {!enabled && <p>管理機能は安全確認中です。</p>}
    {members.map(member=><div key={member.user_id} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:8}}>
      <span>{member.username || 'メンバー'}（{member.role==='core'?'Core':'メンバー'}）</span>
      {member.role==='core' && <button disabled={busy} onClick={()=>manage(member,'demote')}>メンバーに変更</button>}
      <button disabled={busy} onClick={()=>manage(member,'kick')}>追放</button>
    </div>)}
    <p role="status">{message}</p>
  </section>
}
