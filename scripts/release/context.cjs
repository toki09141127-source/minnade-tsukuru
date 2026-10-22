/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),tls=require('node:tls');
const P=require('./private.cjs'),{createClient}=require('@supabase/supabase-js');
const REF='joedeuyrzimqyjapqpyh',BASE='https://minnade-tsukuru.vercel.app';
function context(){
 if(process.argv[3]!==REF)throw Error('EXPLICIT_PRODUCTION_TARGET_REQUIRED');
 const env=require('dotenv').parse(fs.readFileSync('.env.local'));
 if(env.NEXT_PUBLIC_SUPABASE_URL!=='https://'+REF+'.supabase.co')throw Error('PRODUCTION_ENV_MISMATCH');
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,opts);
 const client=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts);
 const privateFile=path.join(P.privateDir,'production-smoke.aes'),key=P.encryptionKey();
 const load=()=>fs.existsSync(privateFile)?JSON.parse(P.decrypt(fs.readFileSync(privateFile),key)):null;
 const save=data=>P.writeEncrypted(privateFile,JSON.stringify(data),key);
 const connect=async()=>{const ctx=require('../staging/safety.cjs').load(),{Client}=require(path.join(ctx.env.MVP_TEST_RUNTIME,'node_modules/pg'));const c=new Client({host:'aws-1-ap-south-1.pooler.supabase.com',port:5432,user:'postgres.'+REF,password:P.password(),database:'postgres',ssl:{rejectUnauthorized:true,ca:tls.rootCertificates.join('\n')+'\n'+fs.readFileSync(path.join(P.privateDir,'supabase-prod-ca.crt'),'utf8')},connectionTimeoutMillis:10000,query_timeout:30000});await c.connect();return c;};
 return {env,admin,client,load,save,connect,REF,BASE};
}
module.exports={context};
