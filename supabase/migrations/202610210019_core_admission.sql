-- Staging candidate after 018. Never rerun an already applied migration.
BEGIN;
ALTER TABLE public.room_join_requests ADD COLUMN membership_id uuid, ADD COLUMN membership_joined_at timestamptz;
-- Existing pending requests have no snapshot: they cannot be approved silently.
CREATE UNIQUE INDEX mvp_one_pending_core_request ON public.room_join_requests(room_id,user_id) WHERE status='pending';
CREATE FUNCTION public.mvp_request_core(p_actor uuid,p_room uuid,p_terms text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; m public.room_members%ROWTYPE; req public.room_join_requests%ROWTYPE; result uuid;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF p_actor IS NULL OR p_room IS NULL OR p_terms IS DISTINCT FROM '2026-03-24' OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
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
REVOKE ALL ON FUNCTION public.mvp_request_core(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_request_core(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.mvp_decide_core(p_actor uuid,p_room uuid,p_request uuid,p_approve boolean) RETURNS jsonb
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
  IF EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=p_room AND user_id=target) THEN RAISE EXCEPTION 'MEMBER_EXCLUDED'; END IF;
  SELECT * INTO m FROM public.room_members WHERE room_id=p_room AND user_id=target FOR UPDATE;
  IF NOT FOUND OR m.left_at IS NOT NULL OR m.role IS DISTINCT FROM 'supporter' OR req.membership_id IS DISTINCT FROM m.id
    OR req.membership_joined_at IS DISTINCT FROM m.joined_at THEN RAISE EXCEPTION 'STALE_MEMBERSHIP'; END IF;
  IF req.requested_role<>'core' OR req.room_terms_version IS DISTINCT FROM '2026-03-24'
    OR req.room_agreed_at IS NULL OR req.forced_publish_ack_at IS NULL OR req.core_lock_agreed_at IS NULL THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
  IF (SELECT count(*) FROM public.room_members WHERE room_id=p_room AND role='core' AND left_at IS NULL)>=4 THEN RAISE EXCEPTION 'CORE_FULL'; END IF;
  UPDATE public.room_members SET role='core',is_core=true,approved_at=clock_timestamp(),approved_by=p_actor,
   room_terms_version=req.room_terms_version,room_agreed_at=req.room_agreed_at,forced_publish_ack_at=req.forced_publish_ack_at,core_lock_agreed_at=req.core_lock_agreed_at
   WHERE id=m.id;
 END IF;
 UPDATE public.room_join_requests SET status=outcome,decided_at=clock_timestamp(),decided_by=p_actor WHERE id=req.id;
 RETURN jsonb_build_object('ok',true,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.mvp_decide_core(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_decide_core(uuid,uuid,uuid,boolean) TO service_role;
-- Keep objects for dependency/history inspection, retire every legacy caller-supplied actor path.
REVOKE ALL ON FUNCTION public.approve_core_request(uuid,uuid,uuid),public.reject_core_request(uuid,uuid,uuid),
 public.join_core_first_come(uuid,uuid),public.join_core_by_invite(uuid,uuid,text),public.join_room(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
