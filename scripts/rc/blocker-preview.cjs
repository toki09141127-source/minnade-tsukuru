/* eslint-disable @typescript-eslint/no-require-imports -- Staging-only release blocker deployment, metadata output only. */
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), assert = require('node:assert/strict');
const ctx = require('../staging/safety.cjs').load();
const file = 'docs/v2-rc-preview-deployment.json';
const cli = fs.readFileSync('.staging-private/vercel-cli-path.txt', 'utf8').trim();
const run = args => cp.spawnSync(process.execPath, [cli, ...args], {encoding:'utf8', windowsHide:true, timeout:120000, maxBuffer:4e6});
try {
  assert.equal(ctx.ref, 'fwqucffxdmbdczspkcyr');
  assert.match(ctx.env.STRIPE_TEST_SECRET_KEY, /^sk_test_/);
  if (process.argv.includes('--inspect')) {
    const d = JSON.parse(fs.readFileSync(file));
    assert.equal(d.projectId, 'prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy');
    assert.equal(d.target, 'preview');
    const r = run(['inspect', d.url, '--scope', 'sonetokiyas-projects', '--json']);
    assert.equal(r.status, 0, 'INSPECTION_FAILED');
    const raw = JSON.parse(r.stdout);
    assert.equal(raw.name, d.project);
    if (raw.projectId) assert.equal(raw.projectId, d.projectId);
    assert.ok(!raw.target || raw.target === 'preview');
    assert.equal('https://' + raw.url, d.url);
    d.state = raw.readyState || raw.status;
    d.deploymentId = raw.id;
    d.observedAt = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
    console.log(JSON.stringify({url:d.url, state:d.state, target:d.target, productionChanges:'NONE'}));
  } else {
    assert.ok(process.argv.includes('--deploy'), 'EXPLICIT_DEPLOY_REQUIRED');
    for (const name of ['docs/v2-production-legal-validation.json','docs/v2-production-restore-059-result.json']) {
      assert.equal(JSON.parse(fs.readFileSync(name)).complete, true, 'VALIDATION_REQUIRED');
    }
    const dir = fs.readFileSync('.staging-private/v2rc-preview-dir.txt', 'utf8').trim();
    const p = JSON.parse(fs.readFileSync(path.join(dir, '.vercel/project.json')));
    assert.equal(p.projectId, 'prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy');
    assert.equal(p.projectName, 'minnade-tsukuru-staging');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'vercel.json'))).crons, []);
    const h = crypto.createHash('sha256'); let files = 0;
    const secrets = Object.entries(ctx.env).filter(([k,v])=>v && v.length >= 16 && /SECRET|PASSWORD|SERVICE_ROLE|OPENAI_API_KEY/.test(k)).map(([,v])=>Buffer.from(v));
    const walk = rel => {for (const ent of fs.readdirSync(path.join(dir, rel), {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const sub = path.join(rel, ent.name); assert.ok(!ent.isSymbolicLink(), 'SOURCE_SYMLINK');
      if (ent.isDirectory()) walk(sub);
      else {const bytes=fs.readFileSync(path.join(dir,sub));assert.ok(!secrets.some(v=>bytes.includes(v)), 'SOURCE_SECRET_MATCH');h.update(sub.replaceAll('\\','/')+'\0');h.update(bytes);h.update('\0');files++;}
    }};
    walk('');
    const digest = h.digest('hex');
    const previous = JSON.parse(fs.readFileSync(file));
    const archive = 'docs/v2-rc-pre-consent-preview-deployment.json';
    if (!fs.existsSync(archive)) fs.writeFileSync(archive, JSON.stringify(previous,null,2)+'\n');
    const r = run(['deploy','--yes','--environment','preview','--scope','sonetokiyas-projects','--cwd',dir,'--no-wait','--json',
      '--env','V2_SCHEMA_VERSION=58','--env','AI_ENABLED=false',
      '--env','MVP_ACCOUNT_REQUESTS_ENABLED=true','--env','MVP_ACCOUNT_FINALIZE_ENABLED=true']);
    assert.equal(r.status,0,'DEPLOY_FAILED');
    const url = ((r.stdout||'')+'\n'+(r.stderr||'')).match(/https:\/\/minnade-tsukuru-staging-[a-z0-9]+-sonetokiyas-projects\.vercel\.app/)?.[0];
    assert.ok(url, 'PREVIEW_URL_MISSING');
    const d = {url,project:p.projectName,projectId:p.projectId,scope:'sonetokiyas-projects',target:'preview',
      sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),localChanges:true,
      sourceManifestSHA256:digest,sourceFileCount:files,state:'QUEUED',aiGenerationEnabled:false,
      schemaFoundation:58,consentMigration:59,consentVersion:'2026-10-24',
      retirementFlags:'deployment-only; DB intake/worker pause unchanged',productionChanges:'NONE',createdAt:new Date().toISOString()};
    fs.writeFileSync(file,JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify(d));
  }
} catch {
  console.log(JSON.stringify({complete:false,category:'PREVIEW_METADATA_OR_VALIDATION_FAILED',rawOutputSaved:false,productionChanges:'NONE'}));
  process.exitCode=1;
}
