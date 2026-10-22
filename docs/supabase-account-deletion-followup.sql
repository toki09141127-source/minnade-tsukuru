-- NOT EXECUTED. Further metadata for newly discovered retention dependencies.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
SELECT n.nspname,c.relname,a.attname,
 pg_catalog.format_type(a.atttypid,a.atttypmod) AS type_name,a.attnotnull
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('events','event_members','novel_drafts','decisions','room_pre_archive_notes')
 AND a.attnum>0 AND NOT a.attisdropped
ORDER BY 1,2,a.attnum;
SELECT con.conname,con.conrelid::regclass AS source_table,con.confrelid::regclass AS target_table,
 pg_catalog.pg_get_constraintdef(con.oid,true) AS definition
FROM pg_catalog.pg_constraint con
WHERE con.contype='f' AND con.confrelid IN (
 SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('events','event_members','novel_drafts','decisions','room_pre_archive_notes'))
ORDER BY con.conrelid::regclass::text,con.conname;
ROLLBACK;
