-- V2.1 additive migration; apply only after 001-028. 029/030 belong to Buffer.
BEGIN;
ALTER TABLE public.rooms ADD COLUMN v2_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN capacity integer NOT NULL DEFAULT 50 CHECK(capacity BETWEEN 2 AND 50),
 ADD COLUMN genre text NOT NULL DEFAULT 'other' CHECK(genre IN ('novel','illustration','manga','video','music','other'));
ALTER TABLE public.room_members ADD COLUMN v2_consent_version text, ADD COLUMN v2_consented_at timestamptz;
CREATE TABLE public.core_resignations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','closed')),
 created_at timestamptz NOT NULL DEFAULT now(),decided_at timestamptz,decided_by uuid
);
CREATE UNIQUE INDEX v2_one_pending_resignation ON public.core_resignations(room_id,user_id) WHERE status='pending';
ALTER TABLE public.core_resignations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.core_resignations FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_mvp_departing_write BEFORE INSERT OR UPDATE OR DELETE ON public.core_resignations
 FOR EACH ROW EXECUTE FUNCTION public.mvp_guard_departing_write('user_id','decided_by');
CREATE TABLE public.v2_room_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('created','core_approved','core_rejected','core_resigned','member_left','member_kicked','core_demoted','published')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_room_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v2_room_events FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mvp_private.v2_actor() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid:=auth.uid(); hits integer;
BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text,4917));
 IF NOT public.mvp_current_account_active() THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
 PERFORM mvp_private.require_current_consent(a);
 INSERT INTO public.mvp_rate_limits(actor_id,action,window_start,hits)
 VALUES(a,'v2',floor(extract(epoch FROM clock_timestamp())/60),1)
 ON CONFLICT(actor_id,action,window_start) DO UPDATE SET hits=least(public.mvp_rate_limits.hits+1,61)
 RETURNING public.mvp_rate_limits.hits INTO hits;
 IF hits>60 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 RETURN a;
END $$;
REVOKE ALL ON FUNCTION mvp_private.v2_actor() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.v2_guard_room_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.v2_enabled AND (NEW.capacity IS DISTINCT FROM OLD.capacity OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
 OR NEW.ai_level IS DISTINCT FROM OLD.ai_level OR NEW.v2_enabled IS DISTINCT FROM OLD.v2_enabled
 OR NEW.genre IS DISTINCT FROM OLD.genre OR NEW.time_limit_hours IS DISTINCT FROM OLD.time_limit_hours) THEN RAISE EXCEPTION 'ROOM_SETTINGS_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.v2_guard_room_settings() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER v2_settings_immutable BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.v2_guard_room_settings();

CREATE FUNCTION public.v2_create_room(p_request uuid,p_title text,p_description text,p_genre text,p_deadline timestamptz,p_capacity integer,p_ai text,p_consent text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid; result uuid; digest text; saved public.room_creation_requests%ROWTYPE;
BEGIN
 a:=mvp_private.v2_actor();
 IF p_consent IS DISTINCT FROM '2026-10-22-v2.1' THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
 IF p_request IS NULL OR p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120
 OR p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 20 AND 300
 OR p_genre IS NULL OR p_genre NOT IN ('novel','illustration','manga','video','music','other')
 OR p_capacity IS NULL OR p_capacity NOT BETWEEN 2 AND 50 OR p_ai IS NULL OR p_ai NOT IN ('forbidden','assist','free')
 OR p_deadline IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 digest:=encode(sha256(convert_to(jsonb_build_array(p_title,p_description,p_genre,p_deadline,p_capacity,p_ai)::text,'UTF8')),'hex');
 SELECT * INTO saved FROM public.room_creation_requests WHERE actor_id=a AND request_id=p_request;
 IF FOUND THEN
  IF saved.payload_hash<>digest THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN saved.room_id;
 END IF;
 IF NOT public.mvp_take_rate_limit(a,'rooms') THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 IF NOT mvp_private.v2_safe_text(p_title) OR NOT mvp_private.v2_safe_text(p_description) THEN RAISE EXCEPTION 'UNSAFE_CONTENT'; END IF;
 IF p_deadline<clock_timestamp()+interval '1 hour' OR p_deadline>clock_timestamp()+interval '14 days' THEN RAISE EXCEPTION 'INVALID_DEADLINE'; END IF;
 INSERT INTO public.rooms(title,concept,genre,capacity,v2_enabled,category,work_type,is_adult,status,started_at,expires_at,
 created_by,host_ids,is_hidden,deleted_at,time_limit_hours,ai_level,enable_core_approval,enable_core_invite)
 VALUES(btrim(p_title),btrim(p_description),p_genre,p_capacity,true,
 CASE p_genre WHEN 'novel' THEN '小説' WHEN 'illustration' THEN 'イラスト' WHEN 'manga' THEN '漫画' WHEN 'video' THEN '動画' WHEN 'music' THEN '音楽' ELSE 'その他' END,
 'room',false,'open',clock_timestamp(),p_deadline,a,ARRAY[a],false,NULL,ceil(extract(epoch FROM (p_deadline-clock_timestamp()))/3600)::integer,p_ai,true,false) RETURNING id INTO result;
 INSERT INTO public.room_members(room_id,user_id,role,joined_at,v2_consent_version,v2_consented_at)
 VALUES(result,a,'creator',clock_timestamp(),'2026-10-22-v2.1',clock_timestamp());
 INSERT INTO public.room_creation_requests VALUES(a,p_request,digest,result);
 INSERT INTO public.v2_room_events(room_id,kind) VALUES(result,'created');
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.v2_create_room(uuid,text,text,text,timestamptz,integer,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.v2_create_room(uuid,text,text,text,timestamptz,integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mvp_guard_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF TG_OP='UPDATE' AND NEW.left_at IS NOT NULL AND NEW.room_id=OLD.room_id
 AND EXISTS(SELECT 1 FROM mvp_private.deletion_capabilities WHERE backend_pid=pg_backend_pid()
 AND transaction_id=txid_current() AND table_name='room_members' AND operation='UPDATE'
 AND before_row=to_jsonb(OLD) AND after_row=to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (NEW.room_id IS DISTINCT FROM OLD.room_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN RAISE EXCEPTION 'MEMBERSHIP_IDENTITY_IMMUTABLE'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=NEW.room_id FOR UPDATE;
 IF NEW.left_at IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=NEW.room_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
  IF TG_OP='INSERT' OR OLD.left_at IS NOT NULL OR NEW.role IS DISTINCT FROM OLD.role THEN
   IF r.id IS NULL OR r.status IS DISTINCT FROM 'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
   IF NEW.role='creator' AND NEW.user_id IS DISTINCT FROM r.created_by THEN RAISE EXCEPTION 'INVALID_CREATOR'; END IF;
   IF r.v2_enabled THEN
    IF NEW.v2_consent_version IS DISTINCT FROM '2026-10-22-v2.1' OR NEW.v2_consented_at IS NULL THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
    IF (SELECT count(*) FROM public.room_members WHERE room_id=NEW.room_id AND left_at IS NULL AND user_id<>NEW.user_id)>=r.capacity THEN RAISE EXCEPTION 'ROOM_FULL'; END IF;
   ELSIF NEW.role='supporter' AND (SELECT count(*) FROM public.room_members WHERE room_id=NEW.room_id AND role='supporter' AND left_at IS NULL AND user_id<>NEW.user_id)>=45 THEN RAISE EXCEPTION 'MEMBER_FULL'; END IF;
   IF NEW.role='core' AND (SELECT count(*) FROM public.room_members WHERE room_id=NEW.room_id AND role='core' AND left_at IS NULL AND user_id<>NEW.user_id)>=4 THEN RAISE EXCEPTION 'CORE_FULL'; END IF;
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND r.v2_enabled AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL
 AND OLD.role IN ('creator','core') AND NOT EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=NEW.room_id AND user_id=NEW.user_id)
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=NEW.user_id) THEN RAISE EXCEPTION 'RESIGNATION_REQUIRED'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.v2_member_action(p_room uuid,p_action text,p_target uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_consent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid; r public.rooms%ROWTYPE; m public.room_members%ROWTYPE; result uuid; request_row public.core_resignations%ROWTYPE;
BEGIN
 a:=mvp_private.v2_actor();
 -- Actor locks are shared with the existing withdrawal fence. A deadlock aborts, never partially commits.
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR NOT r.v2_enabled OR r.status<>'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 SELECT * INTO m FROM public.room_members WHERE room_id=p_room AND user_id=a FOR UPDATE;
 IF NOT public.mvp_take_rate_limit(a,CASE WHEN p_action='join' THEN 'join' ELSE 'core' END) THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 IF p_action='join' THEN
  IF p_consent IS DISTINCT FROM '2026-10-22-v2.1' THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=p_room AND user_id=a) THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
  IF m.id IS NOT NULL AND m.left_at IS NULL THEN RETURN jsonb_build_object('ok',true); END IF;
  INSERT INTO public.room_members(room_id,user_id,role,is_core,joined_at,left_at,room_terms_version,room_agreed_at,forced_publish_ack_at,v2_consent_version,v2_consented_at)
  VALUES(p_room,a,'supporter',false,clock_timestamp(),NULL,'2026-10-22',clock_timestamp(),clock_timestamp(),p_consent,clock_timestamp())
  ON CONFLICT(room_id,user_id) DO UPDATE SET role='supporter',is_core=false,joined_at=clock_timestamp(),left_at=NULL,
   room_terms_version='2026-10-22',room_agreed_at=clock_timestamp(),forced_publish_ack_at=clock_timestamp(),v2_consent_version=p_consent,v2_consented_at=clock_timestamp();
 ELSE
  IF m.id IS NULL OR m.left_at IS NOT NULL THEN RAISE EXCEPTION 'MEMBER_REQUIRED'; END IF;
  IF p_action='leave' THEN
   IF m.role<>'supporter' THEN RAISE EXCEPTION 'RESIGNATION_REQUIRED'; END IF;
   UPDATE public.room_members SET left_at=clock_timestamp() WHERE id=m.id;
   UPDATE public.room_join_requests SET status='revoked',decided_at=clock_timestamp() WHERE room_id=p_room AND user_id=a AND status='pending';
   INSERT INTO public.v2_room_events(room_id,kind) VALUES(p_room,'member_left');
  ELSIF p_action='apply_core' THEN
   IF p_consent IS DISTINCT FROM '2026-10-22-v2.1' THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
   result:=public.mvp_request_core(a,p_room,'2026-10-22');
  ELSIF p_action IN ('approve_core','reject_core') THEN
   PERFORM public.mvp_decide_core(a,p_room,p_request,p_action='approve_core');
   INSERT INTO public.v2_room_events(room_id,kind) VALUES(p_room,CASE WHEN p_action='approve_core' THEN 'core_approved' ELSE 'core_rejected' END);
  ELSIF p_action IN ('kick','demote') THEN
   PERFORM public.mvp_manage_member(a,p_room,p_target,p_action);
   UPDATE public.room_join_requests SET status='revoked',decided_at=clock_timestamp() WHERE room_id=p_room AND user_id=p_target AND status='pending';
   UPDATE public.core_resignations SET status='closed',decided_at=clock_timestamp(),decided_by=a WHERE room_id=p_room AND user_id=p_target AND status='pending';
   INSERT INTO public.v2_room_events(room_id,kind) VALUES(p_room,CASE WHEN p_action='kick' THEN 'member_kicked' ELSE 'core_demoted' END);
  ELSIF p_action='resign_core' THEN
   IF m.role<>'core' THEN RAISE EXCEPTION 'CORE_REQUIRED'; END IF;
   INSERT INTO public.core_resignations(room_id,user_id) VALUES(p_room,a) ON CONFLICT(room_id,user_id) WHERE status='pending' DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id INTO result;
  ELSIF p_action='approve_resignation' THEN
   IF m.role<>'creator' OR r.created_by<>a THEN RAISE EXCEPTION 'NOT_CREATOR'; END IF;
   SELECT * INTO request_row FROM public.core_resignations WHERE id=p_request AND room_id=p_room FOR UPDATE;
   IF NOT FOUND OR request_row.status<>'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;
   PERFORM public.mvp_manage_member(a,p_room,request_row.user_id,'demote');
   UPDATE public.core_resignations SET status='approved',decided_at=clock_timestamp(),decided_by=a WHERE id=p_request;
   INSERT INTO public.v2_room_events(room_id,kind) VALUES(p_room,'core_resigned');
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'requestId',result);
END $$;
REVOKE ALL ON FUNCTION public.v2_member_action(uuid,text,uuid,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.v2_member_action(uuid,text,uuid,uuid,text) TO authenticated;

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
 IF (SELECT count(*) FROM public.room_join_requests WHERE room_id=p_room AND user_id=p_actor AND (NOT r.v2_enabled OR status='rejected'))>=3 THEN RAISE EXCEPTION 'REQUEST_LIMIT'; END IF;
 INSERT INTO public.room_join_requests(room_id,user_id,requested_role,status,room_terms_version,room_agreed_at,forced_publish_ack_at,core_lock_agreed_at,membership_id,membership_joined_at)
 VALUES(p_room,p_actor,'core','pending',p_terms,clock_timestamp(),clock_timestamp(),clock_timestamp(),m.id,m.joined_at) RETURNING id INTO result;
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
 IF r.v2_enabled THEN RAISE EXCEPTION 'V2_CONSENT_REQUIRED'; END IF;
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
COMMIT;
