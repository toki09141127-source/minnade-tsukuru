-- 024: scoped retention preparation and storage evidence. Requires 023.
BEGIN;
CREATE OR REPLACE FUNCTION public.mvp_guard_departing_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb; actors uuid[]:=ARRAY[]::uuid[]; a uuid; col text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 -- Only exact private prepare capabilities may cross the account write fence.
 DELETE FROM mvp_private.deletion_capabilities
 WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current()
 AND table_name=TG_TABLE_NAME AND operation=TG_OP AND before_row=to_jsonb(OLD)
 AND (TG_OP='DELETE' OR after_row=to_jsonb(NEW));
 IF FOUND THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 -- Consume an exact, one-use capability; never trust client-set session flags.
 IF TG_OP='UPDATE' AND TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME IN ('posts','rooms') THEN
  DELETE FROM public.mvp_moderation_capabilities
  WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current()
   AND table_name=TG_TABLE_NAME AND target_id=(to_jsonb(OLD)->>'id')::uuid
   AND before_row=to_jsonb(OLD) AND after_row=to_jsonb(NEW);
  IF FOUND THEN RETURN NEW; END IF;
 END IF;
 IF auth.uid() IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=auth.uid())
   OR EXISTS(SELECT 1 FROM mvp_private.actors WHERE id=auth.uid() AND retired)
   THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
  actors:=array_append(actors,auth.uid());
 END IF;
 -- Derived public like totals are the sole non-content exception; verify the actual relation.
 IF TG_OP='UPDATE' AND to_jsonb(OLD)-'like_count'=to_jsonb(NEW)-'like_count' THEN
  IF TG_TABLE_NAME='rooms' AND (to_jsonb(NEW)->>'like_count')::bigint=
   (SELECT count(*) FROM public.room_likes WHERE room_id=(to_jsonb(NEW)->>'id')::uuid) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='posts' AND (to_jsonb(NEW)->>'like_count')::bigint=
   (SELECT count(*) FROM public.post_likes WHERE post_id=(to_jsonb(NEW)->>'id')::uuid) THEN RETURN NEW; END IF;
 END IF;
 FOR col IN SELECT unnest(TG_ARGV) LOOP
  IF TG_OP='UPDATE' AND col IN ('approved_by','marked_by','updated_by')
   AND to_jsonb(OLD)->col IS NOT DISTINCT FROM to_jsonb(NEW)->col THEN CONTINUE; END IF;
  IF TG_OP<>'INSERT' THEN
   r:=to_jsonb(OLD);
   IF r->>col IS NOT NULL THEN actors:=array_append(actors,(r->>col)::uuid); END IF;
  END IF;
  IF TG_OP<>'DELETE' THEN
   r:=to_jsonb(NEW);
   IF r->>col IS NOT NULL THEN actors:=array_append(actors,(r->>col)::uuid); END IF;
  END IF;
 END LOOP;
 FOR a IN SELECT DISTINCT x FROM unnest(actors) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(a::text,4917));
  IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=a) OR EXISTS(SELECT 1 FROM mvp_private.actors WHERE id=a AND retired) THEN
   RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_guard_departing_write() FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.mvp_guard_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF TG_OP='UPDATE' AND NEW.left_at IS NOT NULL AND NEW.room_id=OLD.room_id
 AND EXISTS(SELECT 1 FROM mvp_private.deletion_capabilities WHERE backend_pid=pg_backend_pid()
 AND transaction_id=txid_current() AND table_name='room_members' AND operation='UPDATE'
 AND before_row=to_jsonb(OLD) AND after_row=to_jsonb(NEW)) THEN RETURN NEW; END IF;
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

-- Consolidate the two report guards so the exact capability is consumed once.
DROP TRIGGER zz_mvp_reporter_withdrawal ON public.reports;
DROP TRIGGER zz_mvp_departing_write ON public.reports;
CREATE TRIGGER zz_mvp_departing_write BEFORE INSERT OR UPDATE OR DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.mvp_guard_departing_write('reporter_id','reporter_user_id');
CREATE FUNCTION mvp_private.deletion_columns() RETURNS TABLE(table_name text,cols text[])
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 VALUES
 ('rooms',ARRAY['created_by','host_id']),
 ('posts',ARRAY['user_id','marked_by']),
 ('room_members',ARRAY['user_id','approved_by']),
 ('room_join_requests',ARRAY['user_id','decided_by']),
 ('events',ARRAY['created_by']),('event_members',ARRAY['user_id']),
 ('decisions',ARRAY['decided_by']),('novel_drafts',ARRAY['updated_by']),
 ('room_pre_archive_notes',ARRAY['author_id']),('post_likes',ARRAY['user_id']),
 ('room_likes',ARRAY['user_id']),('reports',ARRAY['reporter_id','reporter_user_id']),
 ('attachment_uploads',ARRAY['user_id']),('work_drafts',ARRAY['updated_by']);
$$;
CREATE FUNCTION mvp_private.deletion_job(p_id uuid,p_lease uuid)
RETURNS public.account_deletion_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs%ROWTYPE;
BEGIN
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'WORKER_ONLY'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 SELECT * INTO j FROM public.account_deletion_jobs WHERE id=p_id AND lease_token=p_lease
 AND lease_until>clock_timestamp() AND stage IN ('requested','prepared','auth_unknown','auth_deleted') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(j.actor_id::text,4917));
 IF j.attribution<>'anonymous' OR j.policy_version<>'withdrawal-draft-2026-10-21' THEN RAISE EXCEPTION 'POLICY_UNSUPPORTED'; END IF;
 RETURN j;
END $$;

-- The caller is a private definer function; public/service roles cannot mint capabilities.
CREATE FUNCTION mvp_private.patch_row(p_table text,p_before jsonb,p_patch jsonb,p_delete boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE assignments text; changed integer; matches boolean;
BEGIN
 IF p_table<>ALL(ARRAY['profiles','public_profiles','rooms','posts','room_members','room_join_requests',
 'events','event_members','decisions','novel_drafts','room_pre_archive_notes','post_likes','room_likes',
 'reports','attachment_uploads','work_drafts']) THEN RAISE EXCEPTION 'TABLE_NOT_ALLOWED'; END IF;
 IF p_delete AND p_table<>ALL(ARRAY['profiles','public_profiles']) THEN RAISE EXCEPTION 'DELETE_NOT_ALLOWED'; END IF;
 INSERT INTO mvp_private.deletion_capabilities VALUES(pg_backend_pid(),txid_current(),p_table,
 CASE WHEN p_delete THEN 'DELETE' ELSE 'UPDATE' END,p_before,CASE WHEN p_delete THEN NULL ELSE p_before||p_patch END);
 IF p_delete THEN
  EXECUTE format('DELETE FROM public.%I t WHERE to_jsonb(t)=$1',p_table) USING p_before;
 ELSE
  SELECT string_agg(format('%I=v.%I',key,key),',') INTO assignments FROM jsonb_object_keys(p_patch) key;
  IF assignments IS NULL THEN RAISE EXCEPTION 'EMPTY_PATCH'; END IF;
  EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) v WHERE to_jsonb(t)=$2',p_table,assignments,p_table)
  USING p_before||p_patch,p_before;
 END IF;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'RETENTION_ROW_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM mvp_private.deletion_capabilities WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current())
 THEN RAISE EXCEPTION 'RETENTION_CAPABILITY_NOT_CONSUMED'; END IF;
 IF NOT p_delete THEN
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I t WHERE to_jsonb(t)=$1)',p_table) INTO matches USING p_before||p_patch;
  IF NOT matches THEN RAISE EXCEPTION 'RETENTION_TRIGGER_CHANGED_ROW'; END IF;
 END IF;
END $$;

CREATE FUNCTION public.mvp_prepare_deletion(p_id uuid,p_lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs%ROWTYPE; surrogate uuid; spec record; rowdata record; patch jsonb; col text; predicate text; expected text; u record;
BEGIN
 j:=mvp_private.deletion_job(p_id,p_lease);
 IF EXISTS(SELECT 1 FROM mvp_private.deletion_prepared WHERE job_id=j.id) THEN RETURN; END IF;
 IF j.stage<>'requested' THEN RAISE EXCEPTION 'PREPARATION_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM public.rooms WHERE created_by=j.actor_id AND deleted_at IS NULL AND status<>'forced_publish') THEN RAISE EXCEPTION 'UNPUBLISHED_CREATOR_ROOMS'; END IF;
 IF EXISTS(SELECT 1 FROM public.room_members m JOIN public.rooms r ON r.id=m.room_id WHERE m.user_id=j.actor_id AND m.left_at IS NULL AND m.role='core' AND r.deleted_at IS NULL AND r.status<>'forced_publish') THEN RAISE EXCEPTION 'ACTIVE_CORE_ROOMS'; END IF;
 -- Managed objects are never modified by SQL; unknown Auth-owned objects require review.
 IF EXISTS(SELECT 1 FROM storage.objects WHERE owner_id=j.actor_id::text OR owner=j.actor_id)
 OR EXISTS(SELECT 1 FROM storage.buckets WHERE owner_id=j.actor_id::text OR owner=j.actor_id) THEN RAISE EXCEPTION 'STORAGE_OWNERSHIP_REVIEW'; END IF;
 surrogate:=gen_random_uuid();
 INSERT INTO mvp_private.actors(id,retired) VALUES(surrogate,true);
 -- Existing legacy jobs are re-anonymized by this exact-row path, not silently certified.
 FOR spec IN SELECT * FROM mvp_private.deletion_columns() LOOP
  SELECT string_agg(format('%I=$1',colname),' OR ') INTO predicate FROM unnest(spec.cols) colname;
  FOR rowdata IN EXECUTE format('SELECT to_jsonb(t) body FROM public.%I t WHERE %s FOR UPDATE',spec.table_name,predicate) USING j.actor_id LOOP
   patch:='{}'::jsonb;
   FOREACH col IN ARRAY spec.cols LOOP
    IF rowdata.body->>col=j.actor_id::text THEN patch:=patch||jsonb_build_object(col,surrogate); END IF;
   END LOOP;
   IF spec.table_name IN ('posts','room_members') AND rowdata.body->>'user_id'=j.actor_id::text
   THEN patch:=patch||jsonb_build_object('username','退会したメンバー'); END IF;
   IF spec.table_name='room_pre_archive_notes' AND rowdata.body->>'author_id'=j.actor_id::text
   THEN patch:=patch||jsonb_build_object('author_name','退会したメンバー'); END IF;
   IF spec.table_name='room_members' AND rowdata.body->>'user_id'=j.actor_id::text AND rowdata.body->>'left_at' IS NULL
   THEN patch:=patch||jsonb_build_object('left_at',clock_timestamp()); END IF;
   IF spec.table_name='room_join_requests' AND rowdata.body->>'user_id'=j.actor_id::text AND rowdata.body->>'status'='pending'
   THEN patch:=patch||jsonb_build_object('status','revoked'); END IF;
   IF spec.table_name='attachment_uploads' AND rowdata.body->>'user_id'=j.actor_id::text
    AND rowdata.body->>'used_at' IS NULL AND rowdata.body->>'post_id' IS NULL AND rowdata.body->>'status'<>'deleted' THEN
    expected:='rooms/'||(rowdata.body->>'room_id')||'/';
    IF rowdata.body->>'bucket'<>'room_uploads' OR expected IS NULL
     OR rowdata.body->>'storage_path' !~ ('^'||expected||'(images|videos|files)/'||(rowdata.body->>'id')||'\.(png|jpg|gif|webp|mp4|webm|pdf|txt)$')
     THEN RAISE EXCEPTION 'UPLOAD_PATH_REVIEW'; END IF;
    IF EXISTS(SELECT 1 FROM public.posts WHERE attachment_url=rowdata.body->>'storage_path')
    THEN RAISE EXCEPTION 'UPLOAD_LINK_REVIEW'; END IF;
    INSERT INTO mvp_private.deletion_uploads(job_id,upload_id,bucket,storage_path)
    VALUES(j.id,(rowdata.body->>'id')::uuid,'room_uploads',rowdata.body->>'storage_path');
    patch:=patch||jsonb_build_object('status','cleanup_pending','cleanup_token',NULL,'cleanup_until',NULL);
   END IF;
   PERFORM mvp_private.patch_row(spec.table_name,rowdata.body,patch);
  END LOOP;
 END LOOP;
 FOR spec IN SELECT unnest(ARRAY['public_profiles','profiles']) table_name LOOP
  FOR rowdata IN EXECUTE format('SELECT to_jsonb(t) body FROM public.%I t WHERE id=$1 FOR UPDATE',spec.table_name) USING j.actor_id LOOP
   PERFORM mvp_private.patch_row(spec.table_name,rowdata.body,NULL,true);
  END LOOP;
 END LOOP;
 UPDATE mvp_private.actors SET retired=true WHERE id=j.actor_id;
 INSERT INTO mvp_private.deletion_prepared(job_id,anonymous_id) VALUES(j.id,surrogate);
 INSERT INTO public.account_departed_authors(actor_id,public_name,attribution,job_id)
 VALUES(surrogate,'退会したメンバー','anonymous',j.id);
END $$;

CREATE FUNCTION public.mvp_deletion_cleanup_candidates(p_id uuid,p_lease uuid)
RETURNS TABLE(upload_id uuid,bucket text,storage_path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM mvp_private.deletion_job(p_id,p_lease);
 IF NOT EXISTS(SELECT 1 FROM mvp_private.deletion_prepared WHERE job_id=p_id) THEN RAISE EXCEPTION 'PREPARATION_MISSING'; END IF;
 RETURN QUERY SELECT u.upload_id,u.bucket,u.storage_path FROM mvp_private.deletion_uploads u WHERE u.job_id=p_id AND NOT u.deleted ORDER BY u.upload_id;
END $$;
CREATE FUNCTION public.mvp_finish_deletion_upload(p_id uuid,p_lease uuid,p_upload uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE u mvp_private.deletion_uploads%ROWTYPE; before_row jsonb;
BEGIN
 PERFORM mvp_private.deletion_job(p_id,p_lease);
 SELECT * INTO u FROM mvp_private.deletion_uploads WHERE job_id=p_id AND upload_id=p_upload FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_NOT_AUTHORIZED'; END IF;
 IF u.deleted THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=u.bucket AND name=u.storage_path) THEN RAISE EXCEPTION 'STORAGE_NOT_REMOVED'; END IF;
 SELECT to_jsonb(a) INTO before_row FROM public.attachment_uploads a WHERE id=p_upload AND status='cleanup_pending'
 AND used_at IS NULL AND post_id IS NULL AND bucket=u.bucket AND storage_path=u.storage_path FOR UPDATE;
 IF before_row IS NULL THEN RAISE EXCEPTION 'UPLOAD_CHANGED'; END IF;
 PERFORM mvp_private.patch_row('attachment_uploads',before_row,jsonb_build_object('status','deleted','deleted_at',clock_timestamp()));
 UPDATE mvp_private.deletion_uploads SET deleted=true WHERE job_id=p_id AND upload_id=p_upload;
END $$;

CREATE FUNCTION public.mvp_verify_deletion(p_id uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs%ROWTYPE; spec record; predicate text; found_old boolean; ready boolean; surrogate uuid;
BEGIN
 j:=mvp_private.deletion_job(p_id,p_lease);
 SELECT anonymous_id INTO surrogate FROM mvp_private.deletion_prepared WHERE job_id=j.id;
 IF surrogate IS NULL THEN RAISE EXCEPTION 'PREPARATION_MISSING'; END IF;
 FOR spec IN SELECT * FROM mvp_private.deletion_columns() LOOP
  SELECT string_agg(format('%I=$1',colname),' OR ') INTO predicate FROM unnest(spec.cols) colname;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %s)',spec.table_name,predicate) INTO found_old USING j.actor_id;
  IF found_old THEN RAISE EXCEPTION 'ORIGINAL_IDENTITY_REMAINING'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM profiles WHERE id=j.actor_id) OR EXISTS(SELECT 1 FROM public_profiles WHERE id=j.actor_id)
 OR EXISTS(SELECT 1 FROM room_members WHERE user_id=surrogate AND left_at IS NULL) THEN RAISE EXCEPTION 'PREPARATION_INCOMPLETE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE c.contype='f' AND c.confrelid='auth.users'::regclass AND n.nspname='public' AND t.relname NOT IN ('profiles','public_profiles')) THEN RAISE EXCEPTION 'NEW_AUTH_FK_REVIEW'; END IF;
 ready:=NOT EXISTS(SELECT 1 FROM mvp_private.deletion_uploads WHERE job_id=j.id AND NOT deleted)
 AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE owner_id=j.actor_id::text OR owner=j.actor_id)
 AND NOT EXISTS(SELECT 1 FROM storage.buckets WHERE owner_id=j.actor_id::text OR owner=j.actor_id);
 RETURN jsonb_build_object('jobId',j.id,'actorId',j.actor_id,'writesBlocked',true,'retainedWorksVerified',true,
 'attributionApplied',true,'foreignKeysVerified',true,'storageReadyForAuthDeletion',ready);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mvp_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mvp_prepare_deletion(uuid,uuid),public.mvp_deletion_cleanup_candidates(uuid,uuid),
 public.mvp_finish_deletion_upload(uuid,uuid,uuid),public.mvp_verify_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_prepare_deletion(uuid,uuid),public.mvp_deletion_cleanup_candidates(uuid,uuid),
 public.mvp_finish_deletion_upload(uuid,uuid,uuid),public.mvp_verify_deletion(uuid,uuid) TO service_role;
COMMIT;

