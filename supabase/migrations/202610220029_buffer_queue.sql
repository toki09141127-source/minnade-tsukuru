-- LOCAL CANDIDATE ONLY. Do not apply to production without explicit approval.
BEGIN;
CREATE TABLE public.buffer_reviews (
 room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE RESTRICT,
 excluded boolean NOT NULL DEFAULT true,
 reviewed_hash text,
 pii_clear boolean NOT NULL DEFAULT false,
 reviewed_at timestamptz,
 CHECK(reviewed_hash IS NULL OR reviewed_hash ~ '^[0-9a-f]{64}$')
);
CREATE TABLE public.buffer_queue (
 event_id text PRIMARY KEY,
 content_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('completed','new_room','deadline','weekly')),
 due_at timestamptz NOT NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','succeeded','failed','unknown','cancelled')),
 attempts integer NOT NULL DEFAULT 0,
 token uuid,
 started_at timestamptz,
 retry_at timestamptz,
 result_code text,
 buffer_id text,
 buffer_due_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buffer_one_slot ON public.buffer_queue(due_at);
ALTER TABLE public.buffer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buffer_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buffer_reviews,public.buffer_queue FROM PUBLIC,anon,authenticated,service_role;
-- Only a separately authorized operator session may record review / opt-out.
-- No client or service-role direct writes. No existing tables or triggers changed.
CREATE FUNCTION public.buffer_source_hash(p_room uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('title',r.title,'blocks',d.blocks)::text,'UTF8')),'hex')
 FROM public.rooms r LEFT JOIN public.work_drafts d ON d.room_id=r.id WHERE r.id=p_room
$$;
CREATE FUNCTION public.buffer_candidates() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH eligible AS (
 SELECT r.*, v.reviewed_at, d.published_at,
 (45-(SELECT count(*) FROM public.room_members m WHERE m.room_id=r.id AND m.role='supporter' AND m.left_at IS NULL))::int seats
 FROM public.rooms r JOIN public.buffer_reviews v ON v.room_id=r.id
 LEFT JOIN public.work_drafts d ON d.room_id=r.id
 WHERE r.is_hidden=false AND r.deleted_at IS NULL AND r.is_adult=false
 AND v.excluded=false AND v.pii_clear=true AND v.reviewed_at IS NOT NULL
 AND v.reviewed_hash=public.buffer_source_hash(r.id)
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs j WHERE j.actor_id=r.created_by)
 AND NOT EXISTS(SELECT 1 FROM public.report_intake i
   WHERE (i.target_type='room' AND i.target_id=r.id OR i.target_type='post' AND EXISTS(
     SELECT 1 FROM public.posts p WHERE p.id=i.target_id AND p.room_id=r.id))
   AND NOT EXISTS(SELECT 1 FROM public.report_resolutions x WHERE x.receipt_id=i.id))
 -- Legacy reports have no reliable resolution field: fail closed.
 AND NOT EXISTS(SELECT 1 FROM public.reports z WHERE z.target_room_id=r.id
   OR EXISTS(SELECT 1 FROM public.posts p WHERE p.id=z.target_post_id AND p.room_id=r.id))
 ), items AS (
 SELECT jsonb_build_object(
 'id',k.kind||'_'||e.id::text,'kind',k.kind,'targetId',e.id::text,
 'createdAt',coalesce(e.published_at,e.started_at),'expiresAt',CASE WHEN k.kind='completed' THEN e.published_at+interval '7 days' ELSE e.expires_at END,
 'snapshotAt',now(),'public',true,'hidden',false,'deleted',false,'pendingReport',false,
 'creatorExcluded',false,'reviewed',true,'piiClear',true,'title',e.title,
 'seatsAvailable',e.seats,'deadlineAt',e.expires_at) c
 FROM eligible e CROSS JOIN (VALUES ('completed'),('new_room'),('deadline')) k(kind)
 WHERE (k.kind='completed' AND e.status='forced_publish' AND e.published_at IS NOT NULL)
 OR (k.kind IN ('new_room','deadline') AND e.status='open' AND e.expires_at>now()
   AND (k.kind<>'new_room' OR e.started_at>now()-interval '2 days'))
 UNION ALL
 SELECT jsonb_build_object('id','weekly_'||to_char(now() AT TIME ZONE 'Asia/Tokyo','IYYY_IW'),
 'kind','weekly','targetId',to_char(now() AT TIME ZONE 'Asia/Tokyo','IYYY_IW'),
 'createdAt',date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo',
 'expiresAt',(date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo')+interval '7 days') AT TIME ZONE 'Asia/Tokyo',
 'snapshotAt',now(),'public',true,'hidden',false,'deleted',false,'pendingReport',false,
 'creatorExcluded',false,'reviewed',true,'piiClear',true,'title','公開許可済みルームの週次まとめ',
 'weeklyCounts',jsonb_build_object(
   'rooms',count(*) FILTER(WHERE started_at>=date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo'),
   'works',count(*) FILTER(WHERE published_at>=date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo'),
   'participants',(SELECT count(DISTINCT m.user_id) FROM public.room_members m JOIN eligible e ON e.id=m.room_id
     WHERE m.left_at IS NULL AND m.joined_at>=date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo')))
 FROM eligible WHERE status IN ('open','forced_publish') HAVING count(*)>0
 ) SELECT coalesce(jsonb_agg(c),'[]'::jsonb) FROM items
$$;
CREATE FUNCTION public.buffer_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('now',now(),'candidates',public.buffer_candidates(),
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('eventId',event_id,'contentKey',content_key,'kind',kind,'dueAt',due_at,
 'state',CASE WHEN state='succeeded' THEN 'sent' WHEN state='unknown' THEN 'uncertain' ELSE 'reserved' END))
 FROM public.buffer_queue),'[]'::jsonb),
 'queue',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM public.buffer_queue q
 WHERE state IN ('queued','failed') AND due_at>now() AND due_at<=now()+interval '15 minutes'),'[]'::jsonb))
$$;
CREATE FUNCTION public.buffer_reserve(p_plan jsonb) RETURNS integer
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
  IF (SELECT count(*) FROM public.buffer_queue WHERE (due_at AT TIME ZONE 'Asia/Tokyo')::date=
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
CREATE FUNCTION public.buffer_claim(p_event text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.buffer_queue%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 UPDATE public.buffer_queue SET state='unknown',result_code='WORKER_INTERRUPTED',updated_at=now()
 WHERE state='sending' AND started_at<now()-interval '2 minutes';
 UPDATE public.buffer_queue SET state='cancelled',result_code='SLOT_EXPIRED',updated_at=now()
 WHERE state IN ('queued','failed') AND due_at<=now()+interval '2 minutes';
 SELECT * INTO q FROM public.buffer_queue WHERE (p_event IS NULL OR event_id=p_event)
 AND (state='queued' OR (state='failed' AND retry_at IS NOT NULL AND retry_at<=now()))
 AND due_at>now()+interval '2 minutes' AND due_at<=now()+interval '15 minutes'
 ORDER BY due_at,CASE kind WHEN 'completed' THEN 0 WHEN 'new_room' THEN 1 WHEN 'deadline' THEN 2 ELSE 3 END,event_id
 LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.buffer_queue SET state='sending',attempts=attempts+1,token=gen_random_uuid(),
 started_at=now(),updated_at=now(),retry_at=NULL WHERE event_id=q.event_id RETURNING * INTO q;
 RETURN to_jsonb(q);
END $$;
CREATE FUNCTION public.buffer_finish(p_event text,p_token uuid,p_state text,p_code text,p_id text DEFAULT NULL,p_due timestamptz DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_state IS NULL OR p_state NOT IN ('succeeded','failed','unknown','cancelled') OR p_code IS NULL OR
 p_code NOT IN ('BUFFER_ACCEPTED','PRECHECK_FAILED','SOURCE_CHANGED','ACCESS_DENIED','REJECTED','AMBIGUOUS') THEN RAISE EXCEPTION 'INVALID_RESULT'; END IF;
 IF p_state='succeeded' AND (p_id IS NULL OR p_id !~ '^[a-zA-Z0-9_-]{1,150}$' OR p_due IS NULL) THEN RAISE EXCEPTION 'INVALID_RECEIPT'; END IF;
 UPDATE public.buffer_queue SET state=p_state,result_code=p_code,
 buffer_id=CASE WHEN p_state='succeeded' THEN p_id END,buffer_due_at=CASE WHEN p_state='succeeded' THEN p_due END,
 retry_at=CASE WHEN p_state='failed' AND p_code='PRECHECK_FAILED' AND attempts<3 THEN now()+interval '2 minutes' END,
 updated_at=now() WHERE event_id=p_event AND token=p_token AND state='sending';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.buffer_source_hash(uuid),public.buffer_candidates(),public.buffer_snapshot(),
 public.buffer_reserve(jsonb),public.buffer_claim(text),public.buffer_finish(text,uuid,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buffer_snapshot(),public.buffer_reserve(jsonb),public.buffer_claim(text),
 public.buffer_finish(text,uuid,text,text,text,timestamptz) TO service_role;
COMMIT;
