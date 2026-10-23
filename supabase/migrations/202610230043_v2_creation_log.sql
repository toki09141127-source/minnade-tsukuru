-- V2.1 safe creation log, common blocks, immutable public snapshots. Staging first.
BEGIN;
ALTER TABLE public.posts ADD COLUMN excluded_from_public_log boolean NOT NULL DEFAULT false,
 ADD COLUMN excluded_by uuid, ADD COLUMN excluded_at timestamptz;
CREATE INDEX v2_log_cursor ON public.posts(room_id,created_at,id) WHERE is_hidden=false AND deleted_at IS NULL;
CREATE INDEX v2_log_highlights ON public.posts(room_id,created_at,id) WHERE is_marked=true AND is_hidden=false AND deleted_at IS NULL;
GRANT SELECT(excluded_from_public_log) ON public.posts TO anon,authenticated;
GRANT SELECT(v2_enabled,capacity,genre) ON public.rooms TO anon,authenticated;

CREATE FUNCTION mvp_private.v2_safe_text(value text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT value IS NOT NULL AND normalize(value,NFKC) !~* '([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(\+81[-[:space:]]?|0)[0-9]{1,4}[-[:space:]]?[0-9]{1,4}[-[:space:]]?[0-9]{3,4}|〒[[:space:]]*[0-9]{3}-?[0-9]{4}|(都|道|府|県).{0,12}(市|区|町|村).{0,15}[0-9]+丁目|@[a-z0-9_]{2,}|(instagram\.com|x\.com|twitter\.com)/[^[:space:]]+|<[^>]*>)';
$$;
REVOKE ALL ON FUNCTION mvp_private.v2_safe_text(text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mvp_private.v2_post_eligible(p_post uuid,p_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.posts p JOIN public.post_publication_reviews v ON v.post_id=p.id
 WHERE p.id=p_post AND p.room_id=p_room AND p.is_hidden=false AND p.deleted_at IS NULL AND NOT p.excluded_from_public_log
 AND v.approved AND mvp_private.v2_safe_text(coalesce(p.content,'')) AND mvp_private.v2_safe_text(coalesce(p.username,''))
 AND v.content_hash=encode(sha256(convert_to(octet_length(coalesce(p.content,''))::text||':'||coalesce(p.content,'')||octet_length(coalesce(p.attachment_url,''))::text||':'||coalesce(p.attachment_url,'')||octet_length(coalesce(p.attachment_type,''))::text||':'||coalesce(p.attachment_type,''),'UTF8')),'hex'));
$$;
REVOKE ALL ON FUNCTION mvp_private.v2_post_eligible(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.mvp_public_post_allowed(p_post uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.posts p JOIN public.rooms r ON r.id=p.room_id
 WHERE p.id=p_post AND p.is_hidden=false AND p.deleted_at IS NULL AND r.status='forced_publish' AND r.is_hidden=false AND r.deleted_at IS NULL
 AND (CASE WHEN r.v2_enabled THEN mvp_private.v2_post_eligible(p.id,r.id)
 ELSE NOT EXISTS(SELECT 1 FROM public.work_drafts d WHERE d.room_id=r.id)
 OR EXISTS(SELECT 1 FROM public.post_publication_reviews v WHERE v.post_id=p.id AND v.approved
 AND v.content_hash=encode(sha256(convert_to(octet_length(coalesce(p.content,''))::text||':'||coalesce(p.content,'')||octet_length(coalesce(p.attachment_url,''))::text||':'||coalesce(p.attachment_url,'')||octet_length(coalesce(p.attachment_type,''))::text||':'||coalesce(p.attachment_type,''),'UTF8')),'hex')) END));
$$;

CREATE FUNCTION public.v2_post_action(p_room uuid,p_post uuid,p_action text,p_expected boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid; r public.rooms%ROWTYPE; p public.posts%ROWTYPE; result jsonb; digest text;
BEGIN
 a:=mvp_private.v2_actor();
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR NOT r.v2_enabled OR r.status<>'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.room_members WHERE room_id=p_room AND user_id=a AND left_at IS NULL AND role IN ('creator','core') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO p FROM public.posts WHERE id=p_post AND room_id=p_room AND is_hidden=false AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF p_action='highlight' THEN
  RETURN public.mvp_highlight(a,p_room,p_post,p_expected);
 ELSIF p_action IN ('exclude','include') THEN
  UPDATE public.posts SET excluded_from_public_log=(p_action='exclude'),excluded_by=CASE WHEN p_action='exclude' THEN a END,
   excluded_at=CASE WHEN p_action='exclude' THEN clock_timestamp() END WHERE id=p_post;
 ELSIF p_action='approve_public' THEN
  IF NOT mvp_private.v2_safe_text(coalesce(p.content,'')) THEN RAISE EXCEPTION 'UNSAFE_CONTENT'; END IF;
  digest:=encode(sha256(convert_to(octet_length(coalesce(p.content,''))::text||':'||coalesce(p.content,'')||octet_length(coalesce(p.attachment_url,''))::text||':'||coalesce(p.attachment_url,'')||octet_length(coalesce(p.attachment_type,''))::text||':'||coalesce(p.attachment_type,''),'UTF8')),'hex');
  PERFORM public.mvp_review_log(a,p_room,p_post,true,digest);
 ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.v2_post_action(uuid,uuid,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.v2_post_action(uuid,uuid,text,boolean) TO authenticated;

CREATE FUNCTION mvp_private.v2_validate_blocks(p_room uuid,p_blocks jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b jsonb; item jsonb; t text; total integer:=0;
BEGIN
 IF jsonb_typeof(p_blocks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_blocks)>50 OR octet_length(p_blocks::text)>300000 THEN RAISE EXCEPTION 'INVALID_BLOCKS'; END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_blocks))<>jsonb_array_length(p_blocks) THEN RAISE EXCEPTION 'DUPLICATE_BLOCK_ID'; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(p_blocks) LOOP
  IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR jsonb_typeof(b->'id') IS DISTINCT FROM 'string' OR char_length(b->>'id') NOT BETWEEN 1 AND 64
  OR b->>'type' IS NULL OR b->>'type' NOT IN ('heading','summary','text','image','list','divider','link')
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(b) k WHERE k<>ALL(ARRAY['id','type','text','items','postId','label','url'])) THEN RAISE EXCEPTION 'INVALID_BLOCK'; END IF;
  t:=b->>'type';
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(b) k WHERE k<>ALL(ARRAY['id','type'] || CASE
   WHEN t IN ('heading','summary','text') THEN ARRAY['text'] WHEN t='list' THEN ARRAY['items']
   WHEN t='image' THEN ARRAY['postId'] WHEN t='link' THEN ARRAY['label','url'] ELSE ARRAY[]::text[] END)) THEN RAISE EXCEPTION 'INVALID_BLOCK_FIELDS'; END IF;
  IF t IN ('heading','summary','text') THEN
   IF jsonb_typeof(b->'text') IS DISTINCT FROM 'string' OR char_length(b->>'text')>20000 OR NOT mvp_private.v2_safe_text(b->>'text') THEN RAISE EXCEPTION 'UNSAFE_BLOCK'; END IF;
  ELSIF t='list' THEN
   IF jsonb_typeof(b->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(b->'items')>100 THEN RAISE EXCEPTION 'INVALID_LIST'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(b->'items') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR char_length(item#>>'{}')>2000 OR NOT mvp_private.v2_safe_text(item#>>'{}') THEN RAISE EXCEPTION 'UNSAFE_BLOCK'; END IF;
   END LOOP;
  ELSIF t='image' THEN
   IF b->>'postId' IS NULL OR NOT mvp_private.v2_post_eligible((b->>'postId')::uuid,p_room)
   OR NOT EXISTS(SELECT 1 FROM public.posts p JOIN public.attachment_uploads u ON u.post_id=p.id AND u.room_id=p.room_id
    WHERE p.id=(b->>'postId')::uuid AND p.attachment_type LIKE 'image/%' AND u.status='bound' AND u.storage_path=p.attachment_url AND u.used_at IS NOT NULL) THEN RAISE EXCEPTION 'IMAGE_UNAVAILABLE'; END IF;
  ELSIF t='link' THEN
   IF jsonb_typeof(b->'url') IS DISTINCT FROM 'string' OR char_length(b->>'url')>2048
   OR b->>'url' !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}(/[a-zA-Z0-9/_~.%-]*)?$'
   OR NOT mvp_private.v2_safe_text(coalesce(b->>'label','')) OR char_length(coalesce(b->>'label',''))>200 THEN RAISE EXCEPTION 'INVALID_LINK'; END IF;
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION mvp_private.v2_validate_blocks(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.v2_save_draft(p_room uuid,p_version integer,p_blocks jsonb,p_reviewed boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid; r public.rooms%ROWTYPE; v integer;
BEGIN
 a:=mvp_private.v2_actor();
 IF p_reviewed IS DISTINCT FROM true OR p_version IS NULL OR p_version<0 THEN RAISE EXCEPTION 'REVIEW_REQUIRED'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR NOT r.v2_enabled OR r.status<>'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.room_members WHERE room_id=p_room AND user_id=a AND left_at IS NULL AND role IN ('creator','core') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM mvp_private.v2_validate_blocks(p_room,p_blocks);
 INSERT INTO public.work_drafts(room_id) VALUES(p_room) ON CONFLICT DO NOTHING;
 UPDATE public.work_drafts SET blocks=p_blocks,version=version+1,updated_by=a,updated_at=clock_timestamp()
 WHERE room_id=p_room AND version=p_version AND published_at IS NULL RETURNING version INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.v2_save_draft(uuid,integer,jsonb,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.v2_save_draft(uuid,integer,jsonb,boolean) TO authenticated;

CREATE TABLE public.v2_work_snapshots(
 room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE RESTRICT,
 title text NOT NULL,description text NOT NULL,genre text NOT NULL,blocks jsonb NOT NULL,
 incomplete boolean NOT NULL,source_version integer NOT NULL,published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_work_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v2_work_snapshots FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.v2_work_snapshots TO anon,authenticated;
CREATE POLICY v2_work_read ON public.v2_work_snapshots FOR SELECT TO anon,authenticated
 USING(EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=room_id AND r.status='forced_publish' AND r.is_hidden=false AND r.deleted_at IS NULL)
 AND (auth.uid() IS NULL OR public.mvp_current_account_active()));
CREATE FUNCTION public.v2_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'SNAPSHOT_IMMUTABLE'; END $$;
REVOKE ALL ON FUNCTION public.v2_snapshot_immutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER v2_snapshot_immutable BEFORE UPDATE OR DELETE ON public.v2_work_snapshots FOR EACH ROW EXECUTE FUNCTION public.v2_snapshot_immutable();
CREATE POLICY v2_private_draft ON public.work_drafts AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(NOT EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=room_id AND r.v2_enabled) OR published_at IS NULL);

CREATE FUNCTION public.v2_log(p_room uuid,p_query text DEFAULT '',p_filter text DEFAULT 'all',p_after timestamptz DEFAULT NULL,p_after_id uuid DEFAULT NULL,p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid,user_id uuid,username text,content text,created_at timestamptz,attachment_type text,is_marked boolean,excluded_from_public_log boolean,has_attachment boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_query IS NULL OR char_length(p_query)>100 OR p_filter IS NULL OR p_filter NOT IN ('all','highlight','image','mine') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
 OR (p_after IS NULL)<>(p_after_id IS NULL) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 RETURN QUERY SELECT p.id,p.user_id,p.username,p.content,p.created_at,p.attachment_type,p.is_marked,p.excluded_from_public_log,p.attachment_url IS NOT NULL
 FROM public.posts p WHERE p.room_id=p_room AND p.is_hidden=false AND p.deleted_at IS NULL
 AND (p_after IS NULL OR (p.created_at,p.id)>(p_after,p_after_id))
 AND (p_filter='all' OR p_filter='highlight' AND p.is_marked OR p_filter='image' AND p.attachment_type LIKE 'image/%' OR p_filter='mine' AND p.user_id=auth.uid())
 AND (p_query='' OR position(lower(p_query) IN lower(coalesce(p.content,'')||' '||coalesce(p.username,'')))>0)
 ORDER BY p.created_at,p.id LIMIT p_limit;
END $$;
REVOKE ALL ON FUNCTION public.v2_log(uuid,text,text,timestamptz,uuid,integer) FROM PUBLIC,service_role;
GRANT EXECUTE ON FUNCTION public.v2_log(uuid,text,text,timestamptz,uuid,integer) TO anon,authenticated;
-- Retention extends the existing exact-row capability; ordinary callers remain denied.
CREATE OR REPLACE FUNCTION mvp_private.deletion_columns() RETURNS TABLE(table_name text,cols text[])
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 VALUES
 ('rooms',ARRAY['created_by','host_id']),
 ('posts',ARRAY['user_id','marked_by','excluded_by']),
 ('room_members',ARRAY['user_id','approved_by']),
 ('room_join_requests',ARRAY['user_id','decided_by']),
 ('events',ARRAY['created_by']),('event_members',ARRAY['user_id']),
 ('decisions',ARRAY['decided_by']),('novel_drafts',ARRAY['updated_by']),
 ('room_pre_archive_notes',ARRAY['author_id']),('post_likes',ARRAY['user_id']),
 ('room_likes',ARRAY['user_id']),('reports',ARRAY['reporter_id','reporter_user_id']),
 ('core_resignations',ARRAY['user_id','decided_by']),('attachment_uploads',ARRAY['user_id']),('work_drafts',ARRAY['updated_by']);
$$;
CREATE OR REPLACE FUNCTION mvp_private.patch_row(p_table text,p_before jsonb,p_patch jsonb,p_delete boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE assignments text; changed integer; matches boolean;
BEGIN
 IF p_table<>ALL(ARRAY['profiles','public_profiles','rooms','posts','room_members','room_join_requests',
 'events','event_members','decisions','novel_drafts','room_pre_archive_notes','post_likes','room_likes',
 'reports','attachment_uploads','work_drafts','core_resignations']) THEN RAISE EXCEPTION 'TABLE_NOT_ALLOWED'; END IF;
 -- Audited BEFORE UPDATE set_updated_at() uses transaction_timestamp() on this table.
 -- Predict exactly that value; the one-use capability still compares the entire row.
 IF p_table='room_join_requests' AND NOT p_delete THEN p_patch:=p_patch||jsonb_build_object('updated_at',transaction_timestamp()); END IF;
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
DROP TRIGGER zz_mvp_departing_write ON public.posts;
CREATE TRIGGER zz_mvp_departing_write BEFORE INSERT OR UPDATE OR DELETE ON public.posts
 FOR EACH ROW EXECUTE FUNCTION public.mvp_guard_departing_write('user_id','marked_by','excluded_by');

-- Fence V2 upload registration against leave/kick, including a delayed Storage write.
CREATE FUNCTION mvp_private.v2_upload_member(p_actor uuid,p_room uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT coalesce(r.v2_enabled,false) THEN RETURN; END IF;
 IF r.status<>'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL OR r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.room_members WHERE room_id=p_room AND user_id=p_actor AND left_at IS NULL FOR SHARE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=p_room AND user_id=p_actor) THEN RAISE EXCEPTION 'MEMBER_REQUIRED'; END IF;
END $$;
REVOKE ALL ON FUNCTION mvp_private.v2_upload_member(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mvp_private.v2_upload_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE u public.attachment_uploads%ROWTYPE;
BEGIN
 IF TG_TABLE_SCHEMA='storage' THEN
  SELECT * INTO u FROM public.attachment_uploads WHERE bucket=NEW.bucket_id AND storage_path=NEW.name;
  IF FOUND THEN PERFORM mvp_private.v2_upload_member(u.user_id,u.room_id); END IF;
 ELSE
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM mvp_private.deletion_capabilities WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current() AND table_name='attachment_uploads' AND operation='UPDATE' AND before_row=to_jsonb(OLD) AND after_row=to_jsonb(NEW)) THEN RETURN NEW; END IF;
  IF NEW.status IN ('reserved','uploaded') THEN PERFORM mvp_private.v2_upload_member(NEW.user_id,NEW.room_id); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mvp_private.v2_upload_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER v2_upload_guard BEFORE INSERT OR UPDATE ON public.attachment_uploads FOR EACH ROW EXECUTE FUNCTION mvp_private.v2_upload_guard();
CREATE TRIGGER v2_upload_guard BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION mvp_private.v2_upload_guard();
COMMIT;
