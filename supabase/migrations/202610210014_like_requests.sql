-- LOCAL CANDIDATE: room likes as an idempotent desired-state operation.
BEGIN;
CREATE TABLE public.room_like_requests(
 actor_id uuid NOT NULL, request_id uuid NOT NULL, room_id uuid NOT NULL,
 expected boolean NOT NULL, desired boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.room_like_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_like_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_set_room_like(p_actor uuid,p_room uuid,p_expected boolean,p_desired boolean,p_request uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; saved public.room_like_requests%ROWTYPE; current_value boolean;
BEGIN
 IF p_actor IS NULL OR p_room IS NULL OR p_expected IS NULL OR p_desired IS NULL OR p_request IS NULL
 OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 SELECT * INTO saved FROM public.room_like_requests WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF saved.room_id<>p_room OR saved.expected<>p_expected OR saved.desired<>p_desired THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN EXISTS(SELECT 1 FROM public.room_likes WHERE room_id=p_room AND user_id=p_actor);
 END IF;
 current_value:=EXISTS(SELECT 1 FROM public.room_likes WHERE room_id=p_room AND user_id=p_actor);
 IF current_value<>p_expected THEN RAISE EXCEPTION 'STALE_LIKE'; END IF;
 IF p_desired AND NOT current_value THEN INSERT INTO public.room_likes(room_id,user_id) VALUES(p_room,p_actor);
 ELSIF NOT p_desired AND current_value THEN DELETE FROM public.room_likes WHERE room_id=p_room AND user_id=p_actor; END IF;
 INSERT INTO public.room_like_requests(actor_id,request_id,room_id,expected,desired) VALUES(p_actor,p_request,p_room,p_expected,p_desired);
 RETURN p_desired;
END $$;
REVOKE ALL ON FUNCTION public.mvp_set_room_like(uuid,uuid,boolean,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_set_room_like(uuid,uuid,boolean,boolean,uuid) TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.room_likes FROM PUBLIC,anon,authenticated;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT attname FROM pg_attribute WHERE attrelid='public.room_likes'::regclass AND attnum>0 AND NOT attisdropped LOOP
 EXECUTE format('REVOKE INSERT (%I),UPDATE (%I) ON public.room_likes FROM PUBLIC,anon,authenticated',c.attname,c.attname);
 END LOOP;
END $$;
COMMIT;
