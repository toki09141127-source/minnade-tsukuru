/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('./safety.cjs'),render=require('./baseline-render.cjs');
const ctx=load(),dir=process.env.MVP_BASELINE_DIR;
if(!dir)throw Error('PRIVATE_METADATA_DIRECTORY_REQUIRED');
const m=JSON.parse(fs.readFileSync(path.join(dir,'baseline-audit-2026-10-21.json'),'utf8'));
const extra=JSON.parse(fs.readFileSync(path.join(dir,'baseline-completion-2026-10-21.json'),'utf8'));
const prior=JSON.parse(fs.readFileSync(path.join(ctx.root,'docs/staging-baseline-local-result.json'),'utf8'));
if(prior.failure||prior.migrations.length!==18||!prior.migrations.every(x=>x.pass))throw Error('LOCAL_BASELINE_NOT_VERIFIED');
if(prior.sourceSha256!==crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'baseline-audit-2026-10-21.json'))).digest('hex'))throw Error('AUDIT_SOURCE_CHANGED');
const synthetic=JSON.parse(fs.readFileSync(path.join(ctx.root,'docs/staging-integration-result.json'),'utf8'));
if(synthetic.projectRef!==ctx.ref||!/^[-a-f0-9]{36}$/.test(synthetic.runId))throw Error('SYNTHETIC_MANIFEST_MISMATCH');
const body=render(m,extra);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const guard="DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM staging_verification.environment WHERE project_ref='"+ctx.ref+"') THEN RAISE EXCEPTION 'STAGING_ONLY'; END IF; END $$;";
const baseline="BEGIN;\nSET LOCAL statement_timeout='30s';\nDO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public') THEN RAISE EXCEPTION 'EMPTY_BASELINE_REQUIRED'; END IF; IF (SELECT count(*) FROM auth.users)<>6 OR EXISTS(SELECT 1 FROM auth.users WHERE email NOT LIKE '%"+synthetic.runId+"%@example.invalid') THEN RAISE EXCEPTION 'SYNTHETIC_AUTH_REQUIRED'; END IF; END $$;\nCREATE SCHEMA staging_verification;\nREVOKE ALL ON SCHEMA staging_verification FROM PUBLIC,anon,authenticated;\nCREATE TABLE staging_verification.environment(project_ref text PRIMARY KEY);\nINSERT INTO staging_verification.environment VALUES('"+ctx.ref+"');\nCREATE TABLE staging_verification.migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());\n"+body+"\nINSERT INTO staging_verification.migrations(name,sha256) VALUES('baseline','"+sha(body)+"');\nCOMMIT;\nSELECT 'BASELINE_APPLIED' AS result,(SELECT count(*) FROM pg_tables WHERE schemaname='public') AS public_tables;\n";
fs.writeFileSync(path.join(dir,'staging-baseline.sql'),baseline);
const names=fs.readdirSync(path.join(ctx.root,'supabase/migrations')).filter(n=>/^2026102100\d\d_.*\.sql$/.test(n)&&Number(n.slice(8,12))<=18).sort();
const plan=[];
for(const name of names){
 const original=fs.readFileSync(path.join(ctx.root,'supabase/migrations',name),'utf8');
 const sql=original.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
 const tables=[...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? public\.([a-z_]+)/g)].map(x=>x[1]);
 const smoke=tables.map(t=>"IF to_regclass('public."+t+"') IS NULL THEN RAISE EXCEPTION 'MIGRATION_SMOKE_FAILED'; END IF;").join('\n');
 const statement="BEGIN;\nSET LOCAL statement_timeout='30s';\n"+guard+"\n"+sql+"\nDO $$ BEGIN "+(smoke||'NULL;')+" END $$;\nINSERT INTO staging_verification.migrations(name,sha256) VALUES('"+name+"','"+sha(original)+"');\nCOMMIT;\nSELECT '"+name+"' AS applied,(SELECT count(*) FROM staging_verification.migrations) AS migration_records;\n";
 fs.writeFileSync(path.join(dir,name),statement);plan.push({name,sha256:sha(original)});
}
fs.writeFileSync(path.join(ctx.root,'docs/staging-schema-plan.json'),JSON.stringify({projectRef:ctx.ref,baselineSha256:sha(body),apply:false,clientGrants:'closed initially; 005 adds room column SELECT only',storagePoliciesCopied:false,migrations:plan},null,2)+'\n');
console.log('Prepared private schema and 18 guarded, separately executable migration files. No network.');
