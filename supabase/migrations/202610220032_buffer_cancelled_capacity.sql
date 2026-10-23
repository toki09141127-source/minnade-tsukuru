-- Unsent cancelled work has no external side effect and does not consume a posting cap.
-- Sent, unknown, and remotely cancelled reservations still consume the cap.
BEGIN;
CREATE OR REPLACE FUNCTION public.buffer_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('now',now(),'candidates',public.buffer_candidates(),
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('eventId',event_id,'contentKey',content_key,'kind',kind,'dueAt',due_at,
 'state',CASE WHEN state='cancelled' AND buffer_id IS NULL THEN 'cancelled' WHEN state IN ('sent','succeeded') THEN 'sent' WHEN state='unknown' THEN 'uncertain' ELSE 'reserved' END))
 FROM public.buffer_queue),'[]'::jsonb),
 'queue',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM public.buffer_queue q
 WHERE state IN ('queued','failed') AND due_at>now() AND due_at<=now()+interval '15 minutes'),'[]'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public.buffer_reserve(p_plan jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p jsonb; n integer:=0; candidates jsonb;
BEGIN
 IF jsonb_typeof(p_plan) IS DISTINCT FROM 'array' OR jsonb_array_length(p_plan)>2 THEN RAISE EXCEPTION 'INVALID_PLAN'; END IF;
 PERFORM pg_advisory_xact_lock(54221029);
 candidates:=public.buffer_candidates();
 FOR p IN SELECT * FROM jsonb_array_elements(p_plan) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(candidates) c WHERE c->>'id'=p->>'eventId'
   AND c->>'kind'=p->>'kind' AND ((c->>'kind')||':'||(c->>'targetId'))=p->>'contentKey'
   AND (c->>'expiresAt')::timestamptz>(p->>'dueAt')::timestamptz) THEN CONTINUE; END IF;
  IF (p->>'dueAt')::timestamptz<=now() OR
   ((p->>'dueAt')::timestamptz AT TIME ZONE 'Asia/Tokyo')::date<>(now() AT TIME ZONE 'Asia/Tokyo')::date OR
   ((p->>'dueAt')::timestamptz AT TIME ZONE 'Asia/Tokyo')::time NOT IN ('12:00:00'::time,'20:30:00'::time) THEN CONTINUE; END IF;
  IF (SELECT count(*) FROM public.buffer_queue WHERE NOT (state='cancelled' AND buffer_id IS NULL) AND (due_at AT TIME ZONE 'Asia/Tokyo')::date=
      ((p->>'dueAt')::timestamptz AT TIME ZONE 'Asia/Tokyo')::date)>=2 THEN CONTINUE; END IF;
  IF p->>'kind'='new_room' AND EXISTS(SELECT 1 FROM public.buffer_queue WHERE kind='new_room'
      AND (due_at AT TIME ZONE 'Asia/Tokyo')::date=((p->>'dueAt')::timestamptz AT TIME ZONE 'Asia/Tokyo')::date) THEN CONTINUE; END IF;
  INSERT INTO public.buffer_queue(event_id,content_key,kind,due_at,body)
   VALUES(p->>'eventId',p->>'contentKey',p->>'kind',(p->>'dueAt')::timestamptz,p->>'text')
   ON CONFLICT DO NOTHING;
  IF FOUND THEN n:=n+1; END IF;
 END LOOP;
 RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.buffer_reserve_test() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.buffer_test_authorization%ROWTYPE; c jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 SELECT * INTO a FROM public.buffer_test_authorization WHERE enabled=true FOR UPDATE;
 IF NOT FOUND OR a.due_at<=now()+interval '2 minutes' OR a.due_at>now()+interval '15 minutes' THEN RETURN 0; END IF;
 SELECT x INTO c FROM jsonb_array_elements(public.buffer_candidates()) x WHERE x->>'id'=a.event_id
 AND x->>'kind'='completed' AND x->>'title' LIKE 'TEST Buffer%';
 IF c IS NULL OR (c->>'expiresAt')::timestamptz<=a.due_at THEN RETURN 0; END IF;
 IF (SELECT count(*) FROM public.buffer_queue WHERE NOT (state='cancelled' AND buffer_id IS NULL) AND (due_at AT TIME ZONE 'Asia/Tokyo')::date=(a.due_at AT TIME ZONE 'Asia/Tokyo')::date)>=2 THEN RETURN 0; END IF;
 INSERT INTO public.buffer_queue(event_id,content_key,kind,due_at,body)
 VALUES(a.event_id,'completed:'||a.room_id::text,'completed',a.due_at,a.body) ON CONFLICT DO NOTHING;
 IF FOUND THEN RETURN 1; END IF;
 RETURN 0;
END $$;
CREATE OR REPLACE FUNCTION public.buffer_delivery_claim() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.buffer_queue%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE state='unknown') THEN PERFORM public.buffer_stop('AMBIGUOUS'); END IF;
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE NOT (state='cancelled' AND buffer_id IS NULL) GROUP BY (due_at AT TIME ZONE 'Asia/Tokyo')::date HAVING count(*)>2) THEN PERFORM public.buffer_stop('DAILY_CAP'); END IF;
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
REVOKE EXECUTE ON FUNCTION public.buffer_reconcile(text,text,text,timestamptz,text) FROM service_role;
COMMIT;
