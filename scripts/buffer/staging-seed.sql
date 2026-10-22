-- STAGING ONLY. Run after matching project fwqucffxdmbdczspkcyr.
BEGIN;
DO $$
DECLARE actor uuid; r uuid; item record;
BEGIN
 SELECT u.id INTO actor FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE u.raw_user_meta_data->>'synthetic'='true' AND p.deleted_at IS NULL
 AND p.terms_version='2026-10-22' AND p.adult_confirmed_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs j WHERE j.actor_id=u.id)
 ORDER BY u.created_at LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'TEST_ACTOR_REQUIRED'; END IF;
 FOR item IN SELECT * FROM (VALUES
 ('f9e0796a-7ae9-4ecf-b53a-10c9fa140001'::uuid,'TEST Buffer X canary',true,false),
 ('f9e0796a-7ae9-4ecf-b53a-10c9fa140002'::uuid,'TEST Buffer DB integration',true,false),
 ('f9e0796a-7ae9-4ecf-b53a-10c9fa140003'::uuid,'TEST Buffer excluded',true,true),
 ('f9e0796a-7ae9-4ecf-b53a-10c9fa140004'::uuid,'TEST Buffer recruitment',false,false)
 ) v(request,title,completed,excluded) LOOP
 r:=public.mvp_create_room(actor,item.request,jsonb_build_object('title',item.title,'category','その他','work_type','novel',
 'is_adult',false,'time_limit_hours',24,'enable_core_approval',false,'enable_core_invite',false,'ai_level','assist',
 'concept','TEST staging only. No private content. Not a recruitment announcement.'));
 INSERT INTO public.work_drafts(room_id,blocks,published_at)
 VALUES(r,'[{"id":"test","kind":"text","text":"TEST staging only. Synthetic integration fixture. No personal data."}]'::jsonb,
 CASE WHEN item.completed THEN now() END) ON CONFLICT DO NOTHING;
 IF item.completed THEN UPDATE public.rooms SET status='forced_publish' WHERE id=r; END IF;
 INSERT INTO public.buffer_reviews(room_id,excluded,reviewed_hash,pii_clear,reviewed_at)
 VALUES(r,item.excluded,public.buffer_source_hash(r),true,now()) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
SELECT id AS room_id,title FROM public.rooms WHERE title IN ('TEST Buffer X canary','TEST Buffer DB integration','TEST Buffer excluded','TEST Buffer recruitment') ORDER BY title;
COMMIT;
