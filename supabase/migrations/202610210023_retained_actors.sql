-- 023: Auth-independent per-person retention identities. Requires 001-022.
-- Staging first. Does not execute Auth or Storage deletion.
BEGIN;
CREATE SCHEMA mvp_private;
REVOKE ALL ON SCHEMA mvp_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE mvp_private.actors(id uuid PRIMARY KEY,retired boolean NOT NULL DEFAULT false);
INSERT INTO mvp_private.actors(id) SELECT id FROM auth.users;
CREATE FUNCTION mvp_private.register_actor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO mvp_private.actors(id) VALUES(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mvp_private.register_actor() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aa_mvp_register_actor AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION mvp_private.register_actor();
-- Replace ONLY audited single-column Auth references. Profiles remain real Auth-owned rows.
DO $$ DECLARE f record; col text; BEGIN
 FOR f IN SELECT c.*,cl.relname FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
 JOIN pg_namespace n ON n.oid=cl.relnamespace
 WHERE c.contype='f' AND c.confrelid='auth.users'::regclass AND n.nspname='public'
 AND cl.relname NOT IN ('profiles','public_profiles') LOOP
 IF cardinality(f.conkey)<>1 OR f.relname<>ALL(ARRAY['decisions','event_members','events','novel_drafts',
 'post_likes','posts','room_join_requests','room_members','room_pre_archive_notes','rooms','attachment_uploads'])
 THEN RAISE EXCEPTION 'UNREVIEWED_AUTH_FK'; END IF;
 SELECT attname INTO col FROM pg_attribute WHERE attrelid=f.conrelid AND attnum=f.conkey[1];
 IF col<>ALL(ARRAY['decided_by','user_id','created_by','updated_by','marked_by','approved_by','author_id']) THEN RAISE EXCEPTION 'UNREVIEWED_AUTH_COLUMN'; END IF;
 EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',f.relname,f.conname);
 EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES mvp_private.actors(id) ON DELETE RESTRICT',f.relname,f.conname,col);
 END LOOP;
END $$;
CREATE TABLE mvp_private.deletion_prepared(
 job_id uuid PRIMARY KEY REFERENCES public.account_deletion_jobs(id),
 anonymous_id uuid NOT NULL UNIQUE REFERENCES mvp_private.actors(id),
 prepared_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE mvp_private.deletion_capabilities(
 backend_pid integer NOT NULL,transaction_id bigint NOT NULL,table_name text NOT NULL,
 operation text NOT NULL CHECK(operation IN ('UPDATE','DELETE')),
 before_row jsonb NOT NULL,after_row jsonb,
 PRIMARY KEY(backend_pid,transaction_id)
);
CREATE TABLE mvp_private.deletion_uploads(
 job_id uuid NOT NULL REFERENCES public.account_deletion_jobs(id),upload_id uuid NOT NULL UNIQUE,
 bucket text NOT NULL CHECK(bucket='room_uploads'),storage_path text NOT NULL,
 deleted boolean NOT NULL DEFAULT false,PRIMARY KEY(job_id,upload_id)
);
ALTER TABLE mvp_private.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_private.deletion_prepared ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_private.deletion_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_private.deletion_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA mvp_private FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.mvp_request_deletion(uuid,text,text) RENAME TO mvp_request_deletion_before_core_guard;
REVOKE ALL ON FUNCTION public.mvp_request_deletion_before_core_guard(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_request_deletion(p_actor uuid,p_attribution text,p_policy text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_actor IS NULL OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'ACTOR_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.room_members m JOIN public.rooms r ON r.id=m.room_id
 WHERE m.user_id=p_actor AND m.left_at IS NULL AND m.role='core'
 AND r.deleted_at IS NULL AND r.status IS DISTINCT FROM 'forced_publish') THEN RAISE EXCEPTION 'ACTIVE_CORE_ROOMS'; END IF;
 RETURN public.mvp_request_deletion_before_core_guard(p_actor,p_attribution,p_policy);
END $$;
REVOKE ALL ON FUNCTION public.mvp_request_deletion(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_request_deletion(uuid,text,text) TO service_role;
COMMIT;

