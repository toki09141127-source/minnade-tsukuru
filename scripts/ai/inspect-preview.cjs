/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs=require('fs'),cp=require('child_process');
const file='docs/v2-2-preview-deployment.json',d=JSON.parse(fs.readFileSync(file)),cli=fs.readFileSync('.staging-private/vercel-cli-path.txt','utf8').trim();
if(d.target!=='preview'||d.project!=='minnade-tsukuru-staging'||!d.url.startsWith('https://minnade-tsukuru-staging-'))throw Error('PREVIEW_SCOPE');
const r=cp.spawnSync(process.execPath,[cli,'inspect',d.url,'--wait','--timeout','55s','--json','--scope','sonetokiyas-projects'],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:2e6});
let data;try{data=JSON.parse(r.stdout)}catch{console.log(JSON.stringify({inspectionPending:true,exitCode:r.status}));process.exit(0);}
d.state=data.readyState||data.status||data.state||'UNKNOWN';d.deploymentId=data.id||data.uid;d.observedAt=new Date().toISOString();
fs.writeFileSync(file,JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({url:d.url,state:d.state,keys:Object.keys(data)}));