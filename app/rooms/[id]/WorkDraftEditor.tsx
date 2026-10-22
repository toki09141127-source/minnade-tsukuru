'use client'
import { useEffect,useState } from 'react'
import {supabase} from '@/lib/supabase/client'
type Block={id:string;kind:'title'|'summary'|'text'|'notes';text:string}
const templates:Record<string,string[]>={
 '小説・物語':['タイトル','あらすじ','本文','登場人物・世界観'],
 'イラスト・デザイン':['タイトル','作品説明','コンセプト','設定・補足'],
 '漫画':['タイトル','あらすじ','ページ構成','キャラクター・設定'],
 'ゲーム企画':['タイトル','ゲーム概要','遊び方・システム','世界観・キャラクター'],
 'その他':['タイトル','概要','本文','補足'],
}
export default function WorkDraftEditor({roomId}:{roomId:string}) {
 const [enabled,setEnabled]=useState(false),[blocks,setBlocks]=useState<Block[]>([]),[version,setVersion]=useState(0)
 const [published,setPublished]=useState(false),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const [genre,setGenre]=useState('その他')
 useEffect(()=>{let live=true;void(async()=>{
  try{
   const {data}=await supabase.auth.getSession()
   if(!data.session)return
   const r=await fetch('/api/works/draft?roomId='+encodeURIComponent(roomId),{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'})
   if(!r.ok)throw Error()
   const result=await r.json()
   if(live&&result.enabled){
    setEnabled(true);setVersion(result.draft.version);setPublished(!!result.draft.published_at)
    setBlocks(result.draft.blocks.length?result.draft.blocks:['title','summary','text','notes'].map((kind,index)=>({id:String(index),kind:kind as Block['kind'],text:''})))
   }
  }catch{if(live)setMessage('ドラフトを読み込めませんでした')}
 })();return ()=>{live=false}},[roomId])
 async function save(){
  if(busy||!reviewed||published)return
  setBusy(true);setMessage('')
  try{
   const {data}=await supabase.auth.getSession();if(!data.session)throw Error()
   const r=await fetch('/api/works/draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},
    body:JSON.stringify({roomId,version,blocks,reviewed})})
   const result=await r.json()
   if(!r.ok){setMessage(result.error||'保存できませんでした');return}
   setVersion(result.version);setMessage('保存しました。期限まではCreator/Coreが編集できます。')
  }catch{setMessage('保存結果を確認できません。入力を控えてから再読み込みしてください')}
  finally{setBusy(false)}
 }
 if(!enabled)return message?<p role="status">{message}</p>:null
 return <section aria-labelledby="draft-heading" style={{marginTop:24}}>
  <h2 id="draft-heading">完成作品ドラフト</h2>
  <p>公開後は編集できません。画像等の添付は制作ログを利用してください。</p>
  <label>表示テンプレート<select value={genre} onChange={e=>setGenre(e.target.value)}>{Object.keys(templates).map(name=><option key={name}>{name}</option>)}</select></label>
  {blocks.map((block,index)=><label key={block.id} style={{display:'block',marginTop:12}}>
   {templates[genre][index] ?? '補足'}
   <textarea value={block.text} disabled={busy||published} maxLength={20000} rows={block.kind==='text'?10:3}
    onChange={e=>{setReviewed(false);setBlocks(current=>current.map(b=>b.id===block.id?{...b,text:e.target.value}:b))}}
    style={{display:'block',width:'100%',minWidth:0}} />
  </label>)}
  <label><input type="checkbox" checked={reviewed} disabled={published||busy} onChange={e=>setReviewed(e.target.checked)} />個人情報・権利と公開内容を確認しました</label>
  <button disabled={!reviewed||busy||published} onClick={save}>{published?'公開済み':busy?'保存中…':'ドラフトを保存'}</button>
  <p role="status">{message}</p>
 </section>
}
