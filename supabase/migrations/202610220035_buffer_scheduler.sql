BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE TABLE public.buffer_scheduler_config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 endpoint text NOT NULL DEFAULT '',
 last_tick timestamptz,
 CHECK(endpoint='' OR endpoint ~ '^https://minnade-tsukuru(-staging[-a-z0-9]*)?[.]vercel[.]app/api/cron/buffer([?]dryRun=1)?$')
);
INSERT INTO public.buffer_scheduler_config DEFAULT VALUES;
CREATE TABLE public.buffer_scheduler_requests (
 request_id bigint PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.buffer_scheduler_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buffer_scheduler_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buffer_scheduler_config,public.buffer_scheduler_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.buffer_scheduler_tick() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE cfg public.buffer_scheduler_config%ROWTYPE; credential text; id bigint; failures integer;
BEGIN
 SELECT * INTO cfg FROM public.buffer_scheduler_config WHERE singleton;
 IF NOT cfg.enabled THEN RETURN NULL; END IF;
 UPDATE public.buffer_scheduler_config SET last_tick=clock_timestamp() WHERE singleton;
 IF cfg.endpoint='' THEN PERFORM public.buffer_stop('INTEGRITY'); RETURN NULL; END IF;
 -- Three failed/missing (>90s) recent requests stop new sends. Drafts remain unpublished.
 SELECT count(*) INTO failures FROM (
  SELECT r.request_id FROM public.buffer_scheduler_requests r LEFT JOIN net._http_response h ON h.id=r.request_id
  WHERE r.created_at<clock_timestamp()-interval '90 seconds' ORDER BY r.created_at DESC LIMIT 3
 ) recent JOIN public.buffer_scheduler_requests r USING(request_id) LEFT JOIN net._http_response h ON h.id=r.request_id
 WHERE h.status_code IS DISTINCT FROM 200;
 IF failures=3 THEN PERFORM public.buffer_stop('INTEGRITY'); END IF;
 SELECT decrypted_secret INTO credential FROM vault.decrypted_secrets WHERE name='minntuku_buffer_cron';
 IF credential IS NULL OR length(credential)<32 THEN PERFORM public.buffer_stop('AUTH_FAILURE'); RETURN NULL; END IF;
 id:=net.http_get(url:=cfg.endpoint,headers:=jsonb_build_object('Authorization','Bearer '||credential),timeout_milliseconds:=65000);
 INSERT INTO public.buffer_scheduler_requests(request_id) VALUES(id);
 RETURN id;
END $$;
REVOKE ALL ON FUNCTION public.buffer_scheduler_tick() FROM PUBLIC,anon,authenticated,service_role;
-- Installation does not enable scheduler or sending. Owner configures Vault and cron only after deploy.
COMMIT;
