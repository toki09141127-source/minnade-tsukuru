/* eslint-disable @typescript-eslint/no-require-imports */
// Narrow, expiring acceptance window; existing Auth/RLS controls remain in force.
const assert=require('node:assert/strict');
const OWNER='820ed99a-286e-4f96-95da-a66988139415';
const EMAIL='minnadetsukuru.auth+v2prod20261024@gmail.com';
function sql(expires,localPrincipal){
 assert.match(expires,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
 if(localPrincipal)assert.match(localPrincipal,/^restore_admin_[a-f0-9]{16}$/);
 const admin="'postgres','supabase_admin'"+(localPrincipal?",'"+localPrincipal+"'":'');
 return `CREATE OR REPLACE FUNCTION mvp_release_stop.acceptance_auth_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE allowed boolean;
BEGIN
 IF session_user IN (${admin}) THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF clock_timestamp()>='${expires}'::timestamptz OR TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MVP_RELEASE_MAINTENANCE';END IF;
 IF TG_OP='UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MVP_RELEASE_MAINTENANCE';END IF;
 IF TG_TABLE_SCHEMA='auth' AND TG_TABLE_NAME='users' THEN
  allowed:=NEW.email='${EMAIL}' OR (TG_OP='UPDATE' AND NEW.id='${OWNER}'::uuid);
  IF TG_OP='UPDATE' AND NEW.email IS DISTINCT FROM OLD.email THEN allowed:=false;END IF;
 ELSIF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME IN ('profiles','public_profiles') THEN
  SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=NEW.id AND (u.id='${OWNER}'::uuid OR u.email='${EMAIL}')) INTO allowed;
 ELSE allowed:=false;
 END IF;
 IF allowed IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MVP_RELEASE_MAINTENANCE';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mvp_release_stop.acceptance_auth_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['auth.users','public.profiles','public.public_profiles'] LOOP
 EXECUTE 'DROP TRIGGER IF EXISTS aaa_release_write_stop ON '||t;
 EXECUTE 'DROP TRIGGER IF EXISTS aaa_release_truncate_stop ON '||t;
 EXECUTE 'CREATE TRIGGER aaa_release_write_stop BEFORE INSERT OR UPDATE OR DELETE ON '||t||' FOR EACH ROW EXECUTE FUNCTION mvp_release_stop.acceptance_auth_write()';
 EXECUTE 'CREATE TRIGGER aaa_release_truncate_stop BEFORE TRUNCATE ON '||t||' FOR EACH STATEMENT EXECUTE FUNCTION mvp_release_stop.reject_app_write()';
END LOOP;END $$;`;
}
module.exports={sql,OWNER,EMAIL};
