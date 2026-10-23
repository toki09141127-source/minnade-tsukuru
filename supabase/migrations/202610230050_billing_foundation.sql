-- V2.4 additive staging billing foundation. No live credentials or provider payloads.
BEGIN;
CREATE TABLE mvp_private.billing_config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), value jsonb NOT NULL);
INSERT INTO mvp_private.billing_config(value) VALUES ('{"version":1,"currency":"jpy","provisional":true,"graceDays":3,"plans":{"free":{"rank":0,"monthly":0,"yearly":0,"credits":50},"plus":{"rank":1,"monthly":780,"yearly":7800,"credits":500},"pro":{"rank":2,"monthly":1980,"yearly":19800,"credits":2000}},"weights":{"question":1,"summarize":1,"idea":2,"organize":5,"draft_assist":20},"automaticPerRoomDay":24}'::jsonb);
CREATE TABLE public.billing_accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
 provider text CHECK(provider IN ('stripe_test','synthetic')),customer_id text UNIQUE,subscription_id text UNIQUE,
 plan text NOT NULL DEFAULT 'free' CHECK(plan IN ('free','plus','pro')),cycle text CHECK(cycle IN ('month','year')),
 status text NOT NULL DEFAULT 'free' CHECK(status IN ('free','active','past_due','canceled','incomplete','unpaid')),
 period_start timestamptz,period_end timestamptz,grace_until timestamptz,cancel_at_end boolean NOT NULL DEFAULT false,
 next_plan text CHECK(next_plan IN ('free','plus','pro')),next_cycle text CHECK(next_cycle IN ('month','year')),
 deleting boolean NOT NULL DEFAULT false,deletion_confirmed boolean NOT NULL DEFAULT false,
 lease uuid,lease_until timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(period_end IS NULL OR period_start<period_end));
CREATE TABLE public.billing_events(
 provider text NOT NULL CHECK(provider IN ('stripe_test','synthetic')),event_id text NOT NULL,
 account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE RESTRICT,
 event_type text NOT NULL,event_created timestamptz NOT NULL,payload_hash text NOT NULL,
 processed_at timestamptz,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','quarantined')),
 PRIMARY KEY(provider,event_id));
CREATE TABLE public.billing_operations(
 id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('checkout','change','cancel','resume','portal','delete')),
 request_hash text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete','uncertain')),
 provider_ref text,result_url text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ai_credit_periods(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE RESTRICT,
 period_start timestamptz NOT NULL,period_end timestamptz NOT NULL,granted integer NOT NULL CHECK(granted>=0),
 consumed integer NOT NULL DEFAULT 0 CHECK(consumed>=0),reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0),
 CHECK(consumed+reserved<=granted),CHECK(period_start<period_end),UNIQUE(account_id,period_start));
CREATE TABLE public.ai_credit_ledger(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE RESTRICT,
 period_id uuid NOT NULL REFERENCES public.ai_credit_periods(id) ON DELETE RESTRICT,room_id uuid REFERENCES public.rooms(id) ON DELETE RESTRICT,
 task_id uuid,action text NOT NULL,credit_delta integer NOT NULL,reason text NOT NULL,source text NOT NULL CHECK(source IN ('manual','system')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(task_id,action));
CREATE TABLE public.room_ai_entitlements(
 room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE RESTRICT,account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE RESTRICT,
 plan text NOT NULL CHECK(plan IN ('free','plus','pro')),settings jsonb NOT NULL DEFAULT '{}',source_profile uuid,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ai_profiles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES public.billing_accounts(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 40),settings jsonb NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['billing_accounts','billing_events','billing_operations','ai_credit_periods','ai_credit_ledger','room_ai_entitlements','ai_profiles'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
ALTER TABLE mvp_private.billing_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mvp_private.billing_config FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.v24_plans() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT value FROM mvp_private.billing_config WHERE singleton $$;
CREATE FUNCTION mvp_private.v24_rank(p text) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT CASE p WHEN 'pro' THEN 2 WHEN 'plus' THEN 1 ELSE 0 END $$;
CREATE FUNCTION mvp_private.v24_account(p_owner uuid) RETURNS public.billing_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;
BEGIN
 IF p_owner IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_owner) THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
 INSERT INTO public.billing_accounts(owner_id) VALUES(p_owner) ON CONFLICT(owner_id) DO NOTHING;
 SELECT * INTO a FROM public.billing_accounts WHERE owner_id=p_owner FOR UPDATE;
 RETURN a;
END $$;
CREATE FUNCTION mvp_private.v24_plan(a public.billing_accounts) RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN NOT a.deleting AND ((a.status='active' AND a.period_end>now()) OR (a.status='past_due' AND a.grace_until>now())) THEN a.plan ELSE 'free' END
$$;
CREATE FUNCTION mvp_private.v24_period(p_account uuid) RETURNS public.ai_credit_periods LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts; p public.ai_credit_periods; start_at timestamptz; end_at timestamptz; months integer; allowance integer; tier text;
BEGIN
 SELECT * INTO a FROM public.billing_accounts WHERE id=p_account FOR UPDATE;
 IF NOT FOUND OR a.deleting THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
 tier:=mvp_private.v24_plan(a);
 IF tier<>'free' THEN
  -- Twelve monthly credit windows within an annual billing term, anchored to the same start.
  months:=greatest(0,(extract(year FROM age(now(),a.period_start))::integer*12+extract(month FROM age(now(),a.period_start))::integer));
  start_at:=a.period_start+make_interval(months=>months);end_at:=least(a.period_start+make_interval(months=>months+1),a.period_end);
 ELSE start_at:=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';end_at:=start_at+interval '1 month'; END IF;
 allowance:=(public.v24_plans()->'plans'->tier->>'credits')::integer;
 IF a.status='past_due' AND tier<>'free' THEN allowance:=0; END IF;
 INSERT INTO public.ai_credit_periods(account_id,period_start,period_end,granted) VALUES(a.id,start_at,end_at,allowance)
 ON CONFLICT(account_id,period_start) DO UPDATE SET granted=greatest(ai_credit_periods.granted,excluded.granted),period_end=greatest(ai_credit_periods.period_end,excluded.period_end)
 RETURNING * INTO p;
 RETURN p;
END $$;
CREATE FUNCTION public.v24_billing_state() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid; a public.billing_accounts;p public.ai_credit_periods;
BEGIN
 uid:=mvp_private.v2_actor();a:=mvp_private.v24_account(uid);p:=mvp_private.v24_period(a.id);
 RETURN jsonb_build_object('plan',mvp_private.v24_plan(a),'status',CASE WHEN a.status='past_due' AND a.grace_until>now() THEN 'grace' ELSE a.status END,
 'cycle',a.cycle,'renewalAt',a.period_end,'graceUntil',a.grace_until,'cancelAtEnd',a.cancel_at_end,'nextPlan',a.next_plan,'nextCycle',a.next_cycle,
 'credits',jsonb_build_object('periodStart',p.period_start,'periodEnd',p.period_end,'granted',p.granted,'consumed',p.consumed,'reserved',p.reserved,'remaining',p.granted-p.consumed-p.reserved),
 'profiles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'settings',settings,'version',version) ORDER BY updated_at DESC) FROM public.ai_profiles WHERE account_id=a.id),'[]'));
END $$;
-- User-bound intent comes from authenticated RPC, never a request-body actor id.
CREATE FUNCTION public.v24_billing_intent(p_request uuid,p_kind text,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid;a public.billing_accounts;o public.billing_operations;
BEGIN
 uid:=mvp_private.v2_actor();a:=mvp_private.v24_account(uid);
 IF a.deleting OR p_request IS NULL OR p_kind NOT IN ('checkout','change','cancel','resume','portal') OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'BILLING_FORBIDDEN'; END IF;
 SELECT * INTO o FROM public.billing_operations WHERE id=p_request;
 IF FOUND THEN IF o.account_id<>a.id OR o.kind<>p_kind OR o.request_hash<>p_hash THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;RETURN a.id;END IF;
 IF EXISTS(SELECT 1 FROM public.billing_operations WHERE account_id=a.id AND status<>'complete') THEN RAISE EXCEPTION 'BILLING_BUSY'; END IF;
 IF p_kind='checkout' AND (a.subscription_id IS NOT NULL AND a.status NOT IN ('free','canceled')) THEN RAISE EXCEPTION 'SUBSCRIPTION_EXISTS';END IF;
 INSERT INTO public.billing_operations(id,account_id,kind,request_hash) VALUES(p_request,a.id,p_kind,p_hash);RETURN a.id;
END $$;
-- Service-only context is exact operation-scoped, not an arbitrary user lookup.
CREATE FUNCTION public.v24_operation_context(p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.billing_operations;a public.billing_accounts;
BEGIN
 SELECT * INTO o FROM public.billing_operations WHERE id=p_request;
 SELECT * INTO a FROM public.billing_accounts WHERE id=o.account_id FOR UPDATE;
 IF a.id IS NULL OR a.deleting OR a.owner_id IS NULL THEN RAISE EXCEPTION 'BILLING_FORBIDDEN';END IF;
 RETURN jsonb_build_object('account',a.id,'customer',a.customer_id,'subscription',a.subscription_id,'provider',a.provider,'plan',mvp_private.v24_plan(a),'cycle',a.cycle,'status',a.status,'periodEnd',a.period_end,'operation',o.kind,'complete',o.status='complete','url',o.result_url,'reference',o.provider_ref);
END $$;
CREATE FUNCTION public.v24_customer_bind(p_request uuid,p_provider text,p_customer text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;
BEGIN
 SELECT b.* INTO a FROM public.billing_accounts b JOIN public.billing_operations o ON o.account_id=b.id WHERE o.id=p_request FOR UPDATE OF b;
 IF a.id IS NULL OR a.deleting OR p_provider NOT IN ('stripe_test','synthetic') OR p_customer !~ '^(cus_|syn_cus_)[a-zA-Z0-9_-]+$' THEN RAISE EXCEPTION 'BILLING_FORBIDDEN';END IF;
 IF a.customer_id IS NOT NULL AND (a.customer_id<>p_customer OR a.provider<>p_provider) THEN RAISE EXCEPTION 'CUSTOMER_CONFLICT';END IF;
 UPDATE public.billing_accounts SET customer_id=p_customer,provider=p_provider WHERE id=a.id;
END $$;
CREATE FUNCTION public.v24_operation_finish(p_request uuid,p_ref text,p_url text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF length(coalesce(p_ref,''))>250 OR length(coalesce(p_url,''))>2048 THEN RAISE EXCEPTION 'BILLING_INVALID';END IF;
 UPDATE public.billing_operations SET status='complete',provider_ref=p_ref,result_url=p_url WHERE id=p_request AND status<>'complete';
END $$;
CREATE FUNCTION public.v24_webhook_claim(p_provider text,p_event text,p_customer text,p_type text,p_created timestamptz,p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;e public.billing_events;token uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO a FROM public.billing_accounts WHERE provider=p_provider AND customer_id=p_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_UNMAPPED';END IF;
 SELECT * INTO e FROM public.billing_events WHERE provider=p_provider AND event_id=p_event;
 IF FOUND AND (e.account_id<>a.id OR e.payload_hash<>p_hash) THEN RAISE EXCEPTION 'EVENT_CONFLICT';END IF;
 IF FOUND AND e.status<>'pending' THEN RETURN jsonb_build_object('duplicate',true);END IF;
 IF a.lease_until>clock_timestamp() THEN RAISE EXCEPTION 'BILLING_BUSY';END IF;
 INSERT INTO public.billing_events(provider,event_id,account_id,event_type,event_created,payload_hash) VALUES(p_provider,p_event,a.id,left(p_type,100),p_created,p_hash) ON CONFLICT DO NOTHING;
 UPDATE public.billing_accounts SET lease=token,lease_until=clock_timestamp()+interval '60 seconds' WHERE id=a.id;
 RETURN jsonb_build_object('account',a.id,'lease',token,'subscription',a.subscription_id,'deleting',a.deleting OR a.owner_id IS NULL);
END $$;
CREATE FUNCTION public.v24_webhook_apply(p_provider text,p_event text,p_lease uuid,p_snapshot jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;e public.billing_events;newplan text;newstatus text;start_at timestamptz;end_at timestamptz;rank integer;
BEGIN
 SELECT * INTO e FROM public.billing_events WHERE provider=p_provider AND event_id=p_event;
 SELECT * INTO a FROM public.billing_accounts WHERE id=e.account_id FOR UPDATE;
 IF e.event_id IS NULL THEN RAISE EXCEPTION 'EVENT_MISSING';END IF; IF e.status<>'pending' THEN RETURN;END IF;
 IF a.id IS NULL OR a.lease IS DISTINCT FROM p_lease OR a.lease_until IS NULL OR a.lease_until<clock_timestamp() THEN RAISE EXCEPTION 'LEASE_CONFLICT';END IF;
 newplan:=p_snapshot->>'plan';newstatus:=p_snapshot->>'status';
 IF newplan IS NULL OR newstatus IS NULL OR newplan NOT IN ('free','plus','pro') OR newstatus NOT IN ('free','active','past_due','canceled','incomplete','unpaid') OR p_snapshot->>'customer' IS DISTINCT FROM a.customer_id OR coalesce((p_snapshot->>'live')::boolean,true) THEN RAISE EXCEPTION 'BILLING_INVALID';END IF;
 start_at:=nullif(p_snapshot->>'periodStart','')::timestamptz;end_at:=nullif(p_snapshot->>'periodEnd','')::timestamptz;
 IF newstatus IN ('active','past_due') AND (start_at IS NULL OR end_at IS NULL OR end_at<=start_at OR p_snapshot->>'cycle' IS NULL OR p_snapshot->>'cycle' NOT IN ('month','year')) THEN RAISE EXCEPTION 'BILLING_INVALID';END IF;
 IF a.deleting OR a.owner_id IS NULL THEN
  UPDATE public.billing_events SET status='quarantined',processed_at=now() WHERE provider=p_provider AND event_id=p_event;
 ELSE
  UPDATE public.billing_accounts SET subscription_id=p_snapshot->>'subscription',plan=newplan,status=newstatus,cycle=p_snapshot->>'cycle',period_start=start_at,period_end=end_at,
   grace_until=CASE WHEN newstatus='past_due' THEN CASE WHEN a.status='past_due' THEN a.grace_until ELSE coalesce(nullif(p_snapshot->>'failureAt','')::timestamptz,now())+make_interval(days=>(public.v24_plans()->>'graceDays')::integer) END ELSE NULL END,
   cancel_at_end=coalesce((p_snapshot->>'cancelAtEnd')::boolean,false),next_plan=p_snapshot->>'nextPlan',next_cycle=p_snapshot->>'nextCycle',updated_at=now() WHERE id=a.id;
  rank:=mvp_private.v24_rank(newplan);
  IF newstatus='active' THEN
   UPDATE public.room_ai_entitlements q SET plan=newplan FROM public.rooms r WHERE q.room_id=r.id AND q.account_id=a.id AND r.status='open' AND r.expires_at>now() AND mvp_private.v24_rank(q.plan)<rank;
  END IF;
  UPDATE public.billing_events SET status='processed',processed_at=now() WHERE provider=p_provider AND event_id=p_event;
 END IF;
 UPDATE public.billing_accounts SET lease=NULL,lease_until=NULL WHERE id=a.id;
END $$;
CREATE FUNCTION public.v24_webhook_release(p_account uuid,p_lease uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ UPDATE public.billing_accounts SET lease=NULL,lease_until=NULL WHERE id=p_account AND lease=p_lease $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname LIKE 'v24_%' AND n.nspname IN ('public','mvp_private') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated,service_role',r.nspname,r.proname,r.args);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.v24_plans() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.v24_billing_state(),public.v24_billing_intent(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v24_operation_context(uuid),public.v24_customer_bind(uuid,text,text),public.v24_operation_finish(uuid,text,text),public.v24_webhook_claim(text,text,text,text,timestamptz,text),public.v24_webhook_apply(text,text,uuid,jsonb),public.v24_webhook_release(uuid,uuid) TO service_role;
COMMIT;
