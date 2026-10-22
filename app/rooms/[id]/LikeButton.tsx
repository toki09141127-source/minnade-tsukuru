'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase/client'
export default function LikeButton({roomId}:{roomId:string}){
 const [liked,setLiked]=useState(false),[loading,setLoading]=useState(false),[ready,setReady]=useState(false),[msg,setMsg]=useState('')
 const epoch=useRef(0),active=useRef(false)
 const pending=useRef<{roomId:string;expected:boolean;desired:boolean;requestId:string}|null>(null)
 useEffect(()=>{
  const version=epoch,operation=active
  let disposed=false
  async function refresh(){
   const g=++version.current;operation.current=true;pending.current=null
   setReady(false);setLoading(true);setLiked(false);setMsg('')
   try{
    const {data:user,error}=await supabase.auth.getUser()
    if(disposed||g!==version.current)return
    if(error||!user.user){setMsg('ログインするといいねできます');return}
    const {data,error:readError}=await supabase.from('room_likes').select('room_id').eq('room_id',roomId).eq('user_id',user.user.id).maybeSingle()
    if(disposed||g!==version.current)return
    if(readError){setMsg('いいねの状態を取得できません。再読み込みしてください');return}
    setLiked(!!data);setReady(true)
   }catch{if(!disposed&&g===version.current)setMsg('状態を取得できません。再読み込みしてください')}
   finally{if(!disposed&&g===version.current){operation.current=false;setLoading(false)}}
  }
  // Defer auth work outside Supabase's synchronous auth callback.
  const {data}=supabase.auth.onAuthStateChange(()=>{
   version.current++;operation.current=false;pending.current=null
   setReady(false);setLiked(false);setMsg('');setLoading(false)
   queueMicrotask(()=>{if(!disposed)void refresh()})
  })
  void refresh()
  return()=>{disposed=true;version.current++;operation.current=false;data.subscription.unsubscribe()}
 },[roomId])
 async function toggle(){
  if(active.current||!ready)return
  active.current=true;const g=++epoch.current
  setLoading(true);setMsg('')
  try{
   const {data}=await supabase.auth.getSession()
   if(g!==epoch.current)return
   if(!data.session){setMsg('ログインしてください');return}
   pending.current??={roomId,expected:liked,desired:!liked,requestId:crypto.randomUUID()}
   const res=await fetch('/api/rooms/like',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(pending.current)})
   const result=await res.json()
   if(g!==epoch.current)return
   if(!res.ok||!result.ok||typeof result.liked!=='boolean')throw Error()
   pending.current=null;setLiked(result.liked)
  }catch{if(g===epoch.current)setMsg('結果を確認できません。同じ操作を再試行するか、再読み込みしてください')}
  finally{if(g===epoch.current){active.current=false;setLoading(false)}}
 }
 return <div><button onClick={()=>void toggle()} disabled={loading||!ready} aria-pressed={liked}
 style={{padding:'10px 14px',minHeight:44,border:'1px solid #111',borderRadius:8,background:liked?'#fff':'#111',color:liked?'#111':'#fff'}}>
 {liked?'❤️ 済み':'♡ いいね'}</button>{msg&&<p role="status">{msg}</p>}</div>
}
