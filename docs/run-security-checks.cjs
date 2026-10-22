/* eslint-disable @typescript-eslint/no-require-imports -- Offline regression entrypoint. */
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const test of ['security-route-check.cjs','security-audit-check.cjs','mvp-upload-validation.cjs','mvp-privacy-check.cjs','mvp-database-check.cjs','account-deletion-db-check.cjs','completion-check.cjs','account-deletion-adapter-check.cjs','deletion-retention-check.cjs','deletion-attribution-check.cjs','scoped-moderation-check.cjs','report-intake-check.cjs','report-queue-check.cjs','report-queue-ui-check.cjs','upload-cleanup-check.cjs','like-request-check.cjs','room-creation-check.cjs','report-admission-check.cjs','deletion-preflight-check.cjs','staging-safety-check.cjs','release-ui-check.cjs']) {
 const run=spawnSync(process.execPath,['--require',path.join(__dirname,'audit-no-network.cjs'),path.join(__dirname,test)],{cwd:root,stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'audit-placeholder',SUPABASE_SERVICE_ROLE_KEY:'audit-placeholder',CRON_SECRET:'audit-placeholder',MVP_DB_GUARDS_ENABLED:'false'}});
 if(run.status!==0){process.exitCode=run.status||1;break;}
}
