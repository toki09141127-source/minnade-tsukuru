-- One explicitly authorized live TEST reservation only, on staging.
BEGIN;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE event_id='completed_9d8341d7-d03f-44ae-9426-1cbe6dcdecb4') THEN RAISE EXCEPTION 'CANARY_ALREADY_EXISTS_DO_NOT_RETRY'; END IF;
 IF EXISTS(SELECT 1 FROM public.buffer_queue WHERE event_id='completed_76d5dae7-5995-4cf1-973e-89c92e2d3f64' AND buffer_id IS NOT NULL) THEN RAISE EXCEPTION 'DBTEST_UNEXPECTED_EXTERNAL_ID'; END IF;
END $$;
UPDATE public.buffer_queue SET state='cancelled',retry_at=NULL,result_code='SOURCE_CHANGED',updated_at=now()
WHERE event_id='completed_76d5dae7-5995-4cf1-973e-89c92e2d3f64' AND state='failed' AND buffer_id IS NULL;
UPDATE public.buffer_reviews SET excluded=true WHERE room_id IN ('76d5dae7-5995-4cf1-973e-89c92e2d3f64','6208fe60-30e1-4982-8062-561045648a6b');
UPDATE public.buffer_test_authorization SET room_id='9d8341d7-d03f-44ae-9426-1cbe6dcdecb4',event_id='completed_9d8341d7-d03f-44ae-9426-1cbe6dcdecb4',
due_at=date_trunc('minute',now())+interval '7 minutes',enabled=true WHERE singleton=true;
SELECT event_id,due_at AT TIME ZONE 'Asia/Tokyo' AS scheduled_jst FROM public.buffer_test_authorization;
COMMIT;
