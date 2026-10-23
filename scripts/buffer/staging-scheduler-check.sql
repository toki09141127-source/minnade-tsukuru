-- STAGING ONLY; no real credentials, all temporary changes rolled back.
BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM vault.secrets WHERE name='minntuku_buffer_cron') THEN RAISE EXCEPTION 'EXISTING_SECRET'; END IF; END $$;
SELECT vault.create_secret(repeat('TEST_NOT_A_REAL_CREDENTIAL_',2),'minntuku_buffer_cron');
UPDATE public.buffer_scheduler_config SET enabled=true,endpoint='https://minnade-tsukuru-staging-90rzxyegp-sonetokiyas-projects.vercel.app/api/cron/buffer?dryRun=1' WHERE singleton;
SELECT public.buffer_scheduler_tick(); SELECT public.buffer_scheduler_tick(); SELECT public.buffer_scheduler_tick();
SELECT last_status,consecutive_failures,(SELECT enabled FROM public.buffer_control WHERE singleton) AS sending_enabled,
(SELECT count(*) FROM net.http_request_queue) AS queued_requests,
NOT has_function_privilege('anon','public.buffer_scheduler_tick()','EXECUTE') AS anon_denied,
NOT has_function_privilege('authenticated','public.buffer_scheduler_tick()','EXECUTE') AS authenticated_denied,
NOT has_function_privilege('service_role','public.buffer_scheduler_tick()','EXECUTE') AS service_denied,
(SELECT count(*) FROM cron.job_run_details WHERE jobid=(SELECT jobid FROM cron.job WHERE jobname='buffer-staging-tick-check') AND status='succeeded') AS successful_cron_ticks
FROM public.buffer_scheduler_config;
ROLLBACK;
