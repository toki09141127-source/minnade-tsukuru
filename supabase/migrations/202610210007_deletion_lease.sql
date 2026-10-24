-- LOCAL CANDIDATE ONLY. Does not enable deletion or change existing Auth/FKs.
BEGIN;
CREATE FUNCTION public.mvp_renew_deletion(p_id uuid,p_lease uuid,p_expected text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.account_deletion_jobs SET lease_until=clock_timestamp()+interval '5 minutes'
 WHERE id=p_id AND lease_token=p_lease AND stage=p_expected AND lease_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
END $$;
CREATE FUNCTION public.mvp_release_deletion(p_id uuid,p_lease uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 UPDATE public.account_deletion_jobs SET lease_token=NULL,lease_until=NULL
 WHERE id=p_id AND lease_token=p_lease;
$$;
REVOKE ALL ON FUNCTION public.mvp_renew_deletion(uuid,uuid,text),public.mvp_release_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_renew_deletion(uuid,uuid,text),public.mvp_release_deletion(uuid,uuid) TO service_role;
COMMIT;
