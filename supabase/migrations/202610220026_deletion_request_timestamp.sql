-- 026: account for the audited request timestamp trigger in exact retention capabilities.
BEGIN;
CREATE OR REPLACE FUNCTION mvp_private.patch_row(p_table text,p_before jsonb,p_patch jsonb,p_delete boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE assignments text; changed integer; matches boolean;
BEGIN
 IF p_table<>ALL(ARRAY['profiles','public_profiles','rooms','posts','room_members','room_join_requests',
 'events','event_members','decisions','novel_drafts','room_pre_archive_notes','post_likes','room_likes',
 'reports','attachment_uploads','work_drafts']) THEN RAISE EXCEPTION 'TABLE_NOT_ALLOWED'; END IF;
 IF p_delete AND p_table<>ALL(ARRAY['profiles','public_profiles']) THEN RAISE EXCEPTION 'DELETE_NOT_ALLOWED'; END IF;
 -- Audited trg_room_join_requests_updated_at sets now() before the write fence.
 -- Include the same transaction timestamp in the exact expected row; never ignore columns.
 IF NOT p_delete AND p_table='room_join_requests' THEN
  p_patch:=p_patch||jsonb_build_object('updated_at',now());
 END IF;
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

REVOKE ALL ON FUNCTION mvp_private.patch_row(text,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
