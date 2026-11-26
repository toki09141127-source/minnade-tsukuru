export const contract = 'BEEZ-01-VISIBILITY-20261114-1'
export const stagingUrl = 'https://fwqucffxdmbdczspkcyr.supabase.co'
export const enabled = (e: Record<string, string | undefined>) =>
  e.NEXT_PUBLIC_SUPABASE_URL === stagingUrl && e.VERCEL_ENV === 'preview' &&
  e.VERCEL_TARGET_ENV !== 'production' && e.VERCEL_PROJECT_ID === 'prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy' &&
  e.VERCEL_GIT_COMMIT_REF === 'codex/v2-rollback-rights-only-20261127' &&
  e.V3_ROLLBACK_WITHDRAWAL_ENABLED !== 'false'
export const uuid = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x)
const hash = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)
const string = (x: unknown, n: number): x is string => typeof x === 'string' && x.length > 0 && x.length <= n
const exact = (x: unknown, keys: string[]): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join(',') === [...keys].sort().join(',')
export type Grant = {id:string;previewHash:string;kind:string;target:string;granted:boolean;canRevoke:boolean}
export type Revoke = {action:'revoke';roomId:string;requestId:string;previewHash:string;reviewed:true;itemId:string}
export function revokeInput(x: unknown): x is Revoke {
  return exact(x,['action','roomId','requestId','previewHash','reviewed','itemId']) &&
    x.action==='revoke' && uuid(x.roomId) && uuid(x.requestId) && hash(x.previewHash) && x.reviewed===true && string(x.itemId,100)
}
export function rights(x: unknown, roomId: string): Grant[] | null {
  if(!exact(x,['contract','roomId','previewHash','items']) || x.contract!==contract || x.roomId!==roomId || !hash(x.previewHash) || !Array.isArray(x.items) || x.items.length>1000) return null
  const seen=new Set<string>()
  for(const v of x.items) {
    if(!exact(v,['id','previewHash','kind','target','granted','canRevoke']) || !string(v.id,100) || !hash(v.previewHash) ||
      !['text','credit','attachment'].includes(String(v.kind)) || !string(v.target,200) || typeof v.granted!=='boolean' || typeof v.canRevoke!=='boolean') return null
    const key=v.previewHash+':'+v.id
    if(seen.has(key))return null
    seen.add(key)
  }
  return x.items
}
export function revokeResult(x: unknown, data: Revoke) {
  return exact(x,['contract','roomId','action','outcome','previewHash']) && x.contract===contract && x.roomId===data.roomId &&
    x.action==='revoke' && x.previewHash===data.previewHash && (x.outcome==='revoked'||x.outcome==='pending') ? x.outcome : null
}

export type RightsClient = {
  authenticated: () => Promise<boolean>
  rpc: (args: {p_action:'rights'|'revoke';p_room:string;p_request:string|null;p_payload:Record<string,unknown>}) => Promise<{data:unknown;error:unknown}>
}
export const json = (body:unknown,status=200) => Response.json(body,{status,headers:{
  'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Vary':'Authorization',
}})
export async function handle(req: Request, active: boolean, getClient: () => RightsClient) {
  if(!active) return json({error:'FEATURE_STOPPED'},503)
  try {
    const u=new URL(req.url), auth=req.headers.get('authorization')
    if(!auth || !/^Bearer [^\s]+$/.test(auth))return json({error:'AUTH_REQUIRED'},401)
    let room:string, revoke:Revoke|undefined
    if(req.method==='GET'){
      const id=u.searchParams.get('roomId')
      if(u.searchParams.size!==2||u.searchParams.getAll('roomId').length!==1||u.searchParams.getAll('view').length!==1||u.searchParams.get('view')!=='rights'||!uuid(id))
        return json({error:'INVALID_INPUT'},400)
      room=id
    }else if(req.method==='POST'){
      if(u.searchParams.size || req.headers.get('origin')!==u.origin || req.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')
        return json({error:'INVALID_INPUT'},400)
      const raw=await req.text()
      if(raw.length>4096)return json({error:'INVALID_INPUT'},413)
      let b:unknown
      try{b=JSON.parse(raw)}catch{return json({error:'INVALID_INPUT'},400)}
      if(!revokeInput(b))return json({error:'INVALID_INPUT'},400)
      revoke=b
      room=b.roomId
    }else return json({error:'METHOD_NOT_ALLOWED'},405)
    const client=getClient()
    if(!await client.authenticated())return json({error:'AUTH_REQUIRED'},401)
    const r=await client.rpc({p_action:revoke?'revoke':'rights',p_room:room,p_request:revoke?.requestId??null,p_payload:revoke?{...revoke,contract}:{contract}})
    if(r.error)return json({error:'RIGHTS_UNCONFIRMED'},409)
    if(!revoke){if(!rights(r.data,room))return json({error:'RIGHTS_UNCONFIRMED'},503)}
    else if(!revokeResult(r.data,revoke))return json({error:'RIGHTS_UNCONFIRMED'},503)
    return json(r.data)
  }catch{return json({error:'RIGHTS_UNCONFIRMED'},503)}
}
