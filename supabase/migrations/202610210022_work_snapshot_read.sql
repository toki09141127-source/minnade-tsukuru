-- 021 prerequisite. Public work snapshots must not require membership-table ACL.
BEGIN;
CREATE FUNCTION public.mvp_can_read_work_draft(p_room uuid,p_published timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT (auth.uid() IS NULL OR public.mvp_current_account_active())
 AND EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=p_room AND r.is_hidden=false AND r.deleted_at IS NULL
 AND ((r.status='forced_publish' AND p_published IS NOT NULL)
 OR (r.status='open' AND p_published IS NULL AND EXISTS(SELECT 1 FROM public.room_members m
 WHERE m.room_id=r.id AND m.user_id=auth.uid() AND m.left_at IS NULL AND m.role IN ('creator','core','supporter')))));
$$;
REVOKE ALL ON FUNCTION public.mvp_can_read_work_draft(uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mvp_can_read_work_draft(uuid,timestamptz) TO anon,authenticated,service_role;
DROP POLICY work_draft_read ON public.work_drafts;
CREATE POLICY work_draft_read ON public.work_drafts FOR SELECT TO anon,authenticated
 USING(public.mvp_can_read_work_draft(room_id,published_at));
CREATE POLICY mvp_work_draft_boundary ON public.work_drafts AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.mvp_can_read_work_draft(room_id,published_at));
REVOKE ALL ON public.work_drafts FROM PUBLIC,anon,authenticated;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT attname FROM pg_attribute WHERE attrelid='public.work_drafts'::regclass AND attnum>0 AND NOT attisdropped LOOP
 EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.work_drafts FROM PUBLIC,anon,authenticated',c.attname,c.attname,c.attname,c.attname);
 END LOOP;
END $$;
GRANT SELECT(room_id,blocks,version,updated_at,published_at) ON public.work_drafts TO anon,authenticated;
COMMIT;

