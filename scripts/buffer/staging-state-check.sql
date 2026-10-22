-- STAGING TEST ROW ONLY. Entire state simulation rolls back.
BEGIN;
DO $$
DECLARE q public.buffer_queue%ROWTYPE; claimed jsonb; extra uuid;
BEGIN
 SELECT * INTO STRICT q FROM public.buffer_queue WHERE event_id='completed_76d5dae7-5995-4cf1-973e-89c92e2d3f64' FOR UPDATE;
 IF q.state<>'failed' OR q.result_code<>'PRECHECK_FAILED' OR q.retry_at IS NULL OR q.buffer_id IS NOT NULL THEN RAISE EXCEPTION 'FIXTURE_STATE_MISMATCH'; END IF;
 UPDATE public.buffer_queue SET retry_at=now()-interval '1 second' WHERE event_id=q.event_id;
 claimed:=public.buffer_claim(q.event_id);
 IF claimed->>'state'<>'sending' OR (claimed->>'attempts')::int<>2 THEN RAISE EXCEPTION 'RETRY_FAILED'; END IF;
 IF NOT public.buffer_finish(q.event_id,(claimed->>'token')::uuid,'unknown','AMBIGUOUS') THEN RAISE EXCEPTION 'UNKNOWN_WRITE_FAILED'; END IF;
 IF public.buffer_claim(q.event_id) IS NOT NULL THEN RAISE EXCEPTION 'UNKNOWN_RECLAIMED'; END IF;
 IF public.buffer_reserve_test()<>0 THEN RAISE EXCEPTION 'UNKNOWN_REENQUEUED'; END IF;
 UPDATE public.buffer_queue SET state='sending',started_at=now()-interval '3 minutes' WHERE event_id=q.event_id;
 PERFORM public.buffer_claim(q.event_id);
 IF (SELECT state FROM public.buffer_queue WHERE event_id=q.event_id)<>'unknown' THEN RAISE EXCEPTION 'CRASH_NOT_UNKNOWN'; END IF;
 UPDATE public.buffer_queue SET state='sending',token=gen_random_uuid() WHERE event_id=q.event_id RETURNING * INTO q;
 IF NOT public.buffer_finish(q.event_id,q.token,'succeeded','BUFFER_ACCEPTED','synthetic_db_only',q.due_at) THEN RAISE EXCEPTION 'ACCEPT_FAILED'; END IF;
 IF NOT public.buffer_reconcile(q.event_id,'synthetic_db_only','scheduled') THEN RAISE EXCEPTION 'SCHEDULED_FAILED'; END IF;
 IF NOT public.buffer_reconcile(q.event_id,'synthetic_db_only','sent',now(),'https://x.com/minnade_tsukuru/status/1') THEN RAISE EXCEPTION 'SENT_FAILED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buffer_queue WHERE event_id=q.event_id AND state='sent' AND external_id='1' AND sent_at IS NOT NULL) THEN RAISE EXCEPTION 'SENT_METADATA_FAILED'; END IF;
 UPDATE public.buffer_reviews SET excluded=true WHERE room_id='9d8341d7-d03f-44ae-9426-1cbe6dcdecb4';
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.buffer_candidates()) c WHERE c->>'targetId'='9d8341d7-d03f-44ae-9426-1cbe6dcdecb4') THEN RAISE EXCEPTION 'RECHECK_FAILED'; END IF;
 UPDATE public.buffer_reviews SET excluded=false WHERE room_id='9d8341d7-d03f-44ae-9426-1cbe6dcdecb4';
 UPDATE public.buffer_test_authorization SET room_id='9d8341d7-d03f-44ae-9426-1cbe6dcdecb4',event_id='completed_9d8341d7-d03f-44ae-9426-1cbe6dcdecb4',due_at=now()+interval '13 minutes';
 INSERT INTO public.buffer_queue(event_id,content_key,kind,due_at,body,state)
 VALUES('TEST_CAP_ONLY','completed:TEST_CAP_ONLY','completed',now()+interval '12 minutes','TEST no external send','cancelled');
 IF public.buffer_reserve_test()<>0 THEN RAISE EXCEPTION 'DAILY_CAP_FAILED'; END IF;
 DELETE FROM public.buffer_queue WHERE event_id='TEST_CAP_ONLY' AND buffer_id IS NULL;
 IF public.buffer_reserve_test()<>1 OR public.buffer_reserve_test()<>0 THEN RAISE EXCEPTION 'RESERVE_AFTER_CAP_FAILED'; END IF;
END $$;
SELECT 'PASS' AS state_tests, 11 AS assertions, 'ROLLBACK; no Buffer API calls' AS scope;
ROLLBACK;
SELECT (
 NOT has_table_privilege('anon','public.buffer_queue','SELECT')
 AND NOT has_table_privilege('authenticated','public.buffer_queue','INSERT')
 AND NOT has_table_privilege('service_role','public.buffer_queue','INSERT')
 AND has_function_privilege('service_role','public.buffer_claim(text)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.buffer_claim(text)','EXECUTE')
 AND NOT has_function_privilege('anon','public.buffer_reserve_test()','EXECUTE')
 AND NOT has_table_privilege('service_role','public.buffer_test_authorization','UPDATE')
 AND (SELECT count(*) FROM pg_class WHERE oid IN ('public.buffer_queue'::regclass,'public.buffer_reviews'::regclass,'public.buffer_test_authorization'::regclass) AND relrowsecurity)=3
 AND (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.buffer_queue'::regclass AND NOT tgisinternal)=0
) AS acl_rls_trigger_pass,
 (SELECT state FROM public.buffer_queue WHERE event_id='completed_76d5dae7-5995-4cf1-973e-89c92e2d3f64') AS original_state_restored;
