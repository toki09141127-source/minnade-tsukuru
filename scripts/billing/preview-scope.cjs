/* eslint-disable @typescript-eslint/no-require-imports -- Exact approved test Preview boundary. */
const fs=require('fs'),assert=require('node:assert/strict');
const PREVIEW_URL='https://minnade-tsukuru-staging-8531792ul-sonetokiyas-projects.vercel.app';
function deployment(){const d=JSON.parse(fs.readFileSync('docs/v2-4-preview-deployment.json'));assert.equal(d.url,PREVIEW_URL);assert.equal(d.target,'preview');assert.equal(d.projectId,'prj_Qo1OsPU4tdgA2fluqzbAr1kTk6Dy');assert.equal(d.state,'READY');const ctx=require('../staging/safety.cjs').load();assert.equal(ctx.ref,'fwqucffxdmbdczspkcyr');assert.match(ctx.env.STRIPE_TEST_SECRET_KEY,/^sk_test_/);return {d,ctx};}
function access(){const {d}=deployment(),a=JSON.parse(fs.readFileSync('.staging-private/v24-preview-access.json'));assert.equal(a.url,d.url);assert.ok(Date.parse(a.expiresAt)>Date.now(),'PREVIEW_ACCESS_EXPIRED');assert.ok(Date.parse(a.expiresAt)<=Date.parse(a.createdAt)+2*3600000);for(const c of a.cookies){assert.equal(c.domain,new URL(d.url).hostname);assert.equal(c.path,'/');assert.equal(c.secure,true);assert.equal(c.httpOnly,true);}return a;}
module.exports={deployment,access};
