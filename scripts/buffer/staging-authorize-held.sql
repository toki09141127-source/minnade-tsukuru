-- STAGING ONLY. One additional TEST for the new held-draft release path.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE event_id='completed_6208fe60-30e1-4982-8062-561045648a6b') THEN RAISE EXCEPTION 'HELD_TEST_ALREADY_EXISTS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.rooms WHERE id='6208fe60-30e1-4982-8062-561045648a6b' AND title='TEST Buffer recruitment') THEN RAISE EXCEPTION 'SYNTHETIC_TARGET_REQUIRED'; END IF;
END $$;
UPDATE public.rooms SET status='forced_publish',title='TEST Buffer held publication' WHERE id='6208fe60-30e1-4982-8062-561045648a6b';
UPDATE public.work_drafts SET published_at=now() WHERE room_id='6208fe60-30e1-4982-8062-561045648a6b';
UPDATE public.buffer_reviews SET excluded=false,pii_clear=true,reviewed_hash=public.buffer_source_hash(room_id),reviewed_at=now() WHERE room_id='6208fe60-30e1-4982-8062-561045648a6b';
UPDATE public.buffer_test_authorization SET room_id='6208fe60-30e1-4982-8062-561045648a6b',event_id='completed_6208fe60-30e1-4982-8062-561045648a6b',due_at=date_trunc('minute',now())+interval '12 minutes',enabled=true;
SELECT public.buffer_resume();
SELECT event_id,due_at AT TIME ZONE 'Asia/Tokyo' AS held_release_due_jst FROM public.buffer_test_authorization;
COMMIT;
