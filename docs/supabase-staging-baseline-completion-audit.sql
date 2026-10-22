-- PROPOSED ONLY. User approval required for production execution.
-- Catalog metadata only. No auth/user rows, sequence current values, app calls or Storage objects.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'auth_app_triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled))
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
 WHERE n.nspname='auth' AND pn.nspname='public' AND NOT t.tgisinternal),
 'sequences',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'type',format_type(s.seqtypid,NULL),'start',s.seqstart,'increment',s.seqincrement,'min',s.seqmin,'max',s.seqmax,'cache',s.seqcache,'cycle',s.seqcycle))
 FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'sequence_ownership',(SELECT jsonb_agg(jsonb_build_object('sequence',seq.relname,'table',tab.relname,'column',a.attname,'dependency',d.deptype))
 FROM pg_class seq JOIN pg_namespace n ON n.oid=seq.relnamespace JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=seq.oid AND d.deptype IN ('a','i')
 JOIN pg_class tab ON tab.oid=d.refobjid JOIN pg_attribute a ON a.attrelid=tab.oid AND a.attnum=d.refobjsubid WHERE n.nspname='public' AND seq.relkind='S'),
 'table_settings',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl))
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','S')),
 'policies',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'roles',roles,'command',cmd,'permissive',permissive,'using',qual,'check',with_check))
 FROM pg_policies WHERE schemaname IN ('public','storage'))
) AS baseline_completion_metadata;
ROLLBACK;
