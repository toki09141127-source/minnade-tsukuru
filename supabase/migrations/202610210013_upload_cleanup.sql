-- LOCAL CANDIDATE: uploaded, expired and never-used objects only.
-- Retiring owners remain subject to the existing write fence; no bypass.
BEGIN;
ALTER TABLE public.attachment_uploads
 ADD COLUMN cleanup_token uuid,
 ADD COLUMN cleanup_until timestamptz,
 ADD COLUMN cleanup_attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN deleted_at timestamptz;
CREATE FUNCTION public.mvp_claim_upload_cleanup()
RETURNS TABLE(id uuid,bucket text,storage_path text,room_id uuid,cleanup_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE u public.attachment_uploads%ROWTYPE;
BEGIN
 SELECT * INTO u FROM public.attachment_uploads a
 WHERE a.used_at IS NULL AND a.post_id IS NULL AND a.room_id IS NOT NULL
 AND a.uploaded_at IS NOT NULL AND a.expires_at<clock_timestamp()
 AND (a.status='uploaded' OR (a.status='cleanup_pending' AND a.cleanup_until<clock_timestamp()))
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs j WHERE j.actor_id=a.user_id)
 ORDER BY a.expires_at,a.id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 -- Quarantine before external deletion: binding only accepts status=uploaded.
 UPDATE public.attachment_uploads a SET status='cleanup_pending',cleanup_token=gen_random_uuid(),
 cleanup_until=clock_timestamp()+interval '5 minutes',cleanup_attempts=a.cleanup_attempts+1
 WHERE a.id=u.id RETURNING a.* INTO u;
 RETURN QUERY SELECT u.id,u.bucket,u.storage_path,u.room_id,u.cleanup_token;
END $$;
CREATE FUNCTION public.mvp_finish_upload_cleanup(p_id uuid,p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.attachment_uploads SET status='deleted',deleted_at=clock_timestamp(),cleanup_until=NULL
 WHERE id=p_id AND status='cleanup_pending' AND cleanup_token=p_token
 AND cleanup_until>clock_timestamp() AND used_at IS NULL AND post_id IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLEANUP_LEASE_LOST'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_claim_upload_cleanup(),public.mvp_finish_upload_cleanup(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_claim_upload_cleanup(),public.mvp_finish_upload_cleanup(uuid,uuid) TO service_role;
COMMIT;
