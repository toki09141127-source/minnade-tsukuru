-- Temporary maintenance guard; rehearsal target: fwqucffxdmbdczspkcyr ONLY.
-- Not migration 001-028. Abort on lock contention; transaction is atomic.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='45s';
SELECT public.mvp_set_deletion_pause(true);
CREATE SCHEMA mvp_release_stop AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA mvp_release_stop FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mvp_release_stop.reject_app_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MVP_RELEASE_MAINTENANCE';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION mvp_release_stop.reject_app_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$
DECLARE t record;
BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p') AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users') OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))
 LOOP
  EXECUTE format('CREATE TRIGGER aaa_release_write_stop BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION mvp_release_stop.reject_app_write()',t.nspname,t.relname);
 END LOOP;
END $$;
SELECT count(*) AS guarded_tables FROM pg_trigger WHERE tgfoid='mvp_release_stop.reject_app_write()'::regprocedure;
COMMIT;
