-- LOCAL CANDIDATE. No production execution. Requires migrations 003/004/009.
BEGIN;
CREATE TABLE public.mvp_moderation_capabilities(
 backend_pid integer NOT NULL, transaction_id bigint NOT NULL,
 table_name text NOT NULL CHECK(table_name IN ('posts','rooms')), target_id uuid NOT NULL,
 before_row jsonb NOT NULL, after_row jsonb NOT NULL,
 PRIMARY KEY(backend_pid,transaction_id)
);
ALTER TABLE public.mvp_moderation_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mvp_moderation_capabilities FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.mvp_guard_departing_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb; actors uuid[]:=ARRAY[]::uuid[]; a uuid; col text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 -- Consume an exact, one-use capability; never trust client-set session flags.
 IF TG_OP='UPDATE' AND TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME IN ('posts','rooms') THEN
  DELETE FROM public.mvp_moderation_capabilities
  WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current()
   AND table_name=TG_TABLE_NAME AND target_id=(to_jsonb(OLD)->>'id')::uuid
   AND before_row=to_jsonb(OLD) AND after_row=to_jsonb(NEW);
  IF FOUND THEN RETURN NEW; END IF;
 END IF;
 IF auth.uid() IS NOT NULL THEN actors:=array_append(actors,auth.uid()); END IF;
 FOR col IN SELECT unnest(TG_ARGV) LOOP
  IF TG_OP<>'INSERT' THEN
   r:=to_jsonb(OLD);
   IF r->>col IS NOT NULL THEN actors:=array_append(actors,(r->>col)::uuid); END IF;
  END IF;
  IF TG_OP<>'DELETE' THEN
   r:=to_jsonb(NEW);
   IF r->>col IS NOT NULL THEN actors:=array_append(actors,(r->>col)::uuid); END IF;
  END IF;
 END LOOP;
 FOR a IN SELECT DISTINCT x FROM unnest(actors) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(a::text,4917));
  IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=a) THEN
   RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_guard_departing_write() FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.mvp_moderate(p_actor uuid,p_type text,p_target uuid,p_reason text,p_hidden boolean,p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_before jsonb; v_after jsonb; v_expected jsonb; v_action public.moderation_actions%ROWTYPE; v_table text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF p_actor IS NULL OR p_target IS NULL OR p_hidden IS NULL OR p_request IS NULL OR
 p_type IS NULL OR p_type NOT IN ('room','post') OR p_reason IS NULL OR p_reason NOT IN
 ('privacy','copyright','harassment','inappropriate','other') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF auth.uid() IS NOT NULL AND auth.uid()<>p_actor THEN RAISE EXCEPTION 'ACTOR_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'OPERATOR_WITHDRAWING'; END IF;
 PERFORM 1 FROM public.moderation_operators WHERE user_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,1801));
 SELECT * INTO v_action FROM public.moderation_actions WHERE request_id=p_request;
 IF FOUND THEN
  IF v_action.actor_id<>p_actor OR v_action.target_type<>p_type OR v_action.target_id<>p_target OR
   v_action.reason<>p_reason OR v_action.hidden<>p_hidden THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN;
 END IF;
 v_table:=CASE p_type WHEN 'room' THEN 'rooms' ELSE 'posts' END;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',v_table)
 INTO v_before USING p_target;
 IF v_before IS NULL OR jsonb_typeof(v_before->'is_hidden') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 v_expected:=jsonb_set(v_before,'{is_hidden}',to_jsonb(p_hidden));
 INSERT INTO public.mvp_moderation_capabilities VALUES(pg_backend_pid(),txid_current(),v_table,p_target,v_before,v_expected);
 EXECUTE format('UPDATE public.%I SET is_hidden=$1 WHERE id=$2',v_table) USING p_hidden,p_target;
 -- A BEFORE or AFTER trigger may change other fields: do not commit such changes.
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',v_table) INTO v_after USING p_target;
 IF v_after IS DISTINCT FROM v_expected OR EXISTS(SELECT 1 FROM public.mvp_moderation_capabilities
 WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current()) THEN RAISE EXCEPTION 'MODERATION_SCOPE_VIOLATION'; END IF;
 INSERT INTO public.moderation_actions VALUES(p_request,p_actor,p_type,p_target,p_reason,p_hidden,
 (v_before->>'is_hidden')::boolean,clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid) TO service_role;
COMMIT;
