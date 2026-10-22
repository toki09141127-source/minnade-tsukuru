/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),dotenv=require('dotenv');
const PRODUCTION_REF='joedeuyrzimqyjapqpyh'; // DO NOT MODIFY / PRODUCTION
function fail(code){throw new Error(code)}
function jwtClaims(key){try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString())}catch{return null}}
function validate(env,manifest,production={}){
 const ref=env.STAGING_EXPECTED_PROJECT_REF;
 if(env.STAGING_TEST!=='true'||env.STAGING_ENVIRONMENT!=='staging'||env.STAGING_SYNTHETIC_ONLY!=='true')fail('STAGING_MARKERS_REQUIRED');
 if(!/^[a-z]{20}$/.test(ref||'')||ref===PRODUCTION_REF)fail('STAGING_REF_REJECTED');
 let url;try{url=new URL(env.NEXT_PUBLIC_SUPABASE_URL)}catch{fail('STAGING_URL_REJECTED')}
 if(url.protocol!=='https:'||url.hostname!==ref+'.supabase.co'||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail('STAGING_URL_REJECTED');
 if(manifest.projectRef!==ref||manifest.environment!=='staging'||manifest.createdFresh!==true||manifest.syntheticOnly!==true||
 manifest.productionDataCopied!==false||manifest.verifiedByUser!==true||manifest.plan!=='Free')fail('STAGING_IDENTITY_NOT_VERIFIED');
 if(production.NEXT_PUBLIC_SUPABASE_URL===env.NEXT_PUBLIC_SUPABASE_URL)fail('PRODUCTION_URL_REUSE');
 for(const [name,role,prefix] of [['NEXT_PUBLIC_SUPABASE_ANON_KEY','anon','sb_publishable_'],['SUPABASE_SERVICE_ROLE_KEY','service_role','sb_secret_']]){
  const key=env[name];if(!key||key.startsWith('REPLACE_')||key.length<25)fail('STAGING_KEYS_REQUIRED');
  if(Object.values(production).some(value=>value&&value===key))fail('PRODUCTION_KEY_REUSE');
  if(key.startsWith('eyJ')){
   const claims=jwtClaims(key);
   // Decode is an environment consistency check, not signature authentication.
   if(!claims||claims.ref!==ref||claims.role!==role)fail('STAGING_KEY_PROJECT_MISMATCH');
  }else if(!key.startsWith(prefix))fail('STAGING_KEY_FORMAT_REJECTED');
 }
 if(env.NEXT_PUBLIC_SUPABASE_ANON_KEY===env.SUPABASE_SERVICE_ROLE_KEY)fail('KEY_ROLES_MUST_DIFFER');
 return {ref,url:url.origin,manifest};
}
function load(){
 const root=path.resolve(__dirname,'../..'),filename=path.join(root,'.env.staging.local');
 if(!fs.existsSync(filename))fail('STAGING_ENV_FILE_REQUIRED');
 // Explicit file only: never inherit production values from process.env.
 const env=dotenv.parse(fs.readFileSync(filename));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/staging-project.json'),'utf8'));
 const productionFile=path.join(root,'.env.local');
 const production=fs.existsSync(productionFile)?dotenv.parse(fs.readFileSync(productionFile)):{};
 return {...validate(env,manifest,production),env,root};
}
function databaseOptions(ctx){
 let u;try{u=new URL(ctx.env.STAGING_DATABASE_URL)}catch{fail('STAGING_DB_URL_REQUIRED')}
 if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!=='db.'+ctx.ref+'.supabase.co'||
 (u.port&&u.port!=='5432')||u.username!=='postgres'||!u.password||u.pathname!=='/postgres'||u.search||u.hash)fail('STAGING_DB_TARGET_REJECTED');
 return {host:u.hostname,port:5432,user:'postgres',password:decodeURIComponent(u.password),database:'postgres',
 ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:10000,application_name:'minnade_staging_metadata'};
}
module.exports={PRODUCTION_REF,validate,load,databaseOptions};
