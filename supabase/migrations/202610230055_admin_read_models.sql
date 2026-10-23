-- V2.5 bounded management projections. Never returns Auth records, payment identifiers or AI prompts.
BEGIN;
CREATE FUNCTION public.v25_admin_read(p_section text,p_query text DEFAULT '',p_filters jsonb DEFAULT '{}',p_sort text DEFAULT 'newest',p_offset integer DEFAULT 0,p_days integer DEFAULT 7,p_target uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE role_name text; items jsonb:='[]'; details jsonb; overview jsonb; since_time timestamptz; q text; code text;
BEGIN
 IF NOT mvp_private.v25_rate(false) THEN PERFORM mvp_private.v25_security('rate_limited',auth.uid());RETURN jsonb_build_object('error',CASE WHEN auth.uid() IS NULL THEN 'ADMIN_FORBIDDEN' ELSE 'ADMIN_RATE_LIMITED' END);END IF;
 BEGIN
  role_name:=mvp_private.v25_role(false);
  IF role_name IS NULL THEN RAISE EXCEPTION 'ADMIN_FORBIDDEN';END IF;
  IF p_section IS NULL OR p_section NOT IN ('overview','reports','users','rooms','works','posts','ai','billing','system','audit','staff') OR p_query IS NULL OR length(p_query)>100 OR p_filters IS NULL OR jsonb_typeof(p_filters)<>'object' OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 OR p_days IS NULL OR p_days NOT IN (1,7,30) OR p_sort IS NULL OR p_sort NOT IN ('newest','oldest','priority','reports') THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
  IF p_section IN ('system','staff') AND role_name<>'owner' THEN RAISE EXCEPTION 'OWNER_REQUIRED';END IF;
  since_time:=CASE WHEN p_days=1 THEN date_trunc('day',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo' ELSE now()-make_interval(days=>p_days) END;
  q:='%'||replace(replace(replace(btrim(p_query),'\','\\'),'%','\%'),'_','\_')||'%';
  IF p_section='overview' THEN
   overview:=jsonb_build_object(
    'activeRooms',(SELECT count(*) FROM public.rooms WHERE status='open' AND deleted_at IS NULL AND NOT is_hidden),
    'publishedWorks',(SELECT count(*) FROM public.rooms WHERE status='forced_publish' AND deleted_at IS NULL AND NOT is_hidden),
    'activeUsers',(SELECT count(*) FROM public.profiles p WHERE deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p.id) AND NOT EXISTS(SELECT 1 FROM public.admin_suspensions WHERE user_id=p.id AND suspended)),
    'newUsers',(SELECT count(*) FROM public.profiles WHERE created_at>=since_time),
    'openReports',(SELECT count(*) FROM public.report_intake i LEFT JOIN public.admin_report_reviews r ON r.receipt_id=i.id LEFT JOIN public.report_resolutions old ON old.receipt_id=i.id WHERE coalesce(r.status,CASE WHEN old.receipt_id IS NULL THEN 'open' ELSE 'resolved' END) IN ('open','reviewing')),
    'suspendedUsers',(SELECT count(*) FROM public.admin_suspensions WHERE suspended),
    'hiddenWorks',(SELECT count(*) FROM public.rooms WHERE status='forced_publish' AND is_hidden AND deleted_at IS NULL),
    'aiFailures',(SELECT count(*) FROM public.room_ai_tasks WHERE status IN ('failed','stuck') AND created_at>=since_time),
    'billingPastDue',(SELECT count(*) FROM public.billing_accounts WHERE status='past_due' AND NOT deleting),
    'billingGrace',(SELECT count(*) FROM public.billing_accounts WHERE status='past_due' AND grace_until>now() AND NOT deleting),
    'deletionQueue',(SELECT count(*) FROM public.account_deletion_jobs WHERE stage<>'completed'));
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (SELECT id,action,target_type,actor_role,created_at FROM public.admin_audit WHERE role_name='owner' OR action IN ('hide','suspend','report') ORDER BY id DESC LIMIT 10) x;
   details:=jsonb_build_object('metrics',overview,'flags',mvp_private.v25_flags(),'recent',items,'days',p_days,'activeUserDefinition','non-departing, non-suspended accounts');items:='[]';
  ELSIF p_section='reports' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (
    SELECT i.id,i.target_type,i.target_id,i.reporter_user_id,coalesce(r.status,CASE WHEN old.receipt_id IS NULL THEN 'open' ELSE 'resolved' END) status,
     coalesce(r.category,CASE WHEN i.reason~*'(privacy|PII|個人情報)' THEN 'privacy' WHEN i.reason~*'(copyright|著作権)' THEN 'copyright' ELSE 'other' END) category,
     coalesce(r.priority,CASE WHEN i.reason~*'(privacy|PII|個人情報)' THEN 1 ELSE 2 END) priority,i.created_at,coalesce(v.version,0) version,
     CASE WHEN i.target_type='room' THEN (SELECT is_hidden FROM public.rooms WHERE id=i.target_id) ELSE (SELECT is_hidden FROM public.posts WHERE id=i.target_id) END hidden
    FROM public.report_intake i LEFT JOIN public.admin_report_reviews r ON r.receipt_id=i.id LEFT JOIN public.report_resolutions old ON old.receipt_id=i.id LEFT JOIN public.admin_subjects v ON v.kind='report' AND v.target_id=i.id
    WHERE (p_target IS NULL OR i.id=p_target) AND (p_filters->>'status' IS NULL OR coalesce(r.status,CASE WHEN old.receipt_id IS NULL THEN 'open' ELSE 'resolved' END)=p_filters->>'status') AND (i.id::text ILIKE q OR i.target_id::text ILIKE q)
    ORDER BY CASE WHEN p_sort='priority' THEN coalesce(r.priority,CASE WHEN i.reason~*'(privacy|PII|個人情報)' THEN 1 ELSE 2 END) END,CASE WHEN p_sort='oldest' THEN i.created_at END ASC,i.created_at DESC,i.id DESC LIMIT 26 OFFSET p_offset
   ) x;
   IF p_target IS NOT NULL THEN SELECT jsonb_build_object('reason',i.reason,'processingState',i.state,'failureCode',i.failure_code,'notes',coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM (SELECT a.actor_id,a.action,a.reason,a.created_at,t.note FROM public.admin_audit a JOIN public.admin_notes t ON t.request_id=a.request_id WHERE a.target_type='report' AND a.target_id=i.id::text ORDER BY a.id DESC LIMIT 20) n),'[]')) INTO details FROM public.report_intake i WHERE id=p_target;END IF;
  ELSIF p_section='users' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (
    SELECT p.id,p.username,p.created_at,p.deleted_at IS NOT NULL deleted,coalesce(s.suspended,false) suspended,coalesce(v.version,0) version,coalesce(mvp_private.v24_plan(b),'free') plan,
     (SELECT count(*) FROM public.rooms WHERE created_by=p.id AND status='open' AND deleted_at IS NULL) rooms,
     (SELECT count(*) FROM public.rooms WHERE created_by=p.id AND status='forced_publish' AND deleted_at IS NULL) works,
     (SELECT count(*) FROM public.report_intake i WHERE i.target_type='room' AND EXISTS(SELECT 1 FROM public.rooms WHERE id=i.target_id AND created_by=p.id) OR i.target_type='post' AND EXISTS(SELECT 1 FROM public.posts WHERE id=i.target_id AND user_id=p.id)) reports,
     EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p.id) departing,
     (SELECT role FROM public.admin_users WHERE user_id=p.id AND active) staff_role
    FROM public.profiles p LEFT JOIN public.admin_suspensions s ON s.user_id=p.id LEFT JOIN public.admin_subjects v ON v.kind='user' AND v.target_id=p.id LEFT JOIN public.billing_accounts b ON b.owner_id=p.id
    WHERE (p_target IS NULL OR p.id=p_target) AND (p.username ILIKE q OR p.id::text ILIKE q) AND (p_filters->>'status' IS NULL OR p_filters->>'status'='suspended' AND coalesce(s.suspended,false) OR p_filters->>'status'='active' AND NOT coalesce(s.suspended,false) AND p.deleted_at IS NULL)
    ORDER BY CASE WHEN p_sort='oldest' THEN p.created_at END ASC,p.created_at DESC,p.id DESC LIMIT 26 OFFSET p_offset
   ) x;
   IF p_target IS NOT NULL THEN
    details:=jsonb_build_object('rooms',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,title,status,is_hidden FROM public.rooms WHERE created_by=p_target ORDER BY created_at DESC LIMIT 20) x),'[]'),
    'deletion',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,stage,updated_at FROM public.account_deletion_jobs WHERE actor_id=p_target LIMIT 5) x),'[]'),
    'history',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT action,reason,actor_id,created_at FROM public.admin_audit WHERE target_type='user' AND target_id=p_target::text ORDER BY id DESC LIMIT 20) x),'[]'));
   END IF;
  ELSIF p_section IN ('rooms','works') THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (
    SELECT r.id,coalesce(w.title,r.title) title,r.created_by creator_id,p.username creator,r.status,r.capacity,r.expires_at,r.ai_level,r.genre,r.is_hidden hidden,r.created_at,w.published_at,r.like_count likes,coalesce(w.contains_ai_assistance,false) ai_assistance,coalesce(v.version,0) version,
     (SELECT count(*) FROM public.room_members WHERE room_id=r.id AND left_at IS NULL) members,(SELECT count(*) FROM public.report_intake WHERE target_type='room' AND target_id=r.id) reports,
     coalesce(c.joins,true) joins,coalesce(c.posts,true) posts,coalesce(c.uploads,true) uploads
    FROM public.rooms r LEFT JOIN public.v2_work_snapshots w ON w.room_id=r.id LEFT JOIN public.profiles p ON p.id=r.created_by LEFT JOIN public.admin_subjects v ON v.kind='room' AND v.target_id=r.id LEFT JOIN public.admin_room_controls c ON c.room_id=r.id
    WHERE r.deleted_at IS NULL AND (p_section<>'works' OR r.status='forced_publish') AND (p_target IS NULL OR r.id=p_target) AND (r.title ILIKE q OR r.id::text ILIKE q) AND (p_filters->>'status' IS NULL OR r.status=p_filters->>'status' OR p_filters->>'status'='hidden' AND r.is_hidden)
    ORDER BY CASE WHEN p_sort='reports' THEN (SELECT count(*) FROM public.report_intake WHERE target_type='room' AND target_id=r.id) END DESC,CASE WHEN p_sort='oldest' THEN r.created_at END ASC,r.created_at DESC,r.id DESC LIMIT 26 OFFSET p_offset
   ) x;
   IF p_target IS NOT NULL THEN details:=jsonb_build_object(
    'members',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT user_id,username,role,left_at FROM public.room_members WHERE room_id=p_target ORDER BY user_id LIMIT 50) x),'[]'),
    'posts',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,username,created_at,is_hidden FROM public.posts WHERE room_id=p_target AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 30) x),'[]'),
    'highlightCount',(SELECT count(*) FROM public.posts WHERE room_id=p_target AND is_marked AND deleted_at IS NULL),'logCount',(SELECT count(*) FROM public.posts WHERE room_id=p_target AND deleted_at IS NULL),
    'snapshot',(SELECT jsonb_build_object('title',title,'blocks',blocks,'incomplete',incomplete,'publishedAt',published_at,'sourceVersion',source_version) FROM public.v2_work_snapshots WHERE room_id=p_target),
    'aiHistory',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,kind,created_at,hidden_at FROM public.room_ai_outputs WHERE room_id=p_target ORDER BY created_at DESC LIMIT 20) x),'[]'));END IF;
  ELSIF p_section='posts' THEN
   IF p_target IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (SELECT p.id,p.room_id,p.username,p.created_at,p.is_hidden hidden,coalesce(v.version,0) version FROM public.posts p LEFT JOIN public.admin_subjects v ON v.kind='post' AND v.target_id=p.id WHERE p.id=p_target AND p.deleted_at IS NULL) x;
   SELECT jsonb_build_object('content',content,'attachmentType',attachment_type,'publicExcluded',excluded_from_public_log) INTO details FROM public.posts WHERE id=p_target AND deleted_at IS NULL;
  ELSIF p_section='ai' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (
    SELECT t.id,t.room_id,r.title,t.status,t.actor_type,t.trigger_type,t.kind,t.model_tier,t.created_at,t.finished_at,t.attempts,t.error_code,t.input_tokens,t.output_tokens,t.credit_cost,t.credit_state
    FROM public.room_ai_tasks t JOIN public.rooms r ON r.id=t.room_id WHERE (p_target IS NULL OR t.room_id=p_target) AND (p_filters->>'status' IS NULL OR t.status=p_filters->>'status') AND (r.title ILIKE q OR t.id::text ILIKE q)
    ORDER BY CASE WHEN p_sort='oldest' THEN t.created_at END ASC,t.created_at DESC,t.id DESC LIMIT 26 OFFSET p_offset
   ) x;
   details:=jsonb_build_object('enabled',(SELECT enabled FROM mvp_private.ai_control WHERE singleton),'knownIssue','Real OpenAI HTTP 429 remains unverified; no retry performed.',
    'enabledRooms',(SELECT count(*) FROM public.room_ai_creators),'forbiddenRooms',(SELECT count(*) FROM public.rooms WHERE ai_level='forbidden'),
    'manual',(SELECT count(*) FROM public.room_ai_tasks WHERE actor_type='human' AND created_at>=since_time),'system',(SELECT count(*) FROM public.room_ai_tasks WHERE actor_type='system' AND created_at>=since_time),
    'failures',(SELECT count(*) FROM public.room_ai_tasks WHERE status='failed' AND created_at>=since_time),'stuck',(SELECT count(*) FROM public.room_ai_tasks WHERE status='stuck' OR status='running' AND lease_until<now()),
    'rateLimited',(SELECT count(*) FROM public.room_ai_tasks WHERE error_code ILIKE '%rate%' AND created_at>=since_time));
  ELSIF p_section='billing' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (
    SELECT b.id,b.owner_id,p.username,b.provider,mvp_private.v24_plan(b) plan,b.status,b.cycle,b.period_end,b.grace_until,b.cancel_at_end,b.next_plan,b.next_cycle,b.deleting,
     coalesce((SELECT sum(consumed) FROM public.ai_credit_periods WHERE account_id=b.id AND period_start<=now() AND period_end>now()),0) consumed,
     coalesce((SELECT sum(reserved) FROM public.ai_credit_periods WHERE account_id=b.id AND period_start<=now() AND period_end>now()),0) reserved
    FROM public.billing_accounts b LEFT JOIN public.profiles p ON p.id=b.owner_id WHERE (p_target IS NULL OR b.owner_id=p_target) AND (p.username ILIKE q OR b.id::text ILIKE q) AND (p_filters->>'status' IS NULL OR b.status=p_filters->>'status')
    ORDER BY b.created_at DESC,b.id DESC LIMIT 26 OFFSET p_offset
   ) x;
   details:=jsonb_build_object('mode','test only / read only','plans',(SELECT jsonb_object_agg(plan,n) FROM (SELECT mvp_private.v24_plan(b) plan,count(*) n FROM public.billing_accounts b GROUP BY mvp_private.v24_plan(b)) x),
    'lastWebhook',(SELECT max(processed_at) FROM public.billing_events WHERE status='processed'), 'pendingWebhooks',(SELECT count(*) FROM public.billing_events WHERE status='pending'),
    'failedWebhooks',(SELECT count(*) FROM public.admin_security_events WHERE kind='webhook_failed' AND created_at>=since_time),'duplicates',(SELECT count(*) FROM public.admin_security_events WHERE kind='webhook_duplicate' AND created_at>=since_time),
    'stale',(SELECT count(*) FROM public.admin_security_events WHERE kind='webhook_stale' AND created_at>=since_time),'unmapped',(SELECT count(*) FROM public.admin_security_events WHERE kind='webhook_unmapped' AND created_at>=since_time),'eventCounters','deduplicated per category/minute; collection starts with V2.5');
  ELSIF p_section='system' THEN
   details:=jsonb_build_object('flags',mvp_private.v25_flags(),'version',(SELECT version FROM mvp_private.admin_control WHERE singleton),'deletion',public.mvp_deletion_operations(),'buffer','Not connected in this staging scope',
    'security',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT kind,count(*) occurrences,max(created_at) latest FROM public.admin_security_events WHERE created_at>=since_time GROUP BY kind ORDER BY latest DESC) x),'[]'),
    'cron',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT kind,max(created_at) latest FROM public.admin_security_events WHERE kind LIKE 'cron_%' GROUP BY kind) x),'[]'));
  ELSIF p_section='staff' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (SELECT a.user_id id,p.username,a.role,a.active,a.version,a.created_at FROM public.admin_users a LEFT JOIN public.profiles p ON p.id=a.user_id WHERE (p.username ILIKE q OR a.user_id::text ILIKE q) ORDER BY a.created_at DESC LIMIT 26 OFFSET p_offset) x;
  ELSE
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO items FROM (
    SELECT a.id,a.request_id,a.actor_id,a.actor_role,a.action,a.target_type,a.target_id,a.before_state,a.after_state,a.reason,a.created_at,a.severity
    FROM public.admin_audit a WHERE (role_name='owner' OR a.action IN ('hide','suspend','report')) AND a.created_at>=since_time
     AND (p_query='' OR a.target_id ILIKE q OR a.actor_id::text ILIKE q) AND (p_filters->>'action' IS NULL OR a.action=p_filters->>'action') AND (p_filters->>'type' IS NULL OR a.target_type=p_filters->>'type') AND (p_filters->>'severity' IS NULL OR a.severity=p_filters->>'severity') AND (p_filters->>'actor' IS NULL OR a.actor_id::text=p_filters->>'actor')
    ORDER BY CASE WHEN p_sort='oldest' THEN a.created_at END ASC,a.created_at DESC,a.id DESC LIMIT 26 OFFSET p_offset
   ) x;
  END IF;
  RETURN jsonb_build_object('role',role_name,'section',p_section,'items',items,'detail',details,'offset',p_offset,'checkedAt',clock_timestamp());
 EXCEPTION WHEN OTHERS THEN
  code:=SQLERRM;IF code NOT IN ('ADMIN_FORBIDDEN','OWNER_REQUIRED','ADMIN_RATE_LIMITED','INVALID_INPUT') THEN code:='ADMIN_READ_FAILED';END IF;
 END;
 PERFORM mvp_private.v25_security(CASE WHEN code='ADMIN_RATE_LIMITED' THEN 'rate_limited' WHEN code IN ('ADMIN_FORBIDDEN','OWNER_REQUIRED') THEN 'admin_denied' ELSE 'admin_failed' END,auth.uid());
 RETURN jsonb_build_object('error',code);
END $$;
REVOKE ALL ON FUNCTION public.v25_admin_read(text,text,jsonb,text,integer,integer,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.v25_admin_read(text,text,jsonb,text,integer,integer,uuid) TO authenticated;
COMMIT;
