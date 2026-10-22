'use client'
import Link from 'next/link'
import {useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from '@/lib/supabase/client'
import {v2Request} from '@/lib/v2/client'
import {CONSENT_TEXT,CONSENT_VERSION,GENRES,type Role,type Genre,type Block} from '@/lib/v2/domain'
import LikeButton from '@/app/rooms/[id]/LikeButton'
import MarkRoomSeenOnView from '@/app/components/MarkRoomSeenOnView'
import DeleteRoomButton from '@/app/rooms/[id]/DeleteRoomButton'
import ReportButton from '@/app/rooms/[id]/ReportButton'
import DraftEditor from './DraftEditor'
import Log from './Log'
import styles from './v2.module.css'
type Member={user_id:string;name:string;role:Role}
type Pending={id:string;user_id:string;name:string}
type State={room:{id:string;title:string;description:string;genre:Genre;capacity:number;deadline:string;status:string;aiLevel:string};myRole:Role|null;myUserId:string|null;memberCount:number;coreCount:number;kicked:boolean;rejections:number;pendingCore:boolean;members:Member[];requests:Pending[];resignations:Pending[];draft:{blocks:Block[];version:number}|null;events:{id:number;kind:string;created_at:string}[]}
const eventLabels:Record<string,string>={created:'ルームが作成されました',core_approved:'Core申請が承認されました',core_rejected:'Core申請が審査されました',core_resigned:'Core辞退が承認されました',member_left:'Memberが退出しました',member_kicked:'参加状態が変更されました',core_demoted:'CoreがMemberへ変更されました',published:'作品が公開されました'}
export default function Room({roomId}:{roomId:string}){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[revision,setRevision]=useState(0),[pending,setPending]=useState<{action:string;target?:string;requestId?:string;label:string}|null>(null),[clock,setClock]=useState<number|null>(null)
 const dialog=useRef<HTMLDialogElement>(null),generation=useRef(0),authActor=useRef<string|null|undefined>(undefined)
 const load=useCallback(async()=>{const g=++generation.current;try{const s=await v2Request('state',undefined,new URLSearchParams({roomId}));if(g===generation.current)setState(s)}catch(e){if(g===generation.current)setError(e instanceof Error?e.message:'読み込めませんでした。')}},[roomId])
 // Request generation prevents stale authentication responses from repopulating the view.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{void load();const {data}=supabase.auth.onAuthStateChange((_event,session)=>{const actor=session?.user.id??null;if(authActor.current===actor)return;authActor.current=actor;setState(null);setConsent(false);setTimeout(()=>void load(),0)});const timer=setInterval(()=>setClock(Date.now()),1000);return()=>{generation.current++;data.subscription.unsubscribe();clearInterval(timer)}},[load])
 useEffect(()=>{if(pending)dialog.current?.showModal();else dialog.current?.close()},[pending])
 async function action(action:string,target?:string,requestId?:string){setBusy(true);setError('');try{await v2Request('member',{roomId,action,target,requestId,consent:consent?CONSENT_VERSION:null});setPending(null);await load();setRevision(n=>n+1)}catch(e){setError(e instanceof Error?e.message:'操作できませんでした。')}finally{setBusy(false)}}
 if(!state)return <div className={styles.shell}><p role="status">{error||'ルームを読み込んでいます…'}</p></div>
 const {room}=state,open=room.status==='open'&&(clock===null||new Date(room.deadline).getTime()>clock),manager=state.myRole==='creator'||state.myRole==='core'
 return <main className={styles.shell}><MarkRoomSeenOnView roomId={roomId}/><Link href="/rooms">← 制作ルーム一覧</Link><h1>{room.title}</h1><p className={styles.body}>{room.description}</p><p>{GENRES[room.genre]} · {state.memberCount}/{room.capacity}人 · Core {state.coreCount}/4人</p><p>締切: <time dateTime={room.deadline}>{new Date(room.deadline).toLocaleString('ja-JP')}</time> · AI {room.aiLevel==='forbidden'?'禁止':room.aiLevel==='assist'?'補助可':'自由'}</p>
 <div className={styles.row}>{state.myRole&&<span className={styles.badge}>{state.myRole==='member'?'Member':state.myRole==='core'?'Core':'Creator'}</span>}<LikeButton roomId={roomId}/><ReportButton targetType="room" targetId={roomId}/>{state.myRole==='creator'&&open&&<DeleteRoomButton roomId={roomId}/>}</div>
 {room.status==='forced_publish'?<Link className={styles.cta} href={'/works/'+roomId}>公開作品を見る</Link>:!open&&<p role="status">締切を迎えました。作品の公開処理を待っています。</p>}
 {open&&<section className={styles.panel}><h2>参加・Core申請</h2>{!state.myUserId?<Link href="/login">ログインして参加</Link>:<>
 {!state.myRole&&state.kicked?<p>このルームには再参加できません。</p>:!state.myRole&&state.memberCount>=room.capacity?<p>定員に達しました。完成をお楽しみに。</p>:(!state.myRole||state.myRole==='member')&&<label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{CONSENT_TEXT} 同意します。</label>}
 {!state.myRole&&!state.kicked&&<button disabled={busy||!consent||state.memberCount>=room.capacity} onClick={()=>action('join')}>Memberとして参加</button>}
 {state.myRole==='member'&&<div className={styles.row}><button disabled={busy||!consent||state.pendingCore||state.rejections>=3} onClick={()=>action('apply_core')}>{state.pendingCore?'Core申請は審査待ち':'Coreを申請'}</button><button disabled={busy} onClick={()=>setPending({action:'leave',label:'退出しますか？ 過去の投稿は残ります。'})}>退出する</button><span>拒否回数: {state.rejections}/3</span></div>}
 {state.myRole==='core'&&<><button disabled={busy||state.resignations.length>0} onClick={()=>action('resign_core')}>{state.resignations.length?'Core辞退は承認待ち':'Core辞退を申請'}</button><p>Creatorの承認でMemberに戻った後、退出できます。承認待ちの間も制作できます。</p></>}
 </>}</section>}
 {state.myRole==='creator'&&open&&<section className={styles.panel}><h2>Creatorの参加者管理</h2><h3>Core申請</h3>{!state.requests.length&&<p>処理待ちの申請はありません。</p>}{state.requests.map(r=><div key={r.id} className={styles.block}><strong>{r.name}</strong><div className={styles.row}><button disabled={busy} onClick={()=>action('approve_core',undefined,r.id)}>Coreへ承認</button><button disabled={busy} onClick={()=>setPending({action:'reject_core',requestId:r.id,label:r.name+'のCore申請を拒否しますか？ 申請回数を1回消費します。'})}>Core申請を拒否</button></div></div>)}
 <h3>Core辞退申請</h3>{state.resignations.map(r=><div key={r.id} className={styles.row}><span>{r.name}</span><button disabled={busy} onClick={()=>action('approve_resignation',undefined,r.id)}>辞退を承認</button></div>)}
 <h3>参加者</h3>{state.members.filter(m=>m.role!=='creator').map(m=><div key={m.user_id} className={styles.block}><strong>{m.name} · {m.role==='member'?'Member':'Core'}</strong><div className={styles.row}>{m.role==='core'&&<button disabled={busy} onClick={()=>setPending({action:'demote',target:m.user_id,label:m.name+'をMemberへ変更しますか？'})}>Memberへ降格</button>}<button disabled={busy} onClick={()=>setPending({action:'kick',target:m.user_id,label:m.name+'を追放しますか？ 再参加できなくなります。過去の投稿は残ります。'})}>追放</button></div></div>)}</section>}
 <p role="alert" className={styles.error}>{error}</p>
 <Log key={state.myUserId??'anon'} roomId={roomId} publicView={room.status==='forced_publish'} canManage={manager&&open} canPost={!!state.myRole&&open} myUserId={state.myUserId} refreshKey={revision}/>
 {state.myRole&&open&&<DraftEditor key={'draft-'+state.myUserId} roomId={roomId} title={room.title} genre={room.genre} initial={state.draft} editable={manager}/>}
 {!!state.events.length&&<section className={styles.panel}><h2>制作の節目</h2><ul>{state.events.map(e=><li key={e.id}>{eventLabels[e.kind]??'制作の状態が更新されました'} · <time>{new Date(e.created_at).toLocaleString('ja-JP')}</time></li>)}</ul></section>}
 <dialog ref={dialog} aria-labelledby="confirmation-title" onCancel={e=>{e.preventDefault();if(!busy)setPending(null)}}><h2 id="confirmation-title">操作の確認</h2><p>{pending?.label}</p><div className={styles.row}><button autoFocus disabled={busy} onClick={()=>setPending(null)}>キャンセル</button><button disabled={busy} onClick={()=>pending&&action(pending.action,pending.target,pending.requestId)}>確認して実行</button></div></dialog></main>
}
