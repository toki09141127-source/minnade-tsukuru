-- STAGING synthetic DB fixture only. All simulation changes roll back.
BEGIN;
DO $$
DECLARE q public.buffer_queue%ROWTYPE; item jsonb; token uuid;
BEGIN
 SELECT * INTO q FROM public.buffer_queue WHERE event_id='completed_76d5dae7-5995-4cf1-973e-89c92e2d3f64' AND buffer_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SYNTHETIC_FIXTURE_REQUIRED'; END IF;
 IF (SELECT enabled FROM public.buffer_control) THEN RAISE EXCEPTION 'EXPECTED_OFF'; END IF;
 UPDATE public.buffer_queue SET state='scheduled',buffer_id='synthetic_staging_cancel',due_at=now()+interval '10 minutes',created_at=now()-interval '1 hour' WHERE event_id=q.event_id;
 item:=public.buffer_delivery_claim();token:=(item->>'delivery_token')::uuid;
 IF item->>'event_id' IS DISTINCT FROM q.event_id THEN RAISE EXCEPTION 'LEASE_TARGET'; END IF;
 IF public.buffer_delivery_claim() IS NOT NULL THEN RAISE EXCEPTION 'DUPLICATE_LEASE'; END IF;
 IF public.buffer_delivery_finish(q.event_id,gen_random_uuid(),'scheduled') THEN RAISE EXCEPTION 'WRONG_TOKEN'; END IF;
 IF NOT public.buffer_delivery_cancel_mark(q.event_id,token) THEN RAISE EXCEPTION 'MARK_FAILED'; END IF;
 IF NOT public.buffer_delivery_finish(q.event_id,token,'unknown') THEN RAISE EXCEPTION 'UNKNOWN_FAILED'; END IF;
 IF (SELECT enabled FROM public.buffer_control) OR (SELECT state FROM public.buffer_queue WHERE event_id=q.event_id)<>'unknown' THEN RAISE EXCEPTION 'STOP_FAILED'; END IF;
 IF public.buffer_claim(q.event_id) IS NOT NULL THEN RAISE EXCEPTION 'UNKNOWN_RECLAIM'; END IF;
 BEGIN PERFORM public.buffer_resume(); RAISE EXCEPTION 'UNSAFE_RESUME'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='UNSAFE_RESUME' THEN RAISE; END IF; END;
 UPDATE public.buffer_queue SET checked_at=NULL WHERE event_id=q.event_id;
 item:=public.buffer_delivery_claim();token:=(item->>'delivery_token')::uuid;
 IF NOT public.buffer_delivery_finish(q.event_id,token,'cancelled') THEN RAISE EXCEPTION 'CANCEL_FAILED'; END IF;
 IF public.buffer_reconcile(q.event_id,'synthetic_staging_cancel','sent',now(),'https://x.com/minnade_tsukuru/status/999') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 PERFORM public.buffer_resume();
 IF NOT (SELECT enabled FROM public.buffer_control) THEN RAISE EXCEPTION 'RESUME_FAILED'; END IF;
 UPDATE public.buffer_queue SET state='scheduled',cancel_requested=false,checked_at=NULL WHERE event_id=q.event_id;
 item:=public.buffer_delivery_claim();token:=(item->>'delivery_token')::uuid;
 IF NOT public.buffer_delivery_finish(q.event_id,token,'sent',now(),'https://x.com/minnade_tsukuru/status/999') THEN RAISE EXCEPTION 'VERIFY_FAILED'; END IF;
 IF NOT (SELECT state='sent' AND sent_at IS NOT NULL AND external_id='999' FROM public.buffer_queue WHERE event_id=q.event_id) THEN RAISE EXCEPTION 'RECEIPT_PERSISTENCE'; END IF;
 IF has_function_privilege('anon','public.buffer_delivery_claim()','EXECUTE') OR has_function_privilege('authenticated','public.buffer_stop(text)','EXECUTE') OR has_function_privilege('service_role','public.buffer_resume()','EXECUTE') OR has_function_privilege('service_role','public.buffer_reconcile(text,text,text,timestamptz,text)','EXECUTE') OR has_table_privilege('service_role','public.buffer_control','UPDATE') THEN RAISE EXCEPTION 'ACL_FAILED'; END IF;
END $$;
SELECT 'PASS' AS staging_delivery_12_groups;
ROLLBACK;
