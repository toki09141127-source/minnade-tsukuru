-- STAGING ONLY: one additional TEST authorized by attachment 3f05b307.
BEGIN;
DO $$
DECLARE actor uuid; r uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.rooms WHERE title='TEST Buffer final verification') THEN RAISE EXCEPTION 'FINAL_TEST_ALREADY_PREPARED'; END IF;
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE state IN ('unknown','sending','scheduled','succeeded')) THEN RAISE EXCEPTION 'UNRESOLVED_DELIVERY'; END IF;
 SELECT u.id INTO actor FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE u.raw_user_meta_data->>'synthetic'='true' AND p.deleted_at IS NULL
 AND p.terms_version='2026-10-22' AND p.adult_confirmed_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs j WHERE j.actor_id=u.id) ORDER BY u.created_at LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'TEST_ACTOR_REQUIRED'; END IF;
 r:=public.mvp_create_room(actor,'f9e0796a-7ae9-4ecf-b53a-10c9fa140005'::uuid,jsonb_build_object('title','TEST Buffer final verification','category','その他','work_type','novel','is_adult',false,'time_limit_hours',24,'enable_core_approval',false,'enable_core_invite',false,'ai_level','assist','concept','TEST staging only. Synthetic publication verification. No personal data.'));
 INSERT INTO public.work_drafts(room_id,blocks,published_at) VALUES(r,'[{"id":"test","kind":"text","text":"TEST only. No private content."}]'::jsonb,now());
 UPDATE public.rooms SET status='forced_publish' WHERE id=r;
 INSERT INTO public.buffer_reviews(room_id,excluded,reviewed_hash,pii_clear,reviewed_at) VALUES(r,false,public.buffer_source_hash(r),true,now());
 UPDATE public.buffer_test_authorization SET room_id=r,event_id='completed_'||r::text,due_at=date_trunc('minute',now())+interval '10 minutes',enabled=true WHERE singleton;
 PERFORM public.buffer_stop('MANUAL');
END $$;
SELECT event_id,due_at AT TIME ZONE 'Asia/Tokyo' AS due_jst,(SELECT enabled FROM public.buffer_control) AS automatic_enabled FROM public.buffer_test_authorization;
COMMIT;
