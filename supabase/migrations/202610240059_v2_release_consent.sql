-- Operator-approved Free V2 terms/privacy; no inferred consent or backfill.
BEGIN;
CREATE OR REPLACE FUNCTION public.mvp_accept_current_terms(p_terms text,p_privacy text,p_adult boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR p_adult IS DISTINCT FROM true OR p_terms IS DISTINCT FROM '2026-10-24'
 OR p_privacy IS DISTINCT FROM '2026-10-24' THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,4917));
 IF NOT public.mvp_current_account_active() THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
 UPDATE public.profiles SET terms_version=p_terms,privacy_version=p_privacy,
 terms_agreed_at=clock_timestamp(),privacy_agreed_at=clock_timestamp(),adult_confirmed_at=clock_timestamp() WHERE id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_REQUIRED'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_accept_current_terms(text,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mvp_accept_current_terms(text,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION mvp_private.require_current_consent(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND deleted_at IS NULL
 AND terms_version='2026-10-24' AND privacy_version='2026-10-24'
 AND terms_agreed_at IS NOT NULL AND privacy_agreed_at IS NOT NULL AND adult_confirmed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'CONSENT_REQUIRED'; END IF;
END $$;
REVOKE ALL ON FUNCTION mvp_private.require_current_consent(uuid) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
