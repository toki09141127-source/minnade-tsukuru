-- LOCAL CANDIDATE; exact existing policy/trigger/reader compatibility must be staged.
-- Adds restrictive SELECT boundaries (existing permissive policies cannot override them).
BEGIN;
CREATE FUNCTION public.mvp_can_read_room_posts(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=p_room AND r.is_hidden=false AND r.deleted_at IS NULL
  AND (r.status='forced_publish' OR EXISTS(SELECT 1 FROM public.room_members m
   WHERE m.room_id=r.id AND m.user_id=auth.uid() AND m.left_at IS NULL AND m.role IN ('creator','core','supporter'))));
$$;
REVOKE ALL ON FUNCTION public.mvp_can_read_room_posts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mvp_can_read_room_posts(uuid) TO anon,authenticated,service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY mvp_posts_boundary ON public.posts AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(is_hidden=false AND deleted_at IS NULL AND public.mvp_can_read_room_posts(room_id));
CREATE POLICY mvp_rooms_boundary ON public.rooms AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(is_hidden=false AND deleted_at IS NULL);
CREATE POLICY mvp_members_boundary ON public.room_members AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.mvp_can_read_room_posts(room_id));
-- Existing browser updates are routed through seen/API. No arbitrary role or invite writes.
REVOKE INSERT,UPDATE,DELETE ON public.rooms,public.room_members,public.room_join_requests FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; c record; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['rooms','room_members','room_join_requests'] LOOP
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.%I FROM PUBLIC,anon,authenticated',c.attname,c.attname,t);
  END LOOP;
 END LOOP;
 -- Close caller-supplied-actor entrypoints; service APIs retain EXECUTE.
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef AND p.prokind='f' AND p.proname<>'mvp_can_read_room_posts' LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
-- Column allowlist: room invite secrets must not be readable via public SELECT *.
REVOKE SELECT ON public.rooms FROM PUBLIC,anon,authenticated;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT attname FROM pg_attribute WHERE attrelid='public.rooms'::regclass AND attnum>0 AND NOT attisdropped LOOP
  EXECUTE format('REVOKE SELECT (%I) ON public.rooms FROM PUBLIC,anon,authenticated',c.attname);
  IF c.attname = ANY(ARRAY['id','title','type','page_format','time_limit_hours','started_at','ended_at','work_type','status','created_at','created_by','like_count','is_hidden','deleted_at','concept','ai_level','is_adult','category','expires_at','enable_core_approval','enable_core_invite']) THEN
   EXECUTE format('GRANT SELECT (%I) ON public.rooms TO anon,authenticated',c.attname);
  END IF;
 END LOOP;
END $$;
COMMIT;
