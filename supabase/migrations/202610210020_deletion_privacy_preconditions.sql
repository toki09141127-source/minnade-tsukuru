-- Additive acceptance candidate. No Auth or Storage deletion is authorized by this function.
BEGIN;
ALTER FUNCTION public.mvp_request_deletion(uuid,text,text) RENAME TO mvp_request_deletion_before_privacy;
REVOKE ALL ON FUNCTION public.mvp_request_deletion_before_privacy(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_request_deletion(p_actor uuid,p_attribution text,p_policy text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result uuid;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF p_actor IS NULL OR p_attribution IS DISTINCT FROM 'anonymous'
 OR p_policy IS DISTINCT FROM 'withdrawal-draft-2026-10-21' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF auth.uid() IS NOT NULL AND auth.uid()<>p_actor THEN RAISE EXCEPTION 'ACTOR_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN
  RETURN public.mvp_request_deletion_before_privacy(p_actor,p_attribution,p_policy);
 END IF;
 PERFORM 1 FROM auth.users WHERE id=p_actor FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND'; END IF;
 -- Deleted rooms remain historical references; hidden but live rooms still block.
 IF EXISTS(SELECT 1 FROM public.rooms WHERE created_by=p_actor AND deleted_at IS NULL
   AND status IS DISTINCT FROM 'forced_publish') THEN RAISE EXCEPTION 'UNPUBLISHED_CREATOR_ROOMS'; END IF;
 UPDATE public.profiles SET bio=NULL,x_url=NULL,youtube_url=NULL,instagram_url=NULL,
  tiktok_url=NULL,website_url=NULL,deleted_at=clock_timestamp() WHERE id=p_actor;
 UPDATE public.public_profiles SET bio=NULL,avatar_url=NULL,links=NULL WHERE id=p_actor;
 result:=public.mvp_request_deletion_before_privacy(p_actor,p_attribution,p_policy);
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND
  (bio IS NOT NULL OR x_url IS NOT NULL OR youtube_url IS NOT NULL OR instagram_url IS NOT NULL
   OR tiktok_url IS NOT NULL OR website_url IS NOT NULL OR deleted_at IS NULL))
 OR EXISTS(SELECT 1 FROM public.public_profiles WHERE id=p_actor AND
  (bio IS NOT NULL OR avatar_url IS NOT NULL OR links IS NOT NULL)) THEN
  RAISE EXCEPTION 'PROFILE_CLEANUP_TRIGGER_CONFLICT';
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mvp_request_deletion(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_request_deletion(uuid,text,text) TO service_role;
COMMIT;

