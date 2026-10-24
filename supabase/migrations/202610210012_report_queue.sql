-- LOCAL ONLY. Pending intake resolution is separate from legacy processing state.
BEGIN;
CREATE TABLE public.report_resolutions(
 receipt_id uuid PRIMARY KEY REFERENCES public.report_intake(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE, actor_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('hidden','no_action')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 1 AND 1000),
 resolved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.report_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_resolutions FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX report_intake_pending_order ON public.report_intake(created_at,id) WHERE state='pending';
CREATE FUNCTION public.mvp_require_report_operator(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_actor IS NULL OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.moderation_operators WHERE user_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_require_report_operator(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_pending_reports(p_actor uuid,p_after_time timestamptz DEFAULT NULL,p_after_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; total bigint; overdue bigint; oldest timestamptz;
BEGIN
 PERFORM public.mvp_require_report_operator(p_actor);
 IF (p_after_time IS NULL)<>(p_after_id IS NULL) THEN RAISE EXCEPTION 'INVALID_CURSOR'; END IF;
 SELECT count(*),count(*) FILTER(WHERE i.created_at<=now()-interval '24 hours'),min(i.created_at)
 INTO total,overdue,oldest FROM public.report_intake i
 WHERE i.state='pending' AND NOT EXISTS(SELECT 1 FROM public.report_resolutions r WHERE r.receipt_id=i.id);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at,q.id),'[]'::jsonb) INTO result FROM (
 SELECT i.id,i.target_type,i.target_id,i.reason,i.created_at FROM public.report_intake i
 WHERE i.state='pending' AND NOT EXISTS(SELECT 1 FROM public.report_resolutions r WHERE r.receipt_id=i.id)
 AND (p_after_time IS NULL OR (i.created_at,i.id)>(p_after_time,p_after_id))
 ORDER BY i.created_at,i.id LIMIT 51) q;
 RETURN jsonb_build_object('items',result,'total',total,'overdue',overdue,'oldest',oldest,'checkedAt',now());
END $$;
CREATE FUNCTION public.mvp_resolve_report(p_actor uuid,p_receipt uuid,p_request uuid,p_outcome text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE i public.report_intake%ROWTYPE; r public.report_resolutions%ROWTYPE;
BEGIN
 PERFORM public.mvp_require_report_operator(p_actor);
 IF p_receipt IS NULL OR p_request IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('hidden','no_action')
 OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,1801));
 SELECT * INTO r FROM public.report_resolutions WHERE request_id=p_request;
 IF FOUND THEN
  IF r.receipt_id<>p_receipt OR r.actor_id<>p_actor OR r.outcome<>p_outcome OR r.note<>btrim(p_note)
   THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN;
 END IF;
 SELECT * INTO i FROM public.report_intake WHERE id=p_receipt AND state='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM public.report_resolutions WHERE receipt_id=p_receipt) THEN RAISE EXCEPTION 'ALREADY_RESOLVED'; END IF;
 IF EXISTS(SELECT 1 FROM public.moderation_actions WHERE request_id=p_request) THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
 IF p_outcome='hidden' THEN
  PERFORM public.mvp_moderate(p_actor,i.target_type,i.target_id,'other',true,p_request);
 END IF;
 INSERT INTO public.report_resolutions(receipt_id,request_id,actor_id,outcome,note)
 VALUES(p_receipt,p_request,p_actor,p_outcome,btrim(p_note));
END $$;
REVOKE ALL ON FUNCTION public.mvp_pending_reports(uuid,timestamptz,uuid),public.mvp_resolve_report(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_pending_reports(uuid,timestamptz,uuid),public.mvp_resolve_report(uuid,uuid,uuid,text,text) TO service_role;
COMMIT;
