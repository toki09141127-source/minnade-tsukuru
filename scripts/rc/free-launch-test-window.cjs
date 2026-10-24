/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');
function sql(expires,users,localPrincipal){
 assert.match(expires,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);assert.equal(users.length,4);
 for(const u of users){assert.match(u.id,/^[0-9a-f-]{36}$/);assert.match(u.email,/^v2free-[a-z]+-[0-9a-f-]{36}@example\.invalid$/)}
 if(localPrincipal)assert.match(localPrincipal,/^restore_admin_[a-f0-9]{16}$/);
 const admin="'postgres','supabase_admin'"+(localPrincipal?",'"+localPrincipal+"'":'');
 return `
CREATE TABLE mvp_release_stop.test_objects(id uuid PRIMARY KEY);
CREATE TABLE mvp_release_stop.test_users(id uuid PRIMARY KEY,email text NOT NULL);
REVOKE ALL ON mvp_release_stop.test_objects,mvp_release_stop.test_users FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO mvp_release_stop.test_users VALUES ${users.map(u=>"('"+u.id+"','"+u.email+"')").join(',')};
INSERT INTO mvp_release_stop.test_objects SELECT id FROM mvp_release_stop.test_users;
CREATE FUNCTION mvp_release_stop.test_row(r jsonb,s text,t text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF s='auth' AND t='users' THEN RETURN EXISTS(SELECT 1 FROM mvp_release_stop.test_users u WHERE u.id::text=r->>'id' AND u.email=r->>'email');END IF;
 IF s='storage' THEN RETURN t='objects' AND r->>'bucket_id'='room_uploads' AND EXISTS(SELECT 1 FROM mvp_release_stop.test_objects o WHERE r->>'name' LIKE 'rooms/'||o.id::text||'/%');END IF;
 IF s<>'public' THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM jsonb_each_text(r) v JOIN mvp_release_stop.test_objects o ON o.id::text=v.value WHERE v.key=ANY(ARRAY['id','user_id','actor_id','created_by','room_id','post_id','upload_id','job_id','account_id','owner_id','receipt_id','target_id','request_id','member_id']));
END $$;
REVOKE ALL ON FUNCTION mvp_release_stop.test_row(jsonb,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mvp_release_stop.test_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n jsonb; o jsonb; permitted boolean:=false;
BEGIN
 IF session_user IN (${admin}) THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF clock_timestamp()>='${expires}'::timestamptz THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MVP_RELEASE_MAINTENANCE';END IF;
 IF TG_OP<>'INSERT' THEN o:=to_jsonb(OLD);END IF;
 IF TG_OP<>'DELETE' THEN n:=to_jsonb(NEW);END IF;
 permitted:=CASE TG_OP WHEN 'INSERT' THEN mvp_release_stop.test_row(n,TG_TABLE_SCHEMA,TG_TABLE_NAME) WHEN 'DELETE' THEN mvp_release_stop.test_row(o,TG_TABLE_SCHEMA,TG_TABLE_NAME) ELSE mvp_release_stop.test_row(o,TG_TABLE_SCHEMA,TG_TABLE_NAME) AND mvp_release_stop.test_row(n,TG_TABLE_SCHEMA,TG_TABLE_NAME) AND (n->>'id') IS NOT DISTINCT FROM (o->>'id') END;
 IF permitted IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MVP_RELEASE_MAINTENANCE';END IF;
 IF TG_OP='INSERT' AND n->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN INSERT INTO mvp_release_stop.test_objects VALUES((n->>'id')::uuid) ON CONFLICT DO NOTHING;END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
REVOKE ALL ON FUNCTION mvp_release_stop.test_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t record;BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users') OR (n.nspname='storage' AND c.relname IN ('objects','buckets'))) LOOP
 EXECUTE format('DROP TRIGGER aaa_release_write_stop ON %I.%I',t.nspname,t.relname);
 EXECUTE format('CREATE TRIGGER aaa_release_write_stop BEFORE INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION mvp_release_stop.test_write()',t.nspname,t.relname);
 EXECUTE format('CREATE TRIGGER aaa_release_truncate_stop BEFORE TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION mvp_release_stop.reject_app_write()',t.nspname,t.relname);
 END LOOP;END $$;`;
}
module.exports={sql};
