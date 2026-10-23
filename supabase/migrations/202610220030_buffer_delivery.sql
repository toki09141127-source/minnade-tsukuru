-- Follow-up to 029. Empty canary authorization grants no posting permission.
BEGIN;
ALTER TABLE public.buffer_queue DROP CONSTRAINT buffer_queue_state_check;
ALTER TABLE public.buffer_queue ADD CONSTRAINT buffer_queue_state_check
 CHECK(state IN ('queued','sending','succeeded','scheduled','sent','failed','unknown','cancelled'));
ALTER TABLE public.buffer_queue ADD COLUMN sent_at timestamptz;
ALTER TABLE public.buffer_queue ADD COLUMN external_id text;
ALTER TABLE public.buffer_queue ADD COLUMN external_url text;
CREATE UNIQUE INDEX buffer_external_id ON public.buffer_queue(external_id) WHERE external_id IS NOT NULL;
CREATE TABLE public.buffer_test_authorization (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 room_id uuid NOT NULL REFERENCES public.rooms(id),
 event_id text NOT NULL UNIQUE,
 due_at timestamptz NOT NULL,
 body text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 CHECK(event_id='completed_'||room_id::text),
 CHECK(body=E'【TEST】みんつく Buffer/X連携の動作確認です。\n作品の公開・参加募集ではありません。\nhttps://x.com/minnade_tsukuru\n#みんつく #連携テスト')
);
ALTER TABLE public.buffer_test_authorization ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buffer_test_authorization FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.buffer_test_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('snapshot',public.buffer_snapshot(),'authorization',(
 SELECT to_jsonb(a) FROM public.buffer_test_authorization a WHERE enabled=true),
 'receipt',(SELECT to_jsonb(q) FROM public.buffer_queue q JOIN public.buffer_test_authorization a ON a.event_id=q.event_id))
$$;
CREATE FUNCTION public.buffer_reserve_test() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.buffer_test_authorization%ROWTYPE; c jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(54221029);
 SELECT * INTO a FROM public.buffer_test_authorization WHERE enabled=true FOR UPDATE;
 IF NOT FOUND OR a.due_at<=now()+interval '2 minutes' OR a.due_at>now()+interval '15 minutes' THEN RETURN 0; END IF;
 SELECT x INTO c FROM jsonb_array_elements(public.buffer_candidates()) x WHERE x->>'id'=a.event_id
 AND x->>'kind'='completed' AND x->>'title' LIKE 'TEST Buffer%';
 IF c IS NULL OR (c->>'expiresAt')::timestamptz<=a.due_at THEN RETURN 0; END IF;
 IF (SELECT count(*) FROM public.buffer_queue WHERE (due_at AT TIME ZONE 'Asia/Tokyo')::date=(a.due_at AT TIME ZONE 'Asia/Tokyo')::date)>=2 THEN RETURN 0; END IF;
 INSERT INTO public.buffer_queue(event_id,content_key,kind,due_at,body)
 VALUES(a.event_id,'completed:'||a.room_id::text,'completed',a.due_at,a.body) ON CONFLICT DO NOTHING;
 IF FOUND THEN RETURN 1; END IF;
 RETURN 0;
END $$;
CREATE FUNCTION public.buffer_reconcile(p_event text,p_buffer_id text,p_state text,p_sent timestamptz DEFAULT NULL,p_external text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ext text;
BEGIN
 IF p_state IS NULL OR p_state NOT IN ('scheduled','sent','unknown','failed') THEN RAISE EXCEPTION 'INVALID_RESULT'; END IF;
 IF p_state='sent' THEN
  IF p_sent IS NULL OR p_sent>clock_timestamp()+interval '1 minute' OR p_external IS NULL
   OR p_external !~ '^https://(x[.]com|twitter[.]com)/minnade_tsukuru/status/[0-9]+$' THEN RAISE EXCEPTION 'INVALID_PUBLIC_RECEIPT'; END IF;
  ext:=substring(p_external from '/status/([0-9]+)$');
 END IF;
 UPDATE public.buffer_queue SET state=p_state,
 sent_at=CASE WHEN p_state='sent' THEN p_sent ELSE sent_at END,
 external_id=CASE WHEN p_state='sent' THEN ext ELSE external_id END,
 external_url=CASE WHEN p_state='sent' THEN p_external ELSE external_url END,
 updated_at=now(),retry_at=NULL
 WHERE event_id=p_event AND buffer_id=p_buffer_id AND state IN ('succeeded','scheduled','unknown')
 AND (p_state<>'sent' OR p_sent>=created_at);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.buffer_test_snapshot(),public.buffer_reserve_test(),public.buffer_reconcile(text,text,text,timestamptz,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.buffer_test_snapshot(),public.buffer_reserve_test(),public.buffer_reconcile(text,text,text,timestamptz,text) TO service_role;
COMMIT;
