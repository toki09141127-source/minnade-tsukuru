BEGIN;
CREATE TABLE public.buffer_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 reason text NOT NULL DEFAULT 'NOT_ENABLED',
 stopped_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.buffer_control DEFAULT VALUES;
ALTER TABLE public.buffer_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buffer_control FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.buffer_queue ADD COLUMN delivery_token uuid;
ALTER TABLE public.buffer_queue ADD COLUMN delivery_until timestamptz;
ALTER TABLE public.buffer_queue ADD COLUMN checked_at timestamptz;
ALTER TABLE public.buffer_queue ADD COLUMN verify_failures integer NOT NULL DEFAULT 0;
ALTER TABLE public.buffer_queue ADD COLUMN cancel_requested boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX buffer_remote_id_unique ON public.buffer_queue(buffer_id) WHERE buffer_id IS NOT NULL;
CREATE FUNCTION public.buffer_stop(p_reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_reason NOT IN ('EXCLUDED','CANCEL_UNKNOWN','VERIFY_UNKNOWN','AUTH_FAILURE','ACCOUNT_MISMATCH','INTEGRITY','DAILY_CAP','AMBIGUOUS','MANUAL','UNSAFE_PUBLISHED') THEN RAISE EXCEPTION 'INVALID_REASON'; END IF;
 UPDATE public.buffer_control SET enabled=false,reason=p_reason,stopped_at=clock_timestamp(),updated_at=clock_timestamp() WHERE singleton;
 RETURN true;
END $$;
-- Owner only: never granted to service_role. Resume is deliberate, never automatic.
CREATE FUNCTION public.buffer_resume() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE state IN ('sending','unknown') OR (cancel_requested AND state NOT IN ('cancelled','sent','failed'))) THEN RAISE EXCEPTION 'UNRESOLVED_DELIVERY'; END IF;
 UPDATE public.buffer_control SET enabled=true,reason='OPERATOR_RESUMED',updated_at=clock_timestamp() WHERE singleton;
 RETURN true;
END $$;
CREATE FUNCTION public.buffer_control_state() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT to_jsonb(c) FROM public.buffer_control c WHERE singleton
$$;
ALTER FUNCTION public.buffer_claim(text) RENAME TO buffer_claim_internal;
CREATE FUNCTION public.buffer_claim(p_event text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 IF NOT (SELECT enabled FROM public.buffer_control WHERE singleton) THEN RETURN NULL; END IF;
 q:=public.buffer_claim_internal(p_event);
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE state='unknown') THEN
  PERFORM public.buffer_stop('AMBIGUOUS');
  IF q IS NOT NULL THEN UPDATE public.buffer_queue SET state='queued',token=NULL,started_at=NULL WHERE event_id=q->>'event_id'; END IF;
  RETURN NULL;
 END IF;
 RETURN q;
END $$;
ALTER FUNCTION public.buffer_finish(text,uuid,text,text,text,timestamptz) RENAME TO buffer_finish_internal;
CREATE FUNCTION public.buffer_finish(p_event text,p_token uuid,p_state text,p_code text,p_id text DEFAULT NULL,p_due timestamptz DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE saved boolean;
BEGIN
 saved:=public.buffer_finish_internal(p_event,p_token,p_state,p_code,p_id,p_due);
 IF saved AND p_state='succeeded' THEN UPDATE public.buffer_queue SET state='scheduled' WHERE event_id=p_event; END IF;
 IF saved AND p_state='unknown' THEN PERFORM public.buffer_stop('AMBIGUOUS'); END IF;
 IF saved AND p_code IN ('ACCESS_DENIED','PRECHECK_FAILED') AND
  (SELECT attempts>=3 FROM public.buffer_queue WHERE event_id=p_event) THEN PERFORM public.buffer_stop('AUTH_FAILURE'); END IF;
 RETURN saved;
END $$;
CREATE FUNCTION public.buffer_send_guard(p_event text,p_token uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT coalesce((SELECT c.enabled AND q.state='sending' AND q.token=p_token
 FROM public.buffer_queue q CROSS JOIN public.buffer_control c WHERE q.event_id=p_event AND c.singleton),false)
$$;
CREATE FUNCTION public.buffer_delivery_claim() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.buffer_queue%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE state='unknown') THEN PERFORM public.buffer_stop('AMBIGUOUS'); END IF;
 IF EXISTS(SELECT 1 FROM public.buffer_queue GROUP BY (due_at AT TIME ZONE 'Asia/Tokyo')::date HAVING count(*)>2) THEN PERFORM public.buffer_stop('DAILY_CAP'); END IF;
 SELECT * INTO q FROM public.buffer_queue
 WHERE buffer_id IS NOT NULL AND state IN ('succeeded','scheduled','unknown')
 AND (delivery_until IS NULL OR delivery_until<clock_timestamp())
 AND (checked_at IS NULL OR checked_at<clock_timestamp()-interval '30 seconds')
 ORDER BY checked_at NULLS FIRST,due_at LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.buffer_queue SET delivery_token=gen_random_uuid(),delivery_until=clock_timestamp()+interval '45 seconds'
 WHERE event_id=q.event_id RETURNING * INTO q;
 RETURN to_jsonb(q);
END $$;
CREATE FUNCTION public.buffer_delivery_cancel_mark(p_event text,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.buffer_queue SET cancel_requested=true WHERE event_id=p_event AND delivery_token=p_token
 AND delivery_until>clock_timestamp() AND state IN ('succeeded','scheduled','unknown');
 RETURN FOUND;
END $$;
CREATE FUNCTION public.buffer_delivery_finish(p_event text,p_token uuid,p_state text,p_sent timestamptz DEFAULT NULL,p_external text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.buffer_queue%ROWTYPE; saved boolean;
BEGIN
 SELECT * INTO q FROM public.buffer_queue WHERE event_id=p_event FOR UPDATE;
 IF NOT FOUND OR q.delivery_token IS DISTINCT FROM p_token OR q.delivery_until<=clock_timestamp() OR q.state NOT IN ('succeeded','scheduled','unknown') THEN RETURN false; END IF;
 IF p_state='cancelled' THEN
  IF NOT q.cancel_requested THEN RAISE EXCEPTION 'CANCEL_NOT_REQUESTED'; END IF;
  UPDATE public.buffer_queue SET state='cancelled',result_code='BUFFER_CANCELLED',retry_at=NULL WHERE event_id=p_event;
 ELSIF p_state IN ('sent','failed','scheduled') THEN
  IF q.cancel_requested AND p_state='scheduled' THEN RAISE EXCEPTION 'CANCEL_IS_STICKY'; END IF;
  saved:=public.buffer_reconcile(p_event,q.buffer_id,p_state,p_sent,p_external);
  IF NOT saved THEN RAISE EXCEPTION 'INVALID_RECEIPT'; END IF;
  IF p_state='sent' AND q.cancel_requested THEN PERFORM public.buffer_stop('UNSAFE_PUBLISHED'); END IF;
 ELSIF p_state='waiting' THEN
  IF clock_timestamp()>q.due_at+interval '10 minutes' THEN PERFORM public.buffer_stop('VERIFY_UNKNOWN'); UPDATE public.buffer_queue SET state='unknown' WHERE event_id=p_event; END IF;
 ELSIF p_state IN ('pending','unknown') THEN
  UPDATE public.buffer_queue SET verify_failures=verify_failures+1,
   state=CASE WHEN p_state='unknown' THEN 'unknown' ELSE state END,retry_at=NULL WHERE event_id=p_event;
  IF q.cancel_requested OR p_state='unknown' OR q.verify_failures>=2 OR clock_timestamp()>q.due_at+interval '10 minutes' THEN
   PERFORM public.buffer_stop(CASE WHEN q.cancel_requested THEN 'CANCEL_UNKNOWN' ELSE 'VERIFY_UNKNOWN' END);
   UPDATE public.buffer_queue SET state='unknown' WHERE event_id=p_event;
  END IF;
 ELSE RAISE EXCEPTION 'INVALID_STATE'; END IF;
 UPDATE public.buffer_queue SET checked_at=clock_timestamp(),delivery_until=NULL,delivery_token=NULL,
 verify_failures=CASE WHEN p_state IN ('sent','scheduled','cancelled') THEN 0 ELSE verify_failures END,
 updated_at=clock_timestamp() WHERE event_id=p_event;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.buffer_stop(text),public.buffer_resume(),public.buffer_control_state(),public.buffer_claim(text),
 public.buffer_claim_internal(text),public.buffer_finish_internal(text,uuid,text,text,text,timestamptz),
 public.buffer_finish(text,uuid,text,text,text,timestamptz),public.buffer_send_guard(text,uuid),public.buffer_delivery_claim(),
 public.buffer_delivery_cancel_mark(text,uuid),public.buffer_delivery_finish(text,uuid,text,timestamptz,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buffer_stop(text),public.buffer_control_state(),public.buffer_claim(text),
 public.buffer_finish(text,uuid,text,text,text,timestamptz),public.buffer_send_guard(text,uuid),public.buffer_delivery_claim(),
 public.buffer_delivery_cancel_mark(text,uuid),public.buffer_delivery_finish(text,uuid,text,timestamptz,text) TO service_role;
COMMIT;
