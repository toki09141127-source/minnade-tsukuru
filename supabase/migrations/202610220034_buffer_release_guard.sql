BEGIN;
-- Unattended work is held as a Buffer draft. Only a fenced final release can publish.
ALTER TABLE public.buffer_queue ADD COLUMN release_started_at timestamptz;
CREATE FUNCTION public.buffer_release_guard(p_event text,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 IF NOT (SELECT enabled FROM public.buffer_control WHERE singleton) THEN RETURN false; END IF;
 UPDATE public.buffer_queue SET release_started_at=clock_timestamp()
 WHERE event_id=p_event AND delivery_token=p_token AND delivery_until>clock_timestamp()
 AND state='scheduled' AND NOT cancel_requested AND release_started_at IS NULL
 AND due_at<=clock_timestamp() AND due_at>clock_timestamp()-interval '2 minutes'
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(public.buffer_candidates()) c WHERE c->>'id'=event_id);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.buffer_release_guard(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buffer_release_guard(text,uuid) TO service_role;
COMMIT;
