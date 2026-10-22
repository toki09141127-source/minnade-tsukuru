-- LOCAL ONLY: requires 002/003; deploy after 017. New API flag remains disabled.
BEGIN;
CREATE OR REPLACE FUNCTION public.mvp_guard_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF TG_OP='UPDATE' AND (NEW.room_id IS DISTINCT FROM OLD.room_id OR NEW.user_id IS DISTINCT FROM OLD.user_id)
 THEN RAISE EXCEPTION 'MEMBERSHIP_IDENTITY_IMMUTABLE'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=NEW.room_id FOR UPDATE;
 IF NEW.left_at IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=NEW.room_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
  IF TG_OP='INSERT' OR OLD.left_at IS NOT NULL OR NEW.role IS DISTINCT FROM OLD.role THEN
   IF r.id IS NULL OR r.status IS DISTINCT FROM 'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL
    OR (r.expires_at IS NOT NULL AND r.expires_at <= clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
   IF NEW.role='creator' AND NEW.user_id IS DISTINCT FROM r.created_by THEN RAISE EXCEPTION 'INVALID_CREATOR'; END IF;
   IF NEW.role='supporter' AND (SELECT count(*) FROM public.room_members WHERE room_id=NEW.room_id
      AND role='supporter' AND left_at IS NULL AND user_id<>NEW.user_id)>=45 THEN RAISE EXCEPTION 'MEMBER_FULL'; END IF;
   IF NEW.role='core' AND (SELECT count(*) FROM public.room_members WHERE room_id=NEW.room_id AND role='core'
      AND left_at IS NULL AND user_id<>NEW.user_id)>=4 THEN RAISE EXCEPTION 'CORE_FULL'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mvp_guard_membership() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.mvp_join_member(p_actor uuid,p_room uuid,p_terms text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; m public.room_members%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF p_actor IS NULL OR p_room IS NULL OR p_terms IS DISTINCT FROM '2026-03-24'
 OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR r.status IS DISTINCT FROM 'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL
 OR (r.expires_at IS NOT NULL AND r.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=p_room AND user_id=p_actor) THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
 SELECT * INTO m FROM public.room_members WHERE room_id=p_room AND user_id=p_actor FOR UPDATE;
 IF FOUND AND m.left_at IS NULL THEN
  IF m.role IS NULL OR m.role NOT IN ('creator','core','supporter') THEN RAISE EXCEPTION 'INVALID_MEMBERSHIP'; END IF;
  RETURN m.role;
 END IF;
 IF m.id IS NULL THEN
  INSERT INTO public.room_members(room_id,user_id,role,is_core,joined_at,left_at,room_terms_version,room_agreed_at,forced_publish_ack_at)
  VALUES(p_room,p_actor,'supporter',false,clock_timestamp(),NULL,p_terms,clock_timestamp(),clock_timestamp());
 ELSE
  UPDATE public.room_members SET role='supporter',is_core=false,joined_at=clock_timestamp(),left_at=NULL,
   approved_at=NULL,approved_by=NULL,room_terms_version=p_terms,room_agreed_at=clock_timestamp(),forced_publish_ack_at=clock_timestamp()
  WHERE id=m.id;
 END IF;
 RETURN 'supporter';
END $$;
REVOKE ALL ON FUNCTION public.mvp_join_member(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_join_member(uuid,uuid,text) TO service_role;
COMMIT;
