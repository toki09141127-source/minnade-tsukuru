-- Review candidate only. Do not execute before user approval.
-- Metadata only: never SELECT from application tables or target views.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog;
SET LOCAL standard_conforming_strings = on;

WITH
targets AS (
  SELECT c.oid, c.relname, c.relkind, c.relowner,
         c.relrowsecurity, c.relforcerowsecurity, c.reloptions
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('posts','rooms','room_members',
      'rooms_with_counts','rooms_with_counts_v2','profiles_public','report_counts')
    AND c.relkind IN ('r','p','v','m')
),
policies AS (
  SELECT p.*, t.relname
  FROM pg_catalog.pg_policy p JOIN targets t ON t.oid = p.polrelid
  WHERE t.relname IN ('posts','rooms','room_members')
),
definitions AS (
  SELECT 'policy_using'::text AS kind, p.oid AS object_oid,
         p.relname AS target, pg_catalog.pg_get_expr(p.polqual,p.polrelid,false) AS body
  FROM policies p
  UNION ALL
  SELECT 'policy_check', p.oid, p.relname,
         pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)
  FROM policies p
  UNION ALL
  SELECT 'view', t.oid, t.relname, pg_catalog.pg_get_viewdef(t.oid,false)
  FROM targets t WHERE t.relkind IN ('v','m')
),
-- Fail closed for lexical forms not handled by this limited tokenizer.
gated AS (
  SELECT *, body IS NOT NULL
    AND pg_catalog.strpos(body,pg_catalog.chr(92)) = 0
    AND pg_catalog.strpos(body,'$') = 0
    AND pg_catalog.strpos(body,'"') = 0
    AND pg_catalog.strpos(body,'--') = 0
    AND pg_catalog.strpos(body,'/*') = 0
    AND pg_catalog.strpos(body,'*/') = 0 AS supported
  FROM definitions
),
safe_definitions AS (
  SELECT g.kind, g.object_oid, g.target,
    CASE WHEN g.body IS NULL THEN 'absent'
         WHEN NOT g.supported THEN 'withheld_unsupported_lexical_form'
         WHEN z.masked_count > 0 THEN 'masked_requires_review'
         ELSE 'allowlisted_tokens_only' END AS review_state,
    CASE WHEN g.supported THEN z.safe_text ELSE NULL END AS definition_redacted,
    CASE WHEN g.supported THEN z.masked_count ELSE NULL END AS masked_token_count
  FROM gated g
  LEFT JOIN LATERAL (
    SELECT pg_catalog.string_agg(x.safe_token,'' ORDER BY x.ord) AS safe_text,
           count(*) FILTER (WHERE x.masked) AS masked_count
    FROM (
      SELECT k.ord,
        CASE WHEN k.allowed THEN k.token ELSE '[REDACTED]' END AS safe_token,
        NOT k.allowed AS masked
      FROM (
        SELECT m.ord, (m.parts)[1] AS token,
          ((m.parts)[1] ~ '^[[:space:](),.;:=<>+*/%-]+$'
           OR pg_catalog.lower((m.parts)[1]) = ANY (ARRAY[
            'select','from','where','and','or','not','exists','in','is','null',
            'true','false','as','case','when','then','else','end','distinct',
            'join','left','right','inner','outer','full','cross','on','using',
            'group','by','having','order','asc','desc','nulls','first','last',
            'limit','offset','union','all','filter','over','partition',
            'any','array','coalesce','count','sum','max','min','bool_or','bool_and',
            'cast','text','boolean','uuid','integer','bigint','numeric',
            'timestamp','with','without','time','zone','public','auth','uid',
            'posts','rooms','room_members','profiles','public_profiles',
            'rooms_with_counts','rooms_with_counts_v2','profiles_public','report_counts',
            'r','p','rm','m','u','id','room_id','user_id','created_by','role',
            'left_at','joined_at','is_core','is_hidden','deleted_at','status',
            'post_type','title','work_type','type','category','is_adult','ai_level',
            'concept','created_at','updated_at','expires_at','ended_at',
            'time_limit_hours','like_count','member_count','username','content',
            'attachment_url','attachment_type','is_marked','marked_by','marked_at',
            'enable_core_approval','enable_core_invite','core_invite_code'
           ])
           OR (m.parts)[1] = ANY (ARRAY[
             '''forced_publish''','''open''','''closed''','''final''','''log''',
             '''creator''','''core''','''supporter'''
           ])) AS allowed
        FROM pg_catalog.regexp_matches(
          CASE WHEN g.supported THEN g.body ELSE '' END,
          $token$'(?:[^']|'')*'|[A-Za-z_][A-Za-z_0-9$]*|[0-9]+|.$token$,
          'gs') WITH ORDINALITY AS m(parts,ord)
      ) k
    ) x
  ) z ON true
),
sources AS (
  SELECT 'policy'::text AS source_kind, p.oid AS source_oid,
         'pg_catalog.pg_policy'::pg_catalog.regclass AS class_oid,
         p.oid AS catalog_oid
  FROM policies p
  UNION ALL
  SELECT 'view',t.oid,'pg_catalog.pg_rewrite'::pg_catalog.regclass,r.oid
  FROM targets t JOIN pg_catalog.pg_rewrite r ON r.ev_class=t.oid
  WHERE t.relkind IN ('v','m') AND r.rulename='_RETURN'
),
report AS (
  SELECT 'environment'::text AS section,
    pg_catalog.jsonb_build_object(
      'server_version_num',pg_catalog.current_setting('server_version_num'),
      'transaction_read_only',pg_catalog.current_setting('transaction_read_only'),
      'expected_target_count',7,'found_target_count',(SELECT count(*) FROM targets)
    ) AS item
  UNION ALL
  SELECT 'objects',pg_catalog.jsonb_build_object(
    'oid',t.oid,'name',t.relname,'kind',t.relkind,'owner_oid',t.relowner,
    'owner_bypassrls',r.rolbypassrls,'owner_superuser',r.rolsuper,
    'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,
    'security_invoker',
      COALESCE((SELECT o.option_value::boolean
       FROM pg_catalog.pg_options_to_table(t.reloptions) o
       WHERE o.option_name='security_invoker'),false),
    'security_barrier',
      COALESCE((SELECT o.option_value::boolean
       FROM pg_catalog.pg_options_to_table(t.reloptions) o
       WHERE o.option_name='security_barrier'),false)
  ) FROM targets t LEFT JOIN pg_catalog.pg_roles r ON r.oid=t.relowner
  UNION ALL
  SELECT 'policies',pg_catalog.jsonb_build_object(
    'oid',p.oid,'table',p.relname,'command',p.polcmd,
    'permissive',p.polpermissive,'roles',
       (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'oid',q.role_oid,'known_name',CASE WHEN q.role_oid=0 THEN 'PUBLIC'
             WHEN r.rolname IN ('anon','authenticated','service_role','postgres')
             THEN r.rolname::text ELSE NULL END) ORDER BY q.role_oid)
        FROM pg_catalog.unnest(p.polroles) q(role_oid)
        LEFT JOIN pg_catalog.pg_roles r ON r.oid=q.role_oid)
  ) FROM policies p
  UNION ALL
  SELECT 'definitions_redacted',pg_catalog.to_jsonb(s) FROM safe_definitions s
  UNION ALL
  SELECT 'direct_dependencies',pg_catalog.jsonb_build_object(
    'source_kind',s.source_kind,'source_oid',s.source_oid,
    'referenced_catalog_oid',d.refclassid,'referenced_oid',d.refobjid,
    'referenced_column_number',d.refobjsubid,'dependency_type',d.deptype,
    'known_target',t.relname
  )
  FROM sources s JOIN pg_catalog.pg_depend d
    ON d.classid=s.class_oid AND d.objid=s.catalog_oid
  LEFT JOIN targets t
    ON d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid=t.oid
  UNION ALL
  SELECT 'effective_select',pg_catalog.jsonb_build_object(
    'object_oid',t.oid,'object',t.relname,'role',r.rolname,
    'table_select',pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT'),
    'any_column_select',pg_catalog.has_any_column_privilege(r.oid,t.oid,'SELECT')
  ) FROM targets t CROSS JOIN pg_catalog.pg_roles r
  WHERE r.rolname IN ('anon','authenticated')
)
SELECT section,pg_catalog.jsonb_agg(item ORDER BY item::text) AS metadata
FROM report GROUP BY section ORDER BY section;
ROLLBACK;

