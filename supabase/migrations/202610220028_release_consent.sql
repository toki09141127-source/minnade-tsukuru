-- Release consent update after 027. No backfill of age or fabricated consent.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN adult_confirmed_at timestamptz;
GRANT SELECT(adult_confirmed_at) ON public.profiles TO authenticated;
REVOKE ALL ON FUNCTION public.mvp_accept_current_terms(text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_accept_current_terms(p_terms text,p_privacy text,p_adult boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR p_adult IS DISTINCT FROM true OR p_terms IS DISTINCT FROM '2026-10-22'
 OR p_privacy IS DISTINCT FROM '2026-10-22' THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,4917));
 IF NOT public.mvp_current_account_active() THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
 UPDATE public.profiles SET terms_version=p_terms,privacy_version=p_privacy,
 terms_agreed_at=clock_timestamp(),privacy_agreed_at=clock_timestamp(),adult_confirmed_at=clock_timestamp() WHERE id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_REQUIRED'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_accept_current_terms(text,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mvp_accept_current_terms(text,text,boolean) TO authenticated;
CREATE FUNCTION mvp_private.require_current_consent(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND deleted_at IS NULL
 AND terms_version='2026-10-22' AND privacy_version='2026-10-22'
 AND terms_agreed_at IS NOT NULL AND privacy_agreed_at IS NOT NULL AND adult_confirmed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
END $$;
REVOKE ALL ON FUNCTION mvp_private.require_current_consent(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.mvp_create_room(p_actor uuid,p_request uuid,p_settings jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; saved public.room_creation_requests%ROWTYPE; digest text; result uuid;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR jsonb_typeof(p_settings) IS DISTINCT FROM 'object'
 OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_settings) k WHERE k<>ALL(ARRAY[
 'title','category','is_adult','time_limit_hours','work_type','concept','ai_level',
 'enable_core_approval','enable_core_invite','core_invite_code'])) THEN RAISE EXCEPTION 'INVALID_FIELDS'; END IF;
 SELECT * INTO r FROM jsonb_populate_record(NULL::public.rooms,p_settings);
 IF r.title IS NULL OR length(btrim(r.title)) NOT BETWEEN 1 AND 120 OR length(coalesce(r.concept,''))>300
 OR r.time_limit_hours IS NULL OR r.time_limit_hours NOT BETWEEN 1 AND 150 OR r.is_adult IS NULL
 OR r.enable_core_approval IS NULL OR r.enable_core_invite IS NULL
 OR (r.enable_core_invite AND (r.core_invite_code IS NULL OR r.core_invite_code !~ '^[A-Z0-9]{6,32}$'))
 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 PERFORM mvp_private.require_current_consent(p_actor);
 digest:=encode(sha256(convert_to(p_settings::text,'UTF8')),'hex');
 SELECT * INTO saved FROM public.room_creation_requests WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF saved.payload_hash<>digest THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.rooms WHERE id=saved.room_id AND is_hidden=false AND deleted_at IS NULL) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
  RETURN saved.room_id;
 END IF;
 INSERT INTO public.rooms(title,category,is_adult,status,started_at,expires_at,created_by,host_ids,is_hidden,deleted_at,time_limit_hours,work_type,concept,ai_level,enable_core_approval,enable_core_invite,core_invite_code)
 VALUES(r.title,r.category,r.is_adult,'open',clock_timestamp(),clock_timestamp()+r.time_limit_hours*interval '1 hour',
 p_actor,ARRAY[p_actor],false,NULL,r.time_limit_hours,r.work_type,r.concept,r.ai_level,r.enable_core_approval,r.enable_core_invite,
 CASE WHEN r.enable_core_invite THEN r.core_invite_code END) RETURNING id INTO result;
 INSERT INTO public.room_members(room_id,user_id,role,joined_at,left_at) VALUES(result,p_actor,'creator',clock_timestamp(),NULL);
 INSERT INTO public.room_creation_requests VALUES(p_actor,p_request,digest,result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.mvp_join_member(p_actor uuid,p_room uuid,p_terms text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; m public.room_members%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF p_actor IS NULL OR p_room IS NULL OR p_terms IS DISTINCT FROM '2026-10-22'
 OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 PERFORM mvp_private.require_current_consent(p_actor);
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

CREATE OR REPLACE FUNCTION public.mvp_request_core(p_actor uuid,p_room uuid,p_terms text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; m public.room_members%ROWTYPE; req public.room_join_requests%ROWTYPE; result uuid;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF p_actor IS NULL OR p_room IS NULL OR p_terms IS DISTINCT FROM '2026-10-22' OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 PERFORM mvp_private.require_current_consent(p_actor);
 PERFORM 1 FROM auth.users WHERE id=p_actor FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_REQUIRED'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR r.status<>'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL OR r.enable_core_approval IS DISTINCT FROM true OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=p_room AND user_id=p_actor) THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
 SELECT * INTO m FROM public.room_members WHERE room_id=p_room AND user_id=p_actor FOR UPDATE;
 IF NOT FOUND OR m.left_at IS NOT NULL OR m.role IS DISTINCT FROM 'supporter' THEN RAISE EXCEPTION 'MEMBER_REQUIRED'; END IF;
 SELECT * INTO req FROM public.room_join_requests WHERE room_id=p_room AND user_id=p_actor AND status='pending' FOR UPDATE;
 IF FOUND THEN
  IF req.membership_id=m.id AND req.membership_joined_at IS NOT DISTINCT FROM m.joined_at AND req.room_terms_version=p_terms AND req.core_lock_agreed_at IS NOT NULL THEN RETURN req.id; END IF;
  UPDATE public.room_join_requests SET status='revoked',decided_at=clock_timestamp() WHERE id=req.id;
 END IF;
 IF (SELECT count(*) FROM public.room_join_requests WHERE room_id=p_room AND user_id=p_actor)>=3 THEN RAISE EXCEPTION 'REQUEST_LIMIT'; END IF;
 INSERT INTO public.room_join_requests(room_id,user_id,requested_role,status,room_terms_version,room_agreed_at,forced_publish_ack_at,core_lock_agreed_at,membership_id,membership_joined_at)
 VALUES(p_room,p_actor,'core','pending',p_terms,clock_timestamp(),clock_timestamp(),clock_timestamp(),m.id,m.joined_at) RETURNING id INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.mvp_decide_core(p_actor uuid,p_room uuid,p_request uuid,p_approve boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; m public.room_members%ROWTYPE; req public.room_join_requests%ROWTYPE; target uuid; a uuid; outcome text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF p_actor IS NULL OR p_room IS NULL OR p_request IS NULL OR p_approve IS NULL OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 SELECT user_id INTO target FROM public.room_join_requests WHERE id=p_request AND room_id=p_room;
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
 FOR a IN SELECT DISTINCT x FROM unnest(ARRAY[p_actor,target]) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(a::text,4917));
  IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=a) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 END LOOP;
 PERFORM 1 FROM auth.users WHERE id=target FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_REQUIRED'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR r.created_by IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'NOT_CREATOR'; END IF;
 IF r.status<>'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL OR r.enable_core_approval IS DISTINCT FROM true OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.room_members WHERE room_id=p_room AND user_id=p_actor AND role='creator' AND left_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_CREATOR'; END IF;
 SELECT * INTO req FROM public.room_join_requests WHERE id=p_request AND room_id=p_room FOR UPDATE;
 IF NOT FOUND OR req.user_id IS DISTINCT FROM target THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
 outcome:=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
 IF req.status=outcome AND req.decided_by=p_actor THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
 IF req.status<>'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;
 IF p_approve THEN
  PERFORM mvp_private.require_current_consent(target);
  PERFORM mvp_private.require_current_consent(p_actor);
  IF EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=p_room AND user_id=target) THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
  SELECT * INTO m FROM public.room_members WHERE room_id=p_room AND user_id=target FOR UPDATE;
  IF NOT FOUND OR m.left_at IS NOT NULL OR m.role IS DISTINCT FROM 'supporter' OR req.membership_id IS DISTINCT FROM m.id
    OR req.membership_joined_at IS DISTINCT FROM m.joined_at THEN RAISE EXCEPTION 'STALE_MEMBERSHIP'; END IF;
  IF req.requested_role<>'core' OR req.room_terms_version IS DISTINCT FROM '2026-10-22'
    OR req.room_agreed_at IS NULL OR req.forced_publish_ack_at IS NULL OR req.core_lock_agreed_at IS NULL THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
  IF (SELECT count(*) FROM public.room_members WHERE room_id=p_room AND role='core' AND left_at IS NULL)>=4 THEN RAISE EXCEPTION 'CORE_FULL'; END IF;
  UPDATE public.room_members SET role='core',is_core=true,approved_at=clock_timestamp(),approved_by=p_actor,
   room_terms_version=req.room_terms_version,room_agreed_at=req.room_agreed_at,forced_publish_ack_at=req.forced_publish_ack_at,core_lock_agreed_at=req.core_lock_agreed_at
   WHERE id=m.id;
 END IF;
 UPDATE public.room_join_requests SET status=outcome,decided_at=clock_timestamp(),decided_by=p_actor WHERE id=req.id;
 RETURN jsonb_build_object('ok',true,'replayed',false);
END $$;

COMMIT;
