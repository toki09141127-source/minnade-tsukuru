-- V2.5 staging admin foundation. Existing migrations remain immutable.
BEGIN;
CREATE TABLE public.admin_users(user_id uuid PRIMARY KEY, role text NOT NULL CHECK(role IN ('owner','moderator')), active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.admin_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, request_id uuid NOT NULL UNIQUE, actor_id uuid NOT NULL, actor_role text NOT NULL, action text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), severity text NOT NULL DEFAULT 'notice', request_hash text NOT NULL);
CREATE INDEX admin_audit_order ON public.admin_audit(created_at DESC,id DESC);
CREATE TABLE public.admin_notes(request_id uuid PRIMARY KEY REFERENCES public.admin_audit(request_id), note text NOT NULL CHECK(length(note) BETWEEN 1 AND 500));
CREATE TABLE public.admin_subjects(kind text NOT NULL CHECK(kind IN ('user','room','post','work','report')), target_id uuid NOT NULL, version integer NOT NULL DEFAULT 0, PRIMARY KEY(kind,target_id));
CREATE TABLE public.admin_suspensions(user_id uuid PRIMARY KEY, suspended boolean NOT NULL, changed_by uuid NOT NULL, changed_at timestamptz NOT NULL DEFAULT clock_timestamp(), reason text NOT NULL);
CREATE TABLE public.admin_room_controls(room_id uuid PRIMARY KEY REFERENCES public.rooms(id), joins boolean NOT NULL DEFAULT true, posts boolean NOT NULL DEFAULT true, uploads boolean NOT NULL DEFAULT true);
CREATE TABLE public.admin_report_reviews(receipt_id uuid PRIMARY KEY REFERENCES public.report_intake(id), status text NOT NULL CHECK(status IN ('open','reviewing','resolved','dismissed')), category text NOT NULL DEFAULT 'other', priority integer NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 3), changed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE mvp_private.admin_control(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL DEFAULT 0, flags jsonb NOT NULL, changed_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO mvp_private.admin_control(singleton,flags) VALUES(true,jsonb_build_object('room_creation',true,'posts',true,'uploads',true,'forced_publish',true,'deletion_intake',NOT public.mvp_deletion_is_paused(),'moderation',true));
CREATE TABLE public.admin_security_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX admin_security_recent ON public.admin_security_events(created_at DESC);
CREATE TABLE mvp_private.admin_rate(actor_id uuid NOT NULL,bucket bigint NOT NULL,kind text NOT NULL,hits integer NOT NULL,PRIMARY KEY(actor_id,bucket,kind));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['admin_users','admin_audit','admin_notes','admin_subjects','admin_suspensions','admin_room_controls','admin_report_reviews','admin_security_events'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
ALTER TABLE mvp_private.admin_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_private.admin_rate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mvp_private.admin_control,mvp_private.admin_rate FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.admin_audit_id_seq,public.admin_security_events_id_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mvp_private.admin_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'AUDIT_IMMUTABLE'; END $$;
CREATE TRIGGER admin_audit_immutable BEFORE UPDATE OR DELETE ON public.admin_audit FOR EACH ROW EXECUTE FUNCTION mvp_private.admin_immutable();
CREATE TRIGGER admin_notes_immutable BEFORE UPDATE OR DELETE ON public.admin_notes FOR EACH ROW EXECUTE FUNCTION mvp_private.admin_immutable();
CREATE TRIGGER admin_security_immutable BEFORE UPDATE OR DELETE ON public.admin_security_events FOR EACH ROW EXECUTE FUNCTION mvp_private.admin_immutable();
CREATE FUNCTION mvp_private.v25_role(p_mutation boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid:=auth.uid(); r text; hits integer; claims jsonb; issued numeric;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' OR a IS NULL THEN RETURN NULL;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text,4917));
 IF NOT public.mvp_current_account_active() OR EXISTS(SELECT 1 FROM public.admin_suspensions WHERE user_id=a AND suspended) THEN RETURN NULL;END IF;
 SELECT role INTO r FROM public.admin_users WHERE user_id=a AND active FOR SHARE;
 IF r IS NULL THEN RETURN NULL;END IF;
 IF p_mutation THEN
  claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
  issued:=coalesce((claims->>'iat')::numeric,0);
  IF issued<extract(epoch FROM now())-3600 OR issued>extract(epoch FROM now())+60 THEN RAISE EXCEPTION 'RECENT_LOGIN_REQUIRED';END IF;
 END IF;
 RETURN r;
END $$;
CREATE FUNCTION mvp_private.v25_security(p_kind text,p_actor uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_kind NOT IN ('admin_denied','admin_failed','rate_limited','invalid_webhook','webhook_failed','webhook_duplicate','webhook_stale','webhook_unmapped','cron_publish_ok','cron_ai_ok','cron_deletion_ok','cron_failed') THEN RETURN;END IF;
 -- At most one event per actor/category/minute, without IP, payload or provider IDs.
 PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(p_actor::text,'system')||p_kind,2526));
 IF NOT EXISTS(SELECT 1 FROM public.admin_security_events WHERE actor_id IS NOT DISTINCT FROM p_actor AND kind=p_kind AND created_at>clock_timestamp()-interval '1 minute') THEN INSERT INTO public.admin_security_events(actor_id,kind) VALUES(p_actor,p_kind);END IF;
END $$;
CREATE FUNCTION public.v25_record_event(p_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'SERVICE_ONLY';END IF;PERFORM mvp_private.v25_security(p_kind);END $$;
REVOKE ALL ON FUNCTION public.v25_record_event(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v25_record_event(text) TO service_role;
CREATE FUNCTION mvp_private.v25_flags() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT flags||jsonb_build_object('ai',(SELECT enabled FROM mvp_private.ai_control WHERE singleton),'deletion_worker',NOT public.mvp_deletion_is_paused()) FROM mvp_private.admin_control WHERE singleton
$$;
CREATE FUNCTION mvp_private.v25_rate(p_mutation boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=auth.uid(); n integer;
BEGIN
 IF a IS NULL THEN RETURN false;END IF;
 INSERT INTO mvp_private.admin_rate VALUES(a,floor(extract(epoch FROM clock_timestamp())/60),CASE WHEN p_mutation THEN 'write' ELSE 'read' END,1)
 ON CONFLICT(actor_id,bucket,kind) DO UPDATE SET hits=least(admin_rate.hits+1,121) RETURNING hits INTO n;
 RETURN n<=(CASE WHEN p_mutation THEN 30 ELSE 120 END);
END $$;
REVOKE ALL ON FUNCTION mvp_private.v25_rate(boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.v25_admin_action(p_request uuid,p_action text,p_type text,p_target text,p_version integer,p_value jsonb,p_reason text,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid:=auth.uid(); role_name text; digest text; saved public.admin_audit; before_value jsonb; after_value jsonb; target uuid; ver integer; hidden boolean; row_type text; code text;
BEGIN
 IF NOT mvp_private.v25_rate(true) THEN
  PERFORM mvp_private.v25_security('rate_limited',a);RETURN jsonb_build_object('error',CASE WHEN a IS NULL THEN 'ADMIN_FORBIDDEN' ELSE 'ADMIN_RATE_LIMITED' END);
 END IF;
 BEGIN
  role_name:=mvp_private.v25_role(true);
  IF role_name IS NULL THEN RAISE EXCEPTION 'ADMIN_FORBIDDEN';END IF;
  IF p_request IS NULL OR p_version IS NULL OR p_version<0 OR p_action IS NULL OR p_type IS NULL OR p_target IS NULL OR length(p_target)>80 OR p_value IS NULL OR p_reason IS NULL OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 500 OR NOT mvp_private.ai_safe_text(p_note) OR p_reason NOT IN ('privacy','copyright','illegal','inappropriate','harassment','spam','security','operational','other') THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
  digest:=encode(sha256(convert_to(jsonb_build_array(p_action,p_type,p_target,p_version,p_value,p_reason,btrim(p_note))::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,2525));
  SELECT * INTO saved FROM public.admin_audit WHERE request_id=p_request;
  IF FOUND THEN IF saved.actor_id<>a OR saved.request_hash<>digest THEN RAISE EXCEPTION 'REQUEST_CONFLICT';END IF;RETURN jsonb_build_object('ok',true,'replayed',true,'state',saved.after_state);END IF;
  IF p_action IN ('hide','suspend','report','room_controls') THEN
   PERFORM 1 FROM mvp_private.admin_control WHERE singleton FOR SHARE;
   IF NOT (mvp_private.v25_flags()->>'moderation')::boolean THEN RAISE EXCEPTION 'FEATURE_STOPPED';END IF;
  END IF;
  IF p_action IN ('feature','role','room_controls') AND role_name<>'owner' THEN RAISE EXCEPTION 'OWNER_REQUIRED';END IF;
  IF p_action='feature' THEN
   IF p_type<>'system' OR p_target NOT IN ('room_creation','posts','uploads','ai','deletion_intake','deletion_worker','forced_publish','moderation') OR jsonb_typeof(p_value)<>'boolean' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
   SELECT version INTO ver FROM mvp_private.admin_control WHERE singleton FOR UPDATE;
   IF ver<>p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT';END IF;
   before_value:=jsonb_build_object('enabled',mvp_private.v25_flags()->p_target,'version',ver);
   IF p_target='ai' THEN PERFORM public.v22_ai_control(p_value::boolean);
   ELSIF p_target='deletion_worker' THEN
    IF p_value::boolean AND EXISTS(SELECT 1 FROM mvp_private.deletion_effects e JOIN public.account_deletion_jobs j ON j.id=e.job_id WHERE e.state IN ('started','unknown') AND j.stage<>'completed') THEN RAISE EXCEPTION 'RECOVERY_REVIEW_REQUIRED';END IF;
    PERFORM public.mvp_set_deletion_pause(NOT p_value::boolean);
   ELSE UPDATE mvp_private.admin_control SET flags=jsonb_set(flags,ARRAY[p_target],p_value) WHERE singleton;END IF;
   UPDATE mvp_private.admin_control SET version=version+1,changed_at=clock_timestamp() WHERE singleton;
   after_value:=jsonb_build_object('enabled',p_value,'version',ver+1);
  ELSE
   target:=p_target::uuid;
   IF p_action='role' THEN
    IF p_type<>'staff' OR p_value NOT IN ('"moderator"'::jsonb,'"revoked"'::jsonb) OR target=a THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(target::text,4917));
    IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=target) OR EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=target) OR EXISTS(SELECT 1 FROM public.admin_suspensions WHERE user_id=target AND suspended) THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE';END IF;
    SELECT version,jsonb_build_object('role',role,'active',active,'version',version) INTO ver,before_value FROM public.admin_users WHERE user_id=target FOR UPDATE;
    IF before_value->>'role'='owner' THEN RAISE EXCEPTION 'OWNER_PROTECTED';END IF;
    IF coalesce(ver,0)<>p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT';END IF;
    INSERT INTO public.admin_users(user_id,role,active,version) VALUES(target,'moderator',p_value='"moderator"'::jsonb,1)
    ON CONFLICT(user_id) DO UPDATE SET active=excluded.active,version=admin_users.version+1;
    IF p_value='"moderator"'::jsonb THEN INSERT INTO public.moderation_operators(user_id) VALUES(target) ON CONFLICT DO NOTHING;ELSE DELETE FROM public.moderation_operators WHERE user_id=target;END IF;
    after_value:=jsonb_build_object('role','moderator','active',p_value='"moderator"'::jsonb,'version',coalesce(ver,0)+1);
   ELSE
    IF p_type NOT IN ('user','room','post','work','report') THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
    IF p_type='user' THEN PERFORM pg_advisory_xact_lock(hashtextextended(target::text,4917));END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(CASE WHEN p_type='work' THEN 'room' ELSE p_type END||':'||target::text,2525));
    INSERT INTO public.admin_subjects(kind,target_id) VALUES(CASE WHEN p_type='work' THEN 'room' ELSE p_type END,target) ON CONFLICT DO NOTHING;
    SELECT version INTO ver FROM public.admin_subjects WHERE kind=CASE WHEN p_type='work' THEN 'room' ELSE p_type END AND target_id=target FOR UPDATE;
    IF ver<>p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT';END IF;
    IF p_action='suspend' THEN
     IF p_type<>'user' OR jsonb_typeof(p_value)<>'boolean' OR target=a OR EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=target AND active) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target AND deleted_at IS NULL) OR EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=target) THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE';END IF;
     before_value:=jsonb_build_object('suspended',coalesce((SELECT suspended FROM public.admin_suspensions WHERE user_id=target),false));
     INSERT INTO public.admin_suspensions(user_id,suspended,changed_by,reason) VALUES(target,p_value::boolean,a,p_reason)
     ON CONFLICT(user_id) DO UPDATE SET suspended=excluded.suspended,changed_by=a,changed_at=clock_timestamp(),reason=p_reason;
     after_value:=jsonb_build_object('suspended',p_value);
    ELSIF p_action='hide' THEN
     IF p_type NOT IN ('room','post','work') OR jsonb_typeof(p_value)<>'boolean' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
     IF NOT (mvp_private.v25_flags()->>'moderation')::boolean THEN RAISE EXCEPTION 'FEATURE_STOPPED';END IF;
     row_type:=CASE WHEN p_type='post' THEN 'post' ELSE 'room' END;
     IF p_type='work' AND NOT EXISTS(SELECT 1 FROM public.rooms WHERE id=target AND status='forced_publish') THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE';END IF;
     IF row_type='room' THEN SELECT is_hidden INTO hidden FROM public.rooms WHERE id=target;ELSE SELECT is_hidden INTO hidden FROM public.posts WHERE id=target;END IF;
     before_value:=jsonb_build_object('hidden',hidden);
     PERFORM public.mvp_moderate(a,row_type,target,CASE WHEN p_reason IN ('privacy','copyright','harassment','inappropriate') THEN p_reason ELSE 'other' END,p_value::boolean,p_request);
     after_value:=jsonb_build_object('hidden',p_value);
    ELSIF p_action='report' THEN
     IF p_type<>'report' OR p_value->>'status' IS NULL OR p_value->>'status' NOT IN ('reviewing','resolved','dismissed') OR p_value->>'category' IS NULL OR p_value->>'category' NOT IN ('inappropriate','harassment','privacy','copyright','spam','other') OR (p_value-'status'-'category')<>'{}'::jsonb THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
     PERFORM 1 FROM public.report_intake WHERE id=target FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE';END IF;
     IF EXISTS(SELECT 1 FROM public.report_resolutions WHERE receipt_id=target) THEN RAISE EXCEPTION 'INVALID_TRANSITION';END IF;
     SELECT jsonb_build_object('status',status,'category',category) INTO before_value FROM public.admin_report_reviews WHERE receipt_id=target;
     IF coalesce(before_value->>'status','open') IN ('resolved','dismissed') OR (before_value IS NULL AND p_value->>'status'<>'reviewing') THEN RAISE EXCEPTION 'INVALID_TRANSITION';END IF;
     INSERT INTO public.admin_report_reviews(receipt_id,status,category,priority) VALUES(target,p_value->>'status',p_value->>'category',CASE WHEN p_value->>'category'='privacy' THEN 1 ELSE 2 END)
     ON CONFLICT(receipt_id) DO UPDATE SET status=excluded.status,category=excluded.category,priority=excluded.priority,changed_at=clock_timestamp();
     after_value:=p_value;
    ELSIF p_action='room_controls' THEN
     IF p_type<>'room' OR jsonb_typeof(p_value->'joins')<>'boolean' OR jsonb_typeof(p_value->'posts')<>'boolean' OR jsonb_typeof(p_value->'uploads')<>'boolean' OR (p_value-'joins'-'posts'-'uploads')<>'{}'::jsonb THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
     PERFORM 1 FROM public.rooms WHERE id=target AND deleted_at IS NULL FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE';END IF;
     SELECT jsonb_build_object('joins',joins,'posts',posts,'uploads',uploads) INTO before_value FROM public.admin_room_controls WHERE room_id=target;
     INSERT INTO public.admin_room_controls VALUES(target,(p_value->>'joins')::boolean,(p_value->>'posts')::boolean,(p_value->>'uploads')::boolean)
     ON CONFLICT(room_id) DO UPDATE SET joins=excluded.joins,posts=excluded.posts,uploads=excluded.uploads;
     after_value:=p_value;
    ELSE RAISE EXCEPTION 'INVALID_INPUT';END IF;
    IF p_action<>'hide' THEN UPDATE public.admin_subjects SET version=version+1 WHERE kind=CASE WHEN p_type='work' THEN 'room' ELSE p_type END AND target_id=target;END IF;
    after_value:=after_value||jsonb_build_object('version',ver+1);
   END IF;
  END IF;
  INSERT INTO public.admin_audit(request_id,actor_id,actor_role,action,target_type,target_id,before_state,after_state,reason,severity,request_hash)
   VALUES(p_request,a,role_name,p_action,p_type,p_target,coalesce(before_value,'{}'),after_value,p_reason,CASE WHEN p_action IN ('feature','role','suspend') THEN 'warning' ELSE 'notice' END,digest);
  INSERT INTO public.admin_notes VALUES(p_request,btrim(p_note));
  RETURN jsonb_build_object('ok',true,'state',after_value);
 EXCEPTION WHEN OTHERS THEN
  code:=SQLERRM;
  IF code NOT IN ('ADMIN_FORBIDDEN','OWNER_REQUIRED','OWNER_PROTECTED','RECENT_LOGIN_REQUIRED','ADMIN_RATE_LIMITED','INVALID_INPUT','REQUEST_CONFLICT','VERSION_CONFLICT','TARGET_UNAVAILABLE','INVALID_TRANSITION','FEATURE_STOPPED','RECOVERY_REVIEW_REQUIRED') THEN code:='ADMIN_ACTION_FAILED';END IF;
 END;
 PERFORM mvp_private.v25_security(CASE WHEN code='ADMIN_RATE_LIMITED' THEN 'rate_limited' WHEN code IN ('ADMIN_FORBIDDEN','OWNER_REQUIRED') THEN 'admin_denied' ELSE 'admin_failed' END,a);
 RETURN jsonb_build_object('error',code);
END $$;
REVOKE ALL ON FUNCTION public.v25_admin_action(uuid,text,text,text,integer,jsonb,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.v25_admin_action(uuid,text,text,text,integer,jsonb,text,text) TO authenticated;
REVOKE ALL ON FUNCTION mvp_private.admin_immutable(),mvp_private.v25_role(boolean),mvp_private.v25_security(text,uuid),mvp_private.v25_flags() FROM PUBLIC,anon,authenticated,service_role;
-- Older service-role moderation endpoints cannot bypass new versioned audit operations.
REVOKE ALL ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid),public.mvp_pending_reports(uuid,timestamptz,uuid),public.mvp_resolve_report(uuid,uuid,uuid,text,text) FROM service_role;
COMMIT;
