-- Metadata only. No application function or user-table query.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SELECT n.nspname AS schema_name,c.relname,a.attname,
 pg_catalog.format_type(a.atttypid,a.atttypmod) AS type_name,a.attnotnull
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE a.attnum>0 AND NOT a.attisdropped AND (
 (n.nspname='public' AND c.relname IN ('profiles','public_profiles','posts','rooms','room_members','room_join_requests','attachment_uploads'))
 OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))
ORDER BY 1,2,a.attnum;
-- All inbound foreign keys, including schemas not previously audited.
SELECT con.conname,con.conrelid::regclass AS source_table,
 con.confrelid::regclass AS target_table,
 pg_catalog.pg_get_constraintdef(con.oid,true) AS definition
FROM pg_catalog.pg_constraint con
WHERE con.contype='f' AND con.confrelid IN (
 SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname='auth' AND c.relname='users')
 OR (n.nspname='public' AND c.relname IN ('profiles','public_profiles','posts','rooms','room_members','room_join_requests','attachment_uploads'))
 OR (n.nspname='storage' AND c.relname IN ('objects','buckets')))
ORDER BY con.conrelid::regclass::text,con.conname;
-- Trigger identity and function attributes only: no function body or constants,
-- because existing bodies may contain credentials. Review bodies separately after screening.
SELECT n.nspname,c.relname,t.tgname,t.tgenabled,
 t.tgisinternal,p.oid AS function_oid,pn.nspname AS function_schema,p.proname,p.prosecdef
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
WHERE (n.nspname IN ('public','storage')) OR (n.nspname='auth' AND c.relname='users')
ORDER BY 1,2,3;
ROLLBACK;
