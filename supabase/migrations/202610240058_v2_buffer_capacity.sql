-- RC additive compatibility fix. Existing applied Buffer SQL remains immutable.
BEGIN;
CREATE OR REPLACE FUNCTION public.buffer_candidates() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH eligible AS (
 SELECT r.*, v.reviewed_at, d.published_at,
 greatest(0,CASE WHEN r.v2_enabled THEN r.capacity-(SELECT count(*) FROM public.room_members m WHERE m.room_id=r.id AND m.left_at IS NULL) ELSE 45-(SELECT count(*) FROM public.room_members m WHERE m.room_id=r.id AND m.role='supporter' AND m.left_at IS NULL) END)::int seats
 FROM public.rooms r JOIN public.buffer_reviews v ON v.room_id=r.id
 LEFT JOIN public.work_drafts d ON d.room_id=r.id
 WHERE r.is_hidden=false AND r.deleted_at IS NULL AND r.is_adult=false
 AND v.excluded=false AND v.pii_clear=true AND v.reviewed_at IS NOT NULL
 AND v.reviewed_hash=public.buffer_source_hash(r.id)
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs j WHERE j.actor_id=r.created_by)
 AND NOT EXISTS(SELECT 1 FROM public.report_intake i
   WHERE (i.target_type='room' AND i.target_id=r.id OR i.target_type='post' AND EXISTS(
     SELECT 1 FROM public.posts p WHERE p.id=i.target_id AND p.room_id=r.id))
   AND NOT EXISTS(SELECT 1 FROM public.report_resolutions x WHERE x.receipt_id=i.id))
 -- Legacy reports have no reliable resolution field: fail closed.
 AND NOT EXISTS(SELECT 1 FROM public.reports z WHERE z.target_room_id=r.id
   OR EXISTS(SELECT 1 FROM public.posts p WHERE p.id=z.target_post_id AND p.room_id=r.id))
 ), items AS (
 SELECT jsonb_build_object(
 'id',k.kind||'_'||e.id::text,'kind',k.kind,'targetId',e.id::text,
 'createdAt',coalesce(e.published_at,e.started_at),'expiresAt',CASE WHEN k.kind='completed' THEN e.published_at+interval '7 days' ELSE e.expires_at END,
 'snapshotAt',now(),'public',true,'hidden',false,'deleted',false,'pendingReport',false,
 'creatorExcluded',false,'reviewed',true,'piiClear',true,'title',e.title,
 'seatsAvailable',e.seats,'deadlineAt',e.expires_at) c
 FROM eligible e CROSS JOIN (VALUES ('completed'),('new_room'),('deadline')) k(kind)
 WHERE (k.kind='completed' AND e.status='forced_publish' AND e.published_at IS NOT NULL)
 OR (k.kind IN ('new_room','deadline') AND e.status='open' AND e.expires_at>now()
   AND (k.kind<>'new_room' OR e.started_at>now()-interval '2 days'))
 UNION ALL
 SELECT jsonb_build_object('id','weekly_'||to_char(now() AT TIME ZONE 'Asia/Tokyo','IYYY_IW'),
 'kind','weekly','targetId',to_char(now() AT TIME ZONE 'Asia/Tokyo','IYYY_IW'),
 'createdAt',date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo',
 'expiresAt',(date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo')+interval '7 days') AT TIME ZONE 'Asia/Tokyo',
 'snapshotAt',now(),'public',true,'hidden',false,'deleted',false,'pendingReport',false,
 'creatorExcluded',false,'reviewed',true,'piiClear',true,'title','公開許可済みルームの週次まとめ',
 'weeklyCounts',jsonb_build_object(
   'rooms',count(*) FILTER(WHERE started_at>=date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo'),
   'works',count(*) FILTER(WHERE published_at>=date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo'),
   'participants',(SELECT count(DISTINCT m.user_id) FROM public.room_members m JOIN eligible e ON e.id=m.room_id
     WHERE m.left_at IS NULL AND m.joined_at>=date_trunc('week',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo')))
 FROM eligible WHERE status IN ('open','forced_publish') HAVING count(*)>0
 ) SELECT coalesce(jsonb_agg(c),'[]'::jsonb) FROM items
$$;

REVOKE ALL ON FUNCTION public.buffer_candidates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buffer_candidates() TO service_role;
COMMIT;
