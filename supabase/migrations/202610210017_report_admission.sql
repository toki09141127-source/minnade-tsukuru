-- LOCAL CANDIDATE: authorized first receipt; retries retain original receipt.
BEGIN;
ALTER FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) RENAME TO mvp_receive_report_internal;
REVOKE ALL ON FUNCTION public.mvp_receive_report_internal(uuid,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_receive_report(p_actor uuid,p_request uuid,p_type text,p_target uuid,p_reason text)
RETURNS TABLE(receipt_id uuid,processing_state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; target_room uuid;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR p_target IS NULL OR p_type IS NULL OR p_type NOT IN ('room','post')
 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000
 OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 IF EXISTS(SELECT 1 FROM public.report_intake i WHERE i.reporter_user_id=p_actor AND i.request_id=p_request) THEN
  RETURN QUERY SELECT * FROM public.mvp_receive_report_internal(p_actor,p_request,p_type,p_target,p_reason); RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM public.report_intake i WHERE i.reporter_user_id=p_actor AND i.target_type=p_type AND i.target_id=p_target)
 THEN RAISE EXCEPTION 'ALREADY_REPORTED'; END IF;
 IF p_type='post' THEN
  SELECT room_id INTO target_room FROM public.posts WHERE id=p_target;
 ELSE target_room:=p_target; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=target_room FOR UPDATE;
 IF NOT FOUND OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE'; END IF;
 IF p_type='post' THEN
  PERFORM 1 FROM public.posts WHERE id=p_target AND room_id=r.id AND is_hidden=false AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE'; END IF;
  IF r.status='forced_publish' THEN
   IF NOT public.mvp_public_post_allowed(p_target) THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE'; END IF;
  ELSE
   PERFORM 1 FROM public.room_members WHERE room_id=r.id AND user_id=p_actor AND left_at IS NULL
    AND role IN ('creator','core','supporter') FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_UNAVAILABLE'; END IF;
  END IF;
 END IF;
 RETURN QUERY SELECT * FROM public.mvp_receive_report_internal(p_actor,p_request,p_type,p_target,p_reason);
END $$;
REVOKE ALL ON FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) TO service_role;
COMMIT;
