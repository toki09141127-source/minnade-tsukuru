-- STAGING ONLY: separately authorized single cancellation canary.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE event_id='completed_4cb5feb0-231e-42a0-bfe9-95621d3ac2c5') THEN RAISE EXCEPTION 'CANCEL_CANARY_ALREADY_RESERVED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.rooms WHERE id='4cb5feb0-231e-42a0-bfe9-95621d3ac2c5' AND title='TEST Buffer excluded') THEN RAISE EXCEPTION 'TEST_TARGET_REQUIRED'; END IF;
END $$;
UPDATE public.buffer_reviews SET excluded=false,reviewed_hash=public.buffer_source_hash(room_id),pii_clear=true,reviewed_at=now() WHERE room_id='4cb5feb0-231e-42a0-bfe9-95621d3ac2c5';
UPDATE public.buffer_test_authorization SET room_id='4cb5feb0-231e-42a0-bfe9-95621d3ac2c5',event_id='completed_4cb5feb0-231e-42a0-bfe9-95621d3ac2c5',due_at=date_trunc('minute',now())+interval '12 minutes',enabled=true;
SELECT public.buffer_resume();
SELECT event_id,due_at AT TIME ZONE 'Asia/Tokyo' AS cancellation_test_due_jst FROM public.buffer_test_authorization;
COMMIT;
