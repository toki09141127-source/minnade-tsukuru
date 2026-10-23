BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.buffer_queue WHERE event_id='completed_4cb5feb0-231e-42a0-bfe9-95621d3ac2c5' AND state='failed' AND result_code='REJECTED' AND buffer_id IS NULL) THEN RAISE EXCEPTION 'REJECTED_UNSENT_TEST_REQUIRED'; END IF; END $$;
UPDATE public.buffer_test_authorization SET body=E'【TEST】みんつく Buffer/X連携の予約取消テストです。\n作品の公開・参加募集ではありません。\nhttps://x.com/minnade_tsukuru\n#みんつく #取消検証',due_at=date_trunc('minute',now())+interval '12 minutes' WHERE event_id='completed_4cb5feb0-231e-42a0-bfe9-95621d3ac2c5';
UPDATE public.buffer_queue q SET body=a.body,due_at=a.due_at,state='queued',retry_at=NULL FROM public.buffer_test_authorization a WHERE q.event_id=a.event_id AND q.buffer_id IS NULL;
SELECT event_id,due_at AT TIME ZONE 'Asia/Tokyo' AS due_jst FROM public.buffer_test_authorization;
COMMIT;
