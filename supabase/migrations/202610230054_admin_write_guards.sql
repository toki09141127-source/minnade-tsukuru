-- V2.5 DB enforcement. Controls serialize with writes, including direct REST and Storage.
BEGIN;
CREATE FUNCTION mvp_private.v25_gate(p_feature text,p_actor uuid DEFAULT NULL,p_room uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE flags jsonb; room_flags public.admin_room_controls;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED';END IF;
 SELECT c.flags INTO flags FROM mvp_private.admin_control c WHERE singleton FOR SHARE;
 IF flags IS NULL OR (p_feature IS NOT NULL AND p_feature<>'joins' AND flags->p_feature IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'FEATURE_STOPPED';END IF;
 IF p_actor IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
  IF EXISTS(SELECT 1 FROM public.admin_suspensions WHERE user_id=p_actor AND suspended) THEN RAISE EXCEPTION 'ACCOUNT_SUSPENDED';END IF;
 END IF;
 IF p_room IS NOT NULL AND p_feature IN ('joins','posts','uploads') THEN
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('room:'||p_room::text,2525));
  SELECT * INTO room_flags FROM public.admin_room_controls WHERE room_id=p_room FOR SHARE;
  IF FOUND AND to_jsonb(room_flags)->p_feature IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'ROOM_OPERATION_STOPPED';END IF;
 END IF;
END $$;
CREATE FUNCTION public.v25_check_operation(p_feature text,p_actor uuid,p_room uuid DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND auth.uid()<>p_actor THEN RETURN false;END IF;
 IF p_feature NOT IN ('room_creation','posts','uploads','joins','deletion_intake') THEN RETURN false;END IF;
 PERFORM mvp_private.v25_gate(p_feature,p_actor,p_room);RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.v25_check_operation(text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.v25_check_operation(text,uuid,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.mvp_current_account_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=auth.uid()) AND NOT EXISTS(SELECT 1 FROM public.admin_suspensions WHERE user_id=auth.uid() AND suspended)
$$;
CREATE FUNCTION mvp_private.v25_write_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb; old_r jsonb; actor uuid; room uuid; feature text; u public.attachment_uploads;
BEGIN
 IF TG_OP<>'DELETE' THEN r:=to_jsonb(NEW);END IF;IF TG_OP<>'INSERT' THEN old_r:=to_jsonb(OLD);END IF;
 -- Retain exact one-use deletion/moderation capabilities; no client-set bypass flag.
 IF TG_TABLE_SCHEMA='public' AND TG_OP<>'INSERT' THEN
  IF EXISTS(SELECT 1 FROM mvp_private.deletion_capabilities WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND table_name=TG_TABLE_NAME AND operation=TG_OP AND before_row=old_r AND (TG_OP='DELETE' OR after_row=r)) THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.mvp_moderation_capabilities WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND table_name=TG_TABLE_NAME AND target_id=(r->>'id')::uuid AND before_row=old_r AND after_row=r) THEN RETURN NEW;END IF;
 END IF;
 actor:=auth.uid();
 IF TG_TABLE_SCHEMA='storage' THEN
  IF TG_OP<>'INSERT' THEN RETURN NEW;END IF;
  SELECT * INTO u FROM public.attachment_uploads WHERE bucket=NEW.bucket_id AND storage_path=NEW.name;
  IF FOUND THEN PERFORM mvp_private.v25_gate('uploads',u.user_id,u.room_id);END IF;RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='rooms' AND TG_OP='INSERT' THEN feature:='room_creation';actor:=coalesce(actor,(r->>'created_by')::uuid);
 ELSIF TG_TABLE_NAME='posts' AND TG_OP<>'DELETE' THEN feature:='posts';actor:=coalesce(actor,(r->>'user_id')::uuid);room:=(r->>'room_id')::uuid;
 ELSIF TG_TABLE_NAME='room_members' AND TG_OP<>'DELETE' THEN
  actor:=coalesce(actor,(r->>'user_id')::uuid);room:=(r->>'room_id')::uuid;
  IF r->>'left_at' IS NULL AND (TG_OP='INSERT' OR old_r->>'left_at' IS NOT NULL) THEN feature:='joins';END IF;
 ELSIF TG_TABLE_NAME='attachment_uploads' AND TG_OP<>'DELETE' AND r->>'status' IN ('reserved','uploaded') THEN feature:='uploads';actor:=coalesce(actor,(r->>'user_id')::uuid);room:=(r->>'room_id')::uuid;
 END IF;
 IF actor IS NOT NULL OR feature IS NOT NULL THEN PERFORM mvp_private.v25_gate(feature,actor,room);END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['rooms','posts','room_members','attachment_uploads','profiles','public_profiles','room_join_requests','core_resignations','work_drafts','post_publication_reviews','room_exclusions'] LOOP
  EXECUTE format('CREATE TRIGGER a25_admin_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION mvp_private.v25_write_guard()',t);
 END LOOP;
END $$;
CREATE TRIGGER a25_admin_upload_guard BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION mvp_private.v25_write_guard();
CREATE FUNCTION mvp_private.v25_visibility_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN INSERT INTO public.admin_subjects(kind,target_id,version) VALUES(CASE WHEN TG_TABLE_NAME='rooms' THEN 'room' ELSE 'post' END,NEW.id,1) ON CONFLICT(kind,target_id) DO UPDATE SET version=admin_subjects.version+1;RETURN NEW;END $$;
CREATE TRIGGER v25_visibility_version AFTER UPDATE OF is_hidden ON public.rooms FOR EACH ROW EXECUTE FUNCTION mvp_private.v25_visibility_version();
CREATE TRIGGER v25_visibility_version AFTER UPDATE OF is_hidden ON public.posts FOR EACH ROW EXECUTE FUNCTION mvp_private.v25_visibility_version();
ALTER FUNCTION public.mvp_request_deletion(uuid,text,text) RENAME TO v25_request_deletion_base;
REVOKE ALL ON FUNCTION public.v25_request_deletion_base(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_request_deletion(p_actor uuid,p_attribution text,p_policy text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN PERFORM mvp_private.v25_gate('deletion_intake',NULL);RETURN public.v25_request_deletion_base(p_actor,p_attribution,p_policy);END $$;
REVOKE ALL ON FUNCTION public.mvp_request_deletion(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_request_deletion(uuid,text,text) TO service_role;
ALTER FUNCTION mvp_private.v22_publish_rooms(uuid[]) RENAME TO v25_publish_rooms_base;
CREATE FUNCTION mvp_private.v22_publish_rooms(p_rooms uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN PERFORM mvp_private.v25_gate('forced_publish');RETURN mvp_private.v25_publish_rooms_base(p_rooms);END $$;
REVOKE ALL ON FUNCTION mvp_private.v22_publish_rooms(uuid[]),mvp_private.v25_publish_rooms_base(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION mvp_private.ai_actor_allowed(uuid,uuid) RENAME TO v25_ai_actor_base;
CREATE FUNCTION mvp_private.ai_actor_allowed(p_actor uuid,p_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT mvp_private.v25_ai_actor_base(p_actor,p_room) AND NOT EXISTS(SELECT 1 FROM public.admin_suspensions WHERE user_id=p_actor AND suspended)
$$;
REVOKE ALL ON FUNCTION mvp_private.ai_actor_allowed(uuid,uuid),mvp_private.v25_ai_actor_base(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION mvp_private.v25_gate(text,uuid,uuid),mvp_private.v25_write_guard(),mvp_private.v25_visibility_version() FROM PUBLIC,anon,authenticated,service_role;
-- Operator registry is not an alternate admin route. Creator/Core can still hide their own room AI output.
CREATE OR REPLACE FUNCTION public.v22_ai_hide(p_room uuid,p_output uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid;
BEGIN
 a:=mvp_private.v2_actor();
 PERFORM 1 FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT mvp_private.ai_actor_allowed(a,p_room) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE public.room_ai_outputs SET hidden_at=clock_timestamp() WHERE id=p_output AND room_id=p_room AND hidden_at IS NULL;
 IF FOUND THEN INSERT INTO public.room_ai_moderation(room_id,output_id,actor_id,action) VALUES(p_room,p_output,a,'hide'); END IF;
END $$;

-- Observe delivery ordering without changing V2.4's current-provider-state authority.
ALTER FUNCTION public.v24_webhook_claim(text,text,text,text,timestamptz,text) RENAME TO v25_webhook_claim_base;
REVOKE ALL ON FUNCTION public.v25_webhook_claim_base(text,text,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.v24_webhook_claim(p_provider text,p_event text,p_customer text,p_type text,p_created timestamptz,p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb;
BEGIN
 r:=public.v25_webhook_claim_base(p_provider,p_event,p_customer,p_type,p_created,p_hash);
 IF (r->>'duplicate')::boolean THEN PERFORM mvp_private.v25_security('webhook_duplicate');
 ELSIF EXISTS(SELECT 1 FROM public.billing_events WHERE account_id=(r->>'account')::uuid AND event_created>p_created AND status='processed') THEN PERFORM mvp_private.v25_security('webhook_stale');END IF;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.v24_webhook_claim(text,text,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v24_webhook_claim(text,text,text,text,timestamptz,text) TO service_role;
COMMIT;
