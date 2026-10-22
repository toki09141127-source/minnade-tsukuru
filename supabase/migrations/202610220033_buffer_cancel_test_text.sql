BEGIN;
-- Only the separately operator-authorized synthetic cancellation fixture can use this text.
ALTER TABLE public.buffer_test_authorization DROP CONSTRAINT buffer_test_authorization_body_check;
ALTER TABLE public.buffer_test_authorization ADD CONSTRAINT buffer_test_authorization_body_check CHECK(body IN (
 E'【TEST】みんつく Buffer/X連携の動作確認です。\n作品の公開・参加募集ではありません。\nhttps://x.com/minnade_tsukuru\n#みんつく #連携テスト',
 E'【TEST】みんつく Buffer/X連携の予約取消テストです。\n作品の公開・参加募集ではありません。\nhttps://x.com/minnade_tsukuru\n#みんつく #取消検証'
));
COMMIT;
