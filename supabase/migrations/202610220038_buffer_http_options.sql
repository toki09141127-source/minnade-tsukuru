BEGIN;
CREATE OR REPLACE FUNCTION public.buffer_scheduler_tick() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE cfg public.buffer_scheduler_config%ROWTYPE; credential text; status integer:=0;
BEGIN
 -- Serialize only scheduler invocations, never worker RPC transactions.
 IF NOT pg_try_advisory_xact_lock(54221037) THEN RETURN NULL; END IF;
 SELECT * INTO cfg FROM public.buffer_scheduler_config WHERE singleton;
 IF NOT cfg.enabled THEN RETURN NULL; END IF;
 IF cfg.endpoint='' THEN PERFORM public.buffer_stop('INTEGRITY'); RETURN NULL; END IF;
 SELECT decrypted_secret INTO credential FROM vault.decrypted_secrets WHERE name='minntuku_buffer_cron';
 IF credential IS NULL OR length(credential)<32 THEN PERFORM public.buffer_stop('AUTH_FAILURE'); RETURN NULL; END IF;
 BEGIN
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','55000');
  PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5000');
  -- libcurl default does not follow redirects; this extension has no runtime override.
  SELECT r.status INTO status FROM extensions.http(ROW('GET',cfg.endpoint,ARRAY[ROW('Authorization','Bearer '||credential)::extensions.http_header],NULL,NULL)::extensions.http_request) r;
 EXCEPTION WHEN OTHERS THEN status:=0;
 END;
 -- No response body, header, credential or URL query is persisted.
 UPDATE public.buffer_scheduler_config SET last_tick=clock_timestamp(),last_status=status,
 consecutive_failures=CASE WHEN status=200 THEN 0 ELSE consecutive_failures+1 END WHERE singleton
 RETURNING * INTO cfg;
 IF cfg.consecutive_failures>=3 THEN PERFORM public.buffer_stop('INTEGRITY'); END IF;
 RETURN status::bigint;
END $$;
REVOKE ALL ON FUNCTION public.buffer_scheduler_tick() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
