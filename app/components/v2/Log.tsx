'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {v2Request} from '@/lib/v2/client'
import {supabase} from '@/lib/supabase/client'
import Attachment from './Attachment'
import styles from './v2.module.css'
type Post={id:string;user_id:string;username:string|null;content:string;created_at:string;attachment_type:string|null;has_attachment:boolean;is_marked:boolean;excluded_from_public_log:boolean}
export default function Log({roomId,publicView=false,canManage=false,canPost=false,myUserId,refreshKey=0}:{roomId:string;publicView?:boolean;canManage?:boolean;canPost?:boolean;myUserId?:string|null;refreshKey?:number}){
 const [posts,setPosts]=useState<Post[]>([]),[filter,setFilter]=useState('all'),[input,setInput]=useState(''),[query,setQuery]=useState(''),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[text,setText]=useState(''),[file,setFile]=useState<File|null>(null),[reviewed,setReviewed]=useState<Record<string,boolean>>({}),[reload,setReload]=useState(0)
 const operation=useRef(false),sequence=useRef(0),fileInput=useRef<HTMLInputElement>(null),pending=useRef<{text:string;file:File|null;key:string;uploadId:string|null}|null>(null)
 const load=useCallback(async(after?:Post)=>{const request=++sequence.current;setBusy(true);try{const params=new URLSearchParams({roomId,filter,q:query});if(after){params.set('after',after.created_at);params.set('afterId',after.id)}const r=await v2Request('log',undefined,params);if(request!==sequence.current)return;setPosts(old=>after?[...old,...r.posts]:r.posts);setMore(r.hasMore)}catch(e){if(request===sequence.current)setMessage(e instanceof Error?e.message:'読み込めませんでした。')}finally{if(request===sequence.current)setBusy(false)}},[roomId,filter,query])
 // Invalidate in-flight requests on navigation; the ref is a request counter, not a DOM node.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);sequence.current++}},[load,reload,refreshKey])
 async function act(post:Post,action:string){if(operation.current)return;operation.current=true;setBusy(true);setMessage('');try{await v2Request('post',{roomId,postId:post.id,action,expected:post.is_marked,reviewed:reviewed[post.id]===true});setReload(n=>n+1);setMessage('保存しました。')}catch(e){setMessage(e instanceof Error?e.message:'操作できませんでした。')}finally{operation.current=false;setBusy(false)}}
 async function submit(e:React.FormEvent){e.preventDefault();if(operation.current)return;operation.current=true;setBusy(true);setMessage('');try{
  const {data}=await supabase.auth.getSession();if(!data.session)throw Error('ログインしてください。');const authorization='Bearer '+data.session.access_token
  if(!pending.current||pending.current.text!==text||pending.current.file!==file)pending.current={text,file,key:crypto.randomUUID(),uploadId:null}
  const p=pending.current
  if(file&&!p.uploadId){const form=new FormData();form.append('roomId',roomId);form.append('file',file);const r=await fetch('/api/uploads',{method:'POST',headers:{Authorization:authorization},body:form});const j=await r.json();if(!r.ok)throw Error(j.error??'添付を保存できませんでした。');p.uploadId=j.uploadId}
  const r=await fetch('/api/posts/create',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({roomId,content:text.trim()||'添付ファイル',post_type:'log',uploadId:p.uploadId,requestId:p.key})});const j=await r.json();if(!r.ok)throw Error(j.error??'投稿できませんでした。');pending.current=null;setText('');setFile(null);if(fileInput.current)fileInput.current.value='';setReload(n=>n+1);setMessage('投稿しました。')
 }catch(e){setMessage(e instanceof Error?e.message:'通信結果を確認できません。入力を保持しています。')}finally{operation.current=false;setBusy(false)}}
 return <section className={styles.panel} aria-labelledby="production-log-heading"><h2 id="production-log-heading">{publicView?'公開制作ログ':'制作ログ'}</h2>
 {canPost&&<form onSubmit={submit}><label>制作ログに投稿<textarea rows={4} maxLength={20000} value={text} disabled={busy} onChange={e=>setText(e.target.value)}/></label><label>画像・添付（4MBまで）<input ref={fileInput} type="file" disabled={busy} accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,video/mp4,video/webm" onChange={e=>setFile(e.target.files?.[0]??null)}/></label><button className={styles.primary} disabled={busy||(!text.trim()&&!file)}>投稿する</button></form>}
 <form className={styles.toolbar} onSubmit={e=>{e.preventDefault();setQuery(input)}}><label>本文・投稿者を検索<input type="search" maxLength={100} value={input} onChange={e=>setInput(e.target.value)}/></label><button>検索</button></form>
 <label>表示する投稿<select aria-label="表示する投稿" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">すべて</option><option value="highlight">ハイライト</option><option value="image">画像あり</option>{myUserId&&<option value="mine">自分の投稿</option>}</select></label>
 <p role="status">{message}</p>{!busy&&!posts.length&&<p>表示できる投稿はありません。</p>}
 {posts.map(p=><article key={p.id} className={styles.post}><div className={styles.row}><strong>{p.username||'Member'}</strong><time dateTime={p.created_at}>{new Date(p.created_at).toLocaleString('ja-JP')}</time>{p.is_marked&&<span className={styles.badge}>ハイライト</span>}{!publicView&&p.excluded_from_public_log&&<span>公開ログから除外</span>}</div><p className={styles.body}>{p.content}</p>{p.has_attachment&&<Attachment postId={p.id} mime={p.attachment_type} publicView={publicView}/>}
 {canManage&&<div><div className={styles.row}><button disabled={busy} onClick={()=>act(p,'highlight')}>{p.is_marked?'ハイライト解除':'ハイライト'}</button><button disabled={busy} onClick={()=>act(p,p.excluded_from_public_log?'include':'exclude')}>{p.excluded_from_public_log?'公開除外を解除':'公開ログから除外'}</button></div><label><input type="checkbox" checked={!!reviewed[p.id]} onChange={e=>setReviewed(all=>({...all,[p.id]:e.target.checked}))}/>この投稿・添付の権利と個人情報を確認しました</label><button disabled={busy||!reviewed[p.id]} onClick={()=>act(p,'approve_public')}>公開内容を確認済みにする</button></div>}</article>)}
 {more&&<button disabled={busy} onClick={()=>load(posts.at(-1))}>次の投稿を読む</button>}{busy&&<p role="status">処理中…</p>}</section>
}
