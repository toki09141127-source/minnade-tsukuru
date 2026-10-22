import { piiSignals } from '@/lib/publicationSafety'
export const GENRES = { novel:'小説', illustration:'イラスト', manga:'漫画', video:'映像', music:'音楽', other:'その他' } as const
export type Genre = keyof typeof GENRES
export const CONSENT_VERSION = '2026-10-22-v2.1'
export const CONSENT_TEXT = 'このルームへの投稿・画像・添付ファイル・制作ログは、作品公開後に一般公開される場合があります。'
export type Role = 'creator' | 'core' | 'member'
export type Block = { id:string; type:'heading'|'summary'|'text'|'image'|'list'|'divider'|'link'; text?:string; items?:string[]; postId?:string; label?:string; url?:string }
export const BLOCK_LABELS = { heading:'見出し',summary:'概要',text:'本文',image:'画像',list:'リスト',divider:'区切り',link:'映像・音源リンク' }
export const uuid = (v:unknown):v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export function safeText(v:unknown,max=20000):v is string { return typeof v==='string' && [...v].length<=max && !/<[^>]*>/.test(v) && piiSignals(v).length===0 }
export function validBlocks(value:unknown):value is Block[] {
 if(!Array.isArray(value)||value.length>50||JSON.stringify(value).length>300000)return false
 const ids=new Set<string>()
 for(const raw of value){
  if(!raw||typeof raw!=='object')return false
  const b=raw as Record<string,unknown>
  if(typeof b.id!=='string'||b.id.length<1||b.id.length>64||ids.has(b.id)||typeof b.type!=='string'||!(b.type in BLOCK_LABELS))return false
  ids.add(b.id)
  const allowed = ['id','type',...(['heading','summary','text'].includes(b.type)?['text']:b.type==='list'?['items']:b.type==='image'?['postId']:b.type==='link'?['label','url']:[])]
  if(Object.keys(b).some(k=>!allowed.includes(k)))return false
  if(['heading','summary','text'].includes(b.type)&&!safeText(b.text))return false
  if(b.type==='list'&&(!Array.isArray(b.items)||b.items.length>100||b.items.some(i=>!safeText(i,2000))))return false
  if(b.type==='image'&&!uuid(b.postId))return false
  if(b.type==='link'&&(typeof b.url!=='string'||b.url.length>2048||!/^https:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}(\/[a-zA-Z0-9/_~.%-]*)?$/.test(b.url)||!safeText(b.label??'',200)))return false
 }
 return true
}
const sections:Record<Genre,string[]>={novel:['タイトル','メイン画像','あらすじ','本文','キャラクター','世界観'],illustration:['タイトル','メイン画像','説明','コンセプト','設定'],manga:['タイトル','表紙','あらすじ','ページ','キャラクター','設定'],video:['タイトル','メインビジュアル','概要','動画 / URL','構成','設定'],music:['タイトル','ジャケット','音源 / URL','説明','歌詞 / 構成','制作メモ'],other:['タイトル','概要','自由ブロック']}
export function template(genre:Genre,title:string):Block[]{return sections[genre].flatMap((label,i):Block[]=> i===0?[{id:'title',type:'heading',text:title}]:[{id:'section-'+i,type:'heading',text:label},{id:'body-'+i,type:i===1?'summary':'text',text:''}])}
export const ERRORS:Record<string,string>={AUTH_REQUIRED:'ログインしてください。',ACCOUNT_UNAVAILABLE:'現在このアカウントでは操作できません。',CONSENT_REQUIRED:'参加・利用条件への同意が必要です。',ROOM_FULL:'定員に達しました。完成をお楽しみに。',CORE_FULL:'Coreは最大4人です。申請は処理待ちのまま保持されます。',REQUEST_LIMIT:'Core申請は拒否3回までです。',CONFLICT:'他の人が編集しました。入力は残しています。最新版を確認してから編集し直してください。',FORBIDDEN:'この操作を行う権限がありません。',NOT_CREATOR:'Creatorのみ操作できます。',MEMBER_REQUIRED:'参加中のMemberが必要です。',MEMBER_EXCLUDED:'このルームには再参加できません。',ROOM_UNAVAILABLE:'ルームの状態または締切を確認してください。',IMAGE_UNAVAILABLE:'同じルームの公開確認済み画像を選んでください。',UNSAFE_CONTENT:'個人情報の可能性があるため公開できません。',UNSAFE_BLOCK:'個人情報やHTMLを含むブロックは保存できません。',RESIGNATION_REQUIRED:'Creatorは退出できません。Coreは辞退申請の承認後に退出できます。',RATE_LIMITED:'操作が続いています。少し待ってから再試行してください。'}
