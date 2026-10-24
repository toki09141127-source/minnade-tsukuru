/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('fs'),cp=require('child_process'),x=require('./free-release-context.cjs');
const stage=require('../staging/safety.cjs').load().env,prod=x.env();
const values=[];for(const env of [stage,prod])for(const [k,v]of Object.entries(env))if(/SECRET|TOKEN|PASSWORD|DATABASE_URL|SERVICE_ROLE|OPENAI_API_KEY/.test(k)&&typeof v==='string'&&v.length>12)values.push(v);
values.push(x.P.password());
const files=cp.execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>fs.existsSync(p)&&fs.statSync(p).isFile());let matches=0,forbidden=0;
for(const p of files){if(/(?:^|\/)(?:\.env(?:\.local)?|\.staging-private|.*\.aes|.*\.dpapi)(?:\/|$)/.test(p))forbidden++;const b=fs.readFileSync(p);for(const v of values)if(b.includes(Buffer.from(v)))matches++;}
const inv=require('./migrations.cjs').inventory(),j=x.read('v2-free-production-migrations.json');for(const e of j.entries)x.assert.equal(inv.find(n=>n.number===e.number).sha256,e.sha256);
const out={at:new Date().toISOString(),files:files.length,exactSecretMatches:matches,forbiddenPrivateFiles:forbidden,appliedMigrationHashes:18,complete:matches===0&&forbidden===0};x.save('v2-free-release-secret-scan.json',out);console.log(JSON.stringify(out));if(!out.complete)process.exitCode=1;
