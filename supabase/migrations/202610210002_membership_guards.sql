-- LOCAL CANDIDATE. Requires reviewed existing triggers and migration 001; do not apply blindly.
BEGIN;
CREATE TABLE public.room_exclusions (
 room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_id,user_id)
);
ALTER TABLE public.room_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_exclusions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.room_exclusions TO service_role;
CREATE FUNCTION public.mvp_guard_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=NEW.room_id FOR UPDATE;
 IF NEW.left_at IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=NEW.room_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
  IF TG_OP='INSERT' OR OLD.left_at IS NOT NULL OR NEW.role IS DISTINCT FROM OLD.role THEN
   IF r.id IS NULL OR r.status IS DISTINCT FROM 'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL
    OR (r.expires_at IS NOT NULL AND r.expires_at <= clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
   IF NEW.role='creator' AND NEW.user_id IS DISTINCT FROM r.created_by THEN RAISE EXCEPTION 'INVALID_CREATOR'; END IF;
   IF NEW.role='core' AND (SELECT count(*) FROM public.room_members WHERE room_id=NEW.room_id AND role='core'
      AND left_at IS NULL AND user_id<>NEW.user_id)>=4 THEN RAISE EXCEPTION 'CORE_FULL'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mvp_guard_membership() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER mvp_membership_guard BEFORE INSERT OR UPDATE ON public.room_members
 FOR EACH ROW EXECUTE FUNCTION public.mvp_guard_membership();
CREATE FUNCTION public.mvp_manage_member(p_actor uuid,p_room uuid,p_target uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; m public.room_members%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR p_target IS NULL OR p_action IS NULL OR p_action NOT IN ('demote','kick') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF r.id IS NULL OR r.created_by IS DISTINCT FROM p_actor OR p_actor=p_target THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF r.status IS DISTINCT FROM 'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL
  OR (r.expires_at IS NOT NULL AND r.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_members WHERE room_id=p_room AND user_id=p_actor AND role='creator' AND left_at IS NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO m FROM public.room_members WHERE room_id=p_room AND user_id=p_target FOR UPDATE;
 IF m.id IS NULL OR m.role NOT IN ('core','supporter') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_action='kick' THEN
  INSERT INTO public.room_exclusions(room_id,user_id,actor_id) VALUES(p_room,p_target,p_actor) ON CONFLICT DO NOTHING;
  UPDATE public.room_members SET left_at=coalesce(left_at,clock_timestamp()) WHERE id=m.id;
 ELSE
  IF m.left_at IS NOT NULL OR m.role<>'core' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.room_members SET role='supporter',is_core=false WHERE id=m.id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_manage_member(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_manage_member(uuid,uuid,uuid,text) TO service_role;

CREATE FUNCTION public.mvp_guard_core_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='pending' AND EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=NEW.room_id AND user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mvp_guard_core_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER mvp_core_request_guard BEFORE INSERT OR UPDATE ON public.room_join_requests
 FOR EACH ROW EXECUTE FUNCTION public.mvp_guard_core_request();
CREATE FUNCTION public.mvp_highlight(p_actor uuid,p_room uuid,p_post uuid,p_expected boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; p public.posts%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR p_expected IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF r.id IS NULL OR r.status IS DISTINCT FROM 'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL
 OR (r.expires_at IS NOT NULL AND r.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.room_members WHERE room_id=p_room AND user_id=p_actor AND left_at IS NULL AND role IN ('creator','core') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO p FROM public.posts WHERE id=p_post AND room_id=p_room AND is_hidden=false AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF p.is_marked IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 UPDATE public.posts SET is_marked=NOT p_expected,marked_by=CASE WHEN NOT p_expected THEN p_actor END,
 marked_at=CASE WHEN NOT p_expected THEN clock_timestamp() END WHERE id=p_post RETURNING * INTO p;
 RETURN jsonb_build_object('id',p.id,'is_marked',p.is_marked,'marked_by',p.marked_by,'marked_at',p.marked_at);
END $$;
REVOKE ALL ON FUNCTION public.mvp_highlight(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_highlight(uuid,uuid,uuid,boolean) TO service_role;
COMMIT;
