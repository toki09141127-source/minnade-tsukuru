'use client'
import {useRef,useState,useSyncExternalStore} from 'react'
import {useRouter} from 'next/navigation'
import {CONSENT_TEXT,GENRES,type Genre} from '@/lib/v2/domain'
import {v2Request} from '@/lib/v2/client'
import styles from './v2.module.css'
const subscribeReady=()=>()=>{}
export default function CreateRoom(){
 const ready=useSyncExternalStore(subscribeReady,()=>true,()=>false)
 const router=useRouter(),request=useRef<{key:string;deadline:string;payload:string}|null>(null)
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[genre,setGenre]=useState<Genre>('novel'),[capacity,setCapacity]=useState('10'),[customCapacity,setCustomCapacity]=useState(10),[hours,setHours]=useState('48'),[customDeadline,setCustomDeadline]=useState(''),[ai,setAi]=useState('forbidden'),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const payload=JSON.stringify({title,description,genre,capacity,customCapacity,hours,customDeadline,ai})
  if(request.current?.payload!==payload)request.current={key:crypto.randomUUID(),deadline:hours==='custom'?new Date(customDeadline).toISOString():new Date(Date.now()+Number(hours)*3600000).toISOString(),payload}
  const result=await v2Request('create',{requestId:request.current.key,title,description,genre,capacity:capacity==='custom'?customCapacity:Number(capacity),deadline:request.current.deadline,aiLevel:ai,consent})
  router.push('/rooms/'+result.data)
 }catch(e){setError(e instanceof Error?e.message:'作成できませんでした。')}finally{setBusy(false)}}
 return <div className={styles.shell}><h1>ルーム作成</h1><p>人間の仲間と、ひとつの作品をつくりましょう。</p><form onSubmit={submit}><fieldset disabled={!ready||busy}>
 <label>タイトル<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>何をつくりたい？<textarea required minLength={20} maxLength={300} rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label><p className={styles.muted}>20〜300文字。個人情報は書かないでください。</p>
 <label>ジャンル<select aria-label="ジャンル" value={genre} onChange={e=>setGenre(e.target.value as Genre)}>{Object.entries(GENRES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>定員<select aria-label="定員" value={capacity} onChange={e=>setCapacity(e.target.value)}>{[5,10,20,30,50].map(n=><option key={n} value={n}>{n}人</option>)}<option value="custom">人数を指定</option></select></label>
 {capacity==='custom'&&<label>定員の人数<input type="number" min={2} max={50} required value={customCapacity} onChange={e=>setCustomCapacity(Number(e.target.value))}/></label>}
 <label>制作期間<select aria-label="制作期間" value={hours} onChange={e=>setHours(e.target.value)}>{[6,24,48,72,168,336].map(n=><option key={n} value={n}>{n<24?n+'時間':n/24+'日'}</option>)}<option value="custom">締切を指定</option></select></label>
 {hours==='custom'&&<label>締切日時<input type="datetime-local" required value={customDeadline} onChange={e=>setCustomDeadline(e.target.value)}/></label>}
 <label>AIの利用方針<select aria-label="AIの利用方針" value={ai} onChange={e=>setAi(e.target.value)}><option value="forbidden">禁止</option><option value="assist">補助可</option><option value="free">自由</option></select></label>
 {ai!=='forbidden'&&<p>AI Creatorは同じルームの文章を外部AI（OpenAI）へ送り、制作を整理・提案します。個人情報・秘密情報は入力しないでください。AIが人間の代わりに決定することはありません。</p>}
 <p>定員・締切・AIの利用方針は作成後に変更できません。締切は1時間以上先、最大2週間です。</p>
 <label><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>{CONSENT_TEXT} 同意して作成します。</label>
 <button className={styles.primary} disabled={busy||!consent}>{busy?'作成中…':'ルームを作る'}</button></fieldset><p role="alert" className={styles.error}>{error}</p></form></div>
}
