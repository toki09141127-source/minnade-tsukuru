BEGIN;
CREATE FUNCTION public.buffer_manual_test_allowed(p_event text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.buffer_test_authorization a CROSS JOIN public.buffer_control c
 WHERE a.enabled AND a.event_id=p_event AND NOT c.enabled AND c.reason='MANUAL'
 AND a.due_at>now()-interval '10 minutes' AND a.due_at<now()+interval '15 minutes')
$$;
CREATE FUNCTION public.buffer_claim_test(p_event text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 IF NOT public.buffer_manual_test_allowed(p_event) OR EXISTS(SELECT 1 FROM public.buffer_queue WHERE state IN ('unknown','sending')) THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buffer_queue q JOIN public.buffer_test_authorization a ON a.event_id=q.event_id WHERE q.event_id=p_event AND q.body=a.body AND q.due_at=a.due_at AND q.attempts=0) THEN RETURN NULL; END IF;
 RETURN public.buffer_claim_internal(p_event);
END $$;
CREATE FUNCTION public.buffer_release_test_guard(p_event text,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 IF NOT public.buffer_manual_test_allowed(p_event) THEN RETURN false; END IF;
 UPDATE public.buffer_queue q SET release_started_at=clock_timestamp()
 FROM public.buffer_test_authorization a WHERE q.event_id=p_event AND a.event_id=q.event_id AND a.enabled
 AND q.body=a.body AND q.due_at=a.due_at AND q.delivery_token=p_token AND q.delivery_until>clock_timestamp()
 AND q.state='scheduled' AND NOT q.cancel_requested AND q.release_started_at IS NULL
 AND q.due_at<=clock_timestamp() AND q.due_at>clock_timestamp()-interval '2 minutes'
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(public.buffer_candidates()) c WHERE c->>'id'=q.event_id);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.buffer_manual_test_allowed(text),public.buffer_claim_test(text),public.buffer_release_test_guard(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buffer_manual_test_allowed(text),public.buffer_claim_test(text),public.buffer_release_test_guard(text,uuid) TO service_role;
COMMIT;
