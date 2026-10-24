-- LOCAL CANDIDATE. Durable workflow storage only; preparation/Storage adapters require audit.
BEGIN;
CREATE TABLE public.account_deletion_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL UNIQUE,
 stage text NOT NULL DEFAULT 'requested' CHECK(stage IN ('requested','prepared','auth_unknown','auth_deleted','completed','needs_review')),
 attribution text NOT NULL CHECK(attribution IN ('anonymous','keep_name')),
 policy_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid,
 lease_until timestamptz
);
-- Deliberately no auth FK: deleting Auth must not destroy recovery state.
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.account_deletion_jobs TO service_role;
CREATE FUNCTION public.mvp_claim_deletion(p_id uuid) RETURNS SETOF public.account_deletion_jobs
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 UPDATE public.account_deletion_jobs SET lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes'
 WHERE id=p_id AND (lease_until IS NULL OR lease_until<clock_timestamp())
 RETURNING *;
$$;
CREATE FUNCTION public.mvp_advance_deletion(p_id uuid,p_lease uuid,p_expected text,p_next text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT ((p_expected='requested' AND p_next IN ('prepared','needs_review'))
   OR (p_expected='prepared' AND p_next='auth_unknown')
   OR (p_expected='auth_unknown' AND p_next='auth_deleted')
   OR (p_expected='auth_deleted' AND p_next='completed')) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 UPDATE public.account_deletion_jobs SET stage=p_next,updated_at=clock_timestamp()
 WHERE id=p_id AND lease_token=p_lease AND lease_until>clock_timestamp() AND stage=p_expected;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_claim_deletion(uuid), public.mvp_advance_deletion(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_claim_deletion(uuid), public.mvp_advance_deletion(uuid,uuid,text,text) TO service_role;

CREATE FUNCTION public.mvp_request_deletion(p_actor uuid,p_attribution text,p_policy text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR p_attribution IS NULL OR p_attribution NOT IN ('anonymous','keep_name')
  OR p_policy IS DISTINCT FROM 'withdrawal-draft-2026-10-21' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 INSERT INTO public.account_deletion_jobs(actor_id,attribution,policy_version)
 VALUES(p_actor,p_attribution,p_policy) ON CONFLICT(actor_id) DO NOTHING;
 SELECT * INTO j FROM public.account_deletion_jobs WHERE actor_id=p_actor;
 IF j.attribution<>p_attribution OR j.policy_version<>p_policy THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
 RETURN j.id;
END $$;
REVOKE ALL ON FUNCTION public.mvp_request_deletion(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_request_deletion(uuid,text,text) TO service_role;
COMMIT;
