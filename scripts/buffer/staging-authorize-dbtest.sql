BEGIN;
INSERT INTO public.buffer_test_authorization(singleton,room_id,event_id,due_at,body,enabled)
VALUES(true,'76d5dae7-5995-4cf1-973e-89c92e2d3f64','completed_76d5dae7-5995-4cf1-973e-89c92e2d3f64',now()+interval '14 minutes',
E'【TEST】みんつく Buffer/X連携の動作確認です。\n作品の公開・参加募集ではありません。\nhttps://x.com/minnade_tsukuru\n#みんつく #連携テスト',true);
COMMIT;
SELECT (SELECT count(*) FROM pg_constraint WHERE conrelid='public.buffer_queue'::regclass) AS constraints,
 (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='buffer_queue') AS indexes,
 (SELECT count(*) FROM pg_class WHERE oid IN ('public.buffer_queue'::regclass,'public.buffer_reviews'::regclass,'public.buffer_test_authorization'::regclass) AND relrowsecurity) AS rls_tables,
 NOT has_table_privilege('anon','public.buffer_queue','SELECT') AS anon_table_denied,
 NOT has_table_privilege('service_role','public.buffer_queue','INSERT') AS service_direct_write_denied,
 has_function_privilege('service_role','public.buffer_claim(text)','EXECUTE') AS service_rpc_allowed,
 NOT has_function_privilege('authenticated','public.buffer_claim(text)','EXECUTE') AS authenticated_rpc_denied,
 (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.buffer_queue'::regclass AND NOT tgisinternal) AS custom_triggers;
