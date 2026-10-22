/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');
const {validate,databaseOptions,PRODUCTION_REF}=require('../scripts/staging/safety.cjs');
const ref='ssssssssssssssssssss';
const token=(role,r=ref)=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role,ref:r})).toString('base64url')+'.synthetic-not-valid';
const env={STAGING_TEST:'true',STAGING_ENVIRONMENT:'staging',STAGING_SYNTHETIC_ONLY:'true',STAGING_EXPECTED_PROJECT_REF:ref,NEXT_PUBLIC_SUPABASE_URL:'https://'+ref+'.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:token('anon'),SUPABASE_SERVICE_ROLE_KEY:token('service_role')};
const manifest={projectRef:ref,environment:'staging',createdFresh:true,syntheticOnly:true,productionDataCopied:false,verifiedByUser:true,plan:'Free'};
let n=0;const ok=(label)=>console.log(++n+'. '+label);
validate(env,manifest);ok('Synthetic explicit environment accepted offline only');
for(const change of [{STAGING_EXPECTED_PROJECT_REF:PRODUCTION_REF},{STAGING_TEST:'false'},{STAGING_ENVIRONMENT:'production'},{STAGING_SYNTHETIC_ONLY:'false'},{NEXT_PUBLIC_SUPABASE_URL:'https://'+PRODUCTION_REF+'.supabase.co'},{NEXT_PUBLIC_SUPABASE_URL:env.NEXT_PUBLIC_SUPABASE_URL+'.evil.test'},{NEXT_PUBLIC_SUPABASE_URL:env.NEXT_PUBLIC_SUPABASE_URL+'/?token=x'},{NEXT_PUBLIC_SUPABASE_ANON_KEY:token('anon',PRODUCTION_REF)},{SUPABASE_SERVICE_ROLE_KEY:token('anon')},{SUPABASE_SERVICE_ROLE_KEY:'REPLACE_WITH_KEY'}]){
 assert.throws(()=>validate({...env,...change},manifest));ok('Unsafe configuration rejected');
}
for(const change of [{createdFresh:false},{syntheticOnly:false},{productionDataCopied:true},{verifiedByUser:false},{plan:'Pro'},{projectRef:'other'}]){
 assert.throws(()=>validate(env,{...manifest,...change}));ok('Unverified isolation rejected');
}
assert.throws(()=>validate(env,manifest,{SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY}));ok('Production secret reuse rejected without printing value');
const ctx={ref,env:{STAGING_DATABASE_URL:'postgresql://postgres:synthetic@db.'+ref+'.supabase.co/postgres'}};
assert.equal(databaseOptions(ctx).ssl.rejectUnauthorized,true);ok('TLS certificate verification required');
for(const url of ['postgresql://postgres:synthetic@db.'+PRODUCTION_REF+'.supabase.co/postgres','postgresql://postgres:synthetic@localhost/postgres',ctx.env.STAGING_DATABASE_URL+'?sslmode=disable']){
 assert.throws(()=>databaseOptions({...ctx,env:{STAGING_DATABASE_URL:url}}));ok('Unsafe DB host or TLS override rejected');
}
console.log('Completed '+n+' staging safety checks; no network.');
