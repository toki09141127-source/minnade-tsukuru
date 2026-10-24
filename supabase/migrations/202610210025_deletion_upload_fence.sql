-- 025: refuse delayed object registration after withdrawal/quarantine. Requires 023-024.
-- No SQL deletion of managed Storage objects.
BEGIN;
CREATE FUNCTION mvp_private.guard_upload_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE u public.attachment_uploads%ROWTYPE;
BEGIN
 IF NEW.bucket_id<>'room_uploads' THEN RETURN NEW; END IF;
 SELECT * INTO u FROM public.attachment_uploads WHERE bucket=NEW.bucket_id AND storage_path=NEW.name;
 IF NOT FOUND THEN RETURN NEW; END IF; -- Existing legacy namespaces are not claimed as ledger-owned.
 IF u.user_id IS NULL THEN RAISE EXCEPTION 'UPLOAD_OWNER_UNAVAILABLE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u.user_id::text,4917));
 SELECT * INTO u FROM public.attachment_uploads WHERE id=u.id FOR SHARE;
 IF u.status<>'reserved' OR EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=u.user_id)
 OR EXISTS(SELECT 1 FROM mvp_private.actors WHERE id=u.user_id AND retired)
 THEN RAISE EXCEPTION 'UPLOAD_OWNER_UNAVAILABLE'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mvp_private.guard_upload_registration() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mvp_upload_registration_guard BEFORE INSERT ON storage.objects
FOR EACH ROW EXECUTE FUNCTION mvp_private.guard_upload_registration();
CREATE FUNCTION mvp_private.guard_auth_deletion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs%ROWTYPE; receipt jsonb;
BEGIN
 SELECT * INTO j FROM public.account_deletion_jobs WHERE actor_id=OLD.id FOR UPDATE;
 IF NOT FOUND THEN RETURN OLD; END IF;
 IF j.stage<>'auth_unknown' OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'AUTH_DELETION_NOT_PREPARED'; END IF;
 receipt:=public.mvp_verify_deletion(j.id,j.lease_token);
 IF receipt->'storageReadyForAuthDeletion' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'AUTH_DELETION_NOT_PREPARED'; END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION mvp_private.guard_auth_deletion() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mvp_final_auth_deletion_guard BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION mvp_private.guard_auth_deletion();
COMMIT;

