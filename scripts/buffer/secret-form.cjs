/* eslint-disable @typescript-eslint/no-require-imports */
// Local, one-use masked secret input. No secret values are returned or logged.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const envPath=path.join(root,'.env.staging.local');
if(!fs.existsSync(envPath))throw Error('STAGING_ENV_REQUIRED');
const nonce=crypto.randomBytes(24).toString('hex');
let complete=false,port;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
 res.setHeader('X-Content-Type-Options','nosniff');
 const origin='http://127.0.0.1:'+port;
 if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403);return res.end()}
 if(req.method==='GET'&&req.url==='/'+nonce){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end('<!doctype html><meta charset="utf-8"><title>Buffer staging キー登録</title><style>body{font:18px sans-serif;max-width:680px;margin:60px auto;line-height:1.7}input{width:95%;padding:12px}button{padding:12px;margin-top:20px}</style><h1>Buffer staging キー登録</h1><p>値はこのPCのGit除外済み .env.staging.local にだけ保存します。チャット・ログには送りません。登録だけでは投稿されません。</p><p>Bufferの既存Personal Keyを入力し、保存してください。キーの再発行が必要な場合はこの画面を閉じずに知らせてください。</p><form method="post" action="/'+nonce+'"><label>BUFFER_API_KEY<input type="password" name="key" autocomplete="off" required maxlength="4096"></label><button>staging用に保存</button></form>');
 }
 if(req.method!=='POST'||req.url!=='/'+nonce||req.headers.origin!==origin||complete){res.writeHead(403);return res.end()}
 let body='';
 try{
  for await(const chunk of req){body+=chunk;if(body.length>8192)throw Error('TOO_LARGE')}
  const key=new URLSearchParams(body).get('key')?.trim();
  if(!key||key.length<20||key.length>4096||/[\r\n\u0000"]/.test(key))throw Error('INVALID');
  const old=fs.readFileSync(envPath,'utf8').replace(/^BUFFER_API_KEY=.*\r?\n?/gm,'');
  fs.writeFileSync(envPath,old.trimEnd()+'\nBUFFER_API_KEY="'+key+'"\n');
  complete=true;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<!doctype html><meta charset="utf-8"><h1>保存しました</h1><p>キー値は表示しません。チャットには「登録済み」とだけ返信してください。</p>');
  console.log('BUFFER_KEY_SAVED');
  setTimeout(()=>server.close(),500);
 }catch{res.writeHead(400);res.end('保存できませんでした。入力形式を確認してください。')}
});
server.listen(0,'127.0.0.1',()=>{
 port=server.address().port;
 fs.writeFileSync(path.join(root,'.staging-private/buffer-secret-form.json'),JSON.stringify({url:'http://127.0.0.1:'+port+'/'+nonce}));
 console.log('BUFFER_SECRET_FORM_READY');
});
setTimeout(()=>server.close(),20*60*1000).unref();
