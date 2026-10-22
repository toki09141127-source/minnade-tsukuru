-- Remove only the temporary release guard; leave retirement DB pause true.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='45s';
DO $$
DECLARE t record;
BEGIN
 FOR t IN SELECT n.nspname,c.relname,g.tgname FROM pg_trigger g JOIN pg_class c ON c.oid=g.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE g.tgfoid='mvp_release_stop.reject_app_write()'::regprocedure
 LOOP EXECUTE format('DROP TRIGGER %I ON %I.%I',t.tgname,t.nspname,t.relname); END LOOP;
END $$;
DROP FUNCTION mvp_release_stop.reject_app_write();
DROP SCHEMA mvp_release_stop;
SELECT public.mvp_deletion_is_paused() AS deletion_still_paused;
COMMIT;
