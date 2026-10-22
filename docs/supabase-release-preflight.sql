-- Production preflight: catalog and aggregate connection metadata only.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT current_setting('transaction_read_only') AS read_only,
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'mvp_%') AS mvp_functions,
 to_regclass('public.attachment_uploads') IS NOT NULL AS ledger_exists,
 to_regclass('public.account_deletion_jobs') IS NOT NULL AS deletion_jobs_exists,
 to_regclass('mvp_private.deletion_control') IS NOT NULL AS pause_exists,
 to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_history_exists,
 (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) AS connections,
 (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active') AS active_connections,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('posts','rooms','room_members') AND cmd='SELECT' AND qual='true') AS unconditional_select_policies;
ROLLBACK;
