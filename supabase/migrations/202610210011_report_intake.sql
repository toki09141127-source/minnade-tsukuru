-- LOCAL CANDIDATE. Preserve receipt even if legacy reports triggers reject processing.
BEGIN;
CREATE TABLE public.report_intake (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reporter_user_id uuid NOT NULL, request_id uuid NOT NULL,
 target_type text NOT NULL CHECK(target_type IN ('room','post')), target_id uuid NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 2000),
 state text NOT NULL CHECK(state IN ('pending','processed')),
 failure_code text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(reporter_user_id,request_id)
);
ALTER TABLE public.report_intake ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_intake FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.report_intake TO service_role;
CREATE FUNCTION public.mvp_receive_report(p_actor uuid,p_request uuid,p_type text,p_target uuid,p_reason text)
RETURNS TABLE(receipt_id uuid,processing_state text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.report_intake%ROWTYPE; failure text;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR p_target IS NULL OR p_type IS NULL OR p_type NOT IN ('room','post')
 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF auth.uid() IS NOT NULL AND auth.uid()<>p_actor THEN RAISE EXCEPTION 'ACTOR_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 INSERT INTO public.report_intake(reporter_user_id,request_id,target_type,target_id,reason,state)
 VALUES(p_actor,p_request,p_type,p_target,btrim(p_reason),'pending')
 ON CONFLICT(reporter_user_id,request_id) DO NOTHING;
 SELECT * INTO r FROM public.report_intake WHERE reporter_user_id=p_actor AND request_id=p_request FOR UPDATE;
 IF r.target_type<>p_type OR r.target_id<>p_target OR r.reason<>btrim(p_reason) THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
 -- Retry returns the original receipt. Pending rows need operator reconciliation,
 -- never blindly rerun a potentially problematic legacy trigger on client retry.
 IF r.state='processed' OR r.failure_code IS NOT NULL THEN RETURN QUERY SELECT r.id,r.state; RETURN; END IF;
 BEGIN
  -- Audited apply_auto_hide reads these legacy target columns, not target_id.
  INSERT INTO public.reports(reporter_user_id,target_type,target_id,reason,target_room_id,target_post_id)
  VALUES(p_actor,p_type,p_target,btrim(p_reason),
   CASE WHEN p_type='room' THEN p_target END, CASE WHEN p_type='post' THEN p_target END);
  UPDATE public.report_intake SET state='processed' WHERE id=r.id;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS failure=RETURNED_SQLSTATE;
  UPDATE public.report_intake SET failure_code=failure WHERE id=r.id;
 END;
 RETURN QUERY SELECT i.id,i.state FROM public.report_intake i WHERE i.id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_receive_report(uuid,uuid,text,uuid,text) TO service_role;
-- The original generic guard did not recognize reporter_user_id.
CREATE TRIGGER zz_mvp_reporter_withdrawal BEFORE INSERT OR UPDATE OR DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.mvp_guard_departing_write('reporter_user_id');
COMMIT;
