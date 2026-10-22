-- NOT EXECUTED: metadata only; no user rows or function source/constants.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
SELECT a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type_name,a.attnotnull
FROM pg_catalog.pg_attribute a WHERE a.attrelid=to_regclass('public.reports') AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum;
SELECT t.tgname,t.tgenabled,t.tgtype,t.tgnargs,p.oid AS function_oid,
 n.nspname AS function_schema,p.proname,p.prosecdef,
 md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_fingerprint
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE t.tgrelid=to_regclass('public.reports') AND NOT t.tgisinternal ORDER BY t.tgname;
ROLLBACK;
