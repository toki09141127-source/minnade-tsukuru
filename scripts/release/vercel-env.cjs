/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),cp=require('node:child_process');
const project='prj_ve0GfqaxCLAoywfjAn0vcbWoxVw1';
const mode=process.argv[2];if(!['core','deletion'].includes(mode)||process.argv[3]!==project)throw Error('EXPLICIT_PRODUCTION_PROJECT_REQUIRED');
const cli=fs.readFileSync('.staging-private/vercel-cli-path.txt','utf8').trim();
const flags=mode==='core'?['DB_GUARDS','UPLOADS','ROOM_CREATION','ATOMIC_JOIN','ATOMIC_CORE','MEMBERSHIP_GUARDS','LIKE_REQUESTS','REPORT_INTAKE','REPORT_QUEUE','MODERATION','DRAFTS','ACCOUNT_ATTRIBUTION','ACCOUNT_REQUESTS','ACCOUNT_FINALIZE']:['ACCOUNT_REQUESTS','ACCOUNT_FINALIZE'];
const result={project,mode,at:new Date().toISOString(),updated:[],complete:false};
for(const flag of flags){const name='MVP_'+flag+'_ENABLED',enabled=mode==='deletion'||!['ACCOUNT_REQUESTS','ACCOUNT_FINALIZE'].includes(flag);const r=cp.spawnSync(process.execPath,[cli,'env','add',name,'--environment','production','--project',project,'--scope','sonetokiyas-projects','--force','--yes','--no-sensitive'],{input:String(enabled),encoding:'utf8',windowsHide:true,timeout:60000,env:{...process.env,VERCEL_TELEMETRY_DISABLED:'1'}});if(r.status!==0){console.log('ENV_UPDATE_FAILED '+name);process.exitCode=1;break}result.updated.push(name);console.log('CONFIGURED '+name)}
result.complete=result.updated.length===flags.length;fs.writeFileSync('docs/release52-vercel-'+mode+'-flags.json',JSON.stringify(result,null,2)+'\n');
