-- V2.4: protected Creator pool, task settlement, retained room capabilities.
BEGIN;
UPDATE mvp_private.billing_config SET value=value||'{"classes":{"question":{"kind":"question","cost":1,"min":"free","tier":"cheap"},"summarize":{"kind":"summarize","cost":1,"min":"free","tier":"cheap"},"idea":{"kind":"idea","cost":2,"min":"free","tier":"cheap"},"organize":{"kind":"organize","cost":5,"min":"free","tier":"cheap"},"draft_assist":{"kind":"draft_assist","cost":20,"min":"free","tier":"cheap"},"minutes":{"kind":"summarize","cost":5,"min":"plus","tier":"standard"},"long_log":{"kind":"organize","cost":5,"min":"plus","tier":"standard"},"characters":{"kind":"organize","cost":10,"min":"plus","tier":"standard"},"worldbuilding":{"kind":"organize","cost":10,"min":"plus","tier":"standard"},"premium_draft":{"kind":"draft_assist","cost":30,"min":"plus","tier":"standard"},"final_edit":{"kind":"draft_assist","cost":50,"min":"pro","tier":"premium"}}}'::jsonb;
ALTER TABLE public.room_ai_tasks ADD COLUMN credit_period uuid REFERENCES public.ai_credit_periods(id), ADD COLUMN credit_cost integer NOT NULL DEFAULT 0 CHECK(credit_cost>=0), ADD COLUMN credit_state text NOT NULL DEFAULT 'none' CHECK(credit_state IN ('none','reserved','consumed','released')), ADD COLUMN task_class text, ADD COLUMN model_tier text NOT NULL DEFAULT 'cheap', ADD COLUMN ai_preferences jsonb NOT NULL DEFAULT '{}';
CREATE FUNCTION mvp_private.v24_entitlement(p_room uuid) RETURNS public.room_ai_entitlements LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms; a public.billing_accounts;q public.room_ai_entitlements;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room;
 IF r.created_by IS NULL THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE';END IF;
 SELECT * INTO q FROM public.room_ai_entitlements WHERE room_id=p_room;
 IF FOUND THEN RETURN q;END IF;
 a:=mvp_private.v24_account(r.created_by);
 INSERT INTO public.room_ai_entitlements(room_id,account_id,plan) VALUES(r.id,a.id,mvp_private.v24_plan(a)) ON CONFLICT DO NOTHING;
 SELECT * INTO q FROM public.room_ai_entitlements WHERE room_id=p_room;RETURN q;
END $$;
CREATE FUNCTION public.v24_room_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN IF NEW.v2_enabled THEN PERFORM mvp_private.v24_entitlement(NEW.id);END IF;RETURN NEW;END $$;
-- Alphabetic order precedes AI greeting so its preferences have the same snapshot.
CREATE TRIGGER v21_billing_snapshot AFTER INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.v24_room_created();
-- Existing rooms keep Free baseline until a verified upgrade promotes them.
INSERT INTO public.billing_accounts(owner_id) SELECT DISTINCT created_by FROM public.rooms r JOIN auth.users u ON u.id=r.created_by WHERE r.v2_enabled ON CONFLICT DO NOTHING;
INSERT INTO public.room_ai_entitlements(room_id,account_id,plan) SELECT r.id,a.id,'free' FROM public.rooms r JOIN public.billing_accounts a ON a.owner_id=r.created_by WHERE r.v2_enabled ON CONFLICT DO NOTHING;
CREATE FUNCTION public.v24_credit_reserve() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.room_ai_entitlements;p public.ai_credit_periods;rule jsonb;amount integer;difference integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.task_class IS NOT DISTINCT FROM OLD.task_class THEN RETURN NEW;END IF;
 q:=mvp_private.v24_entitlement(NEW.room_id);
 NEW.task_class:=coalesce(NEW.task_class,NEW.kind);
 rule:=public.v24_plans()->'classes'->NEW.task_class;
 IF rule IS NULL OR rule->>'kind'<>NEW.kind OR mvp_private.v24_rank(q.plan)<mvp_private.v24_rank(rule->>'min') THEN RAISE EXCEPTION 'PLAN_REQUIRED';END IF;
 NEW.model_tier:=CASE WHEN NEW.trigger_type<>'manual' THEN 'cheap' ELSE rule->>'tier' END;
 NEW.ai_preferences:=q.settings;
 IF NEW.trigger_type<>'manual' THEN
  p:=mvp_private.v24_period(q.account_id);NEW.credit_period:=p.id;
  IF NEW.trigger_type='inactivity' AND ((q.settings->>'inactivity')='off' OR EXISTS(SELECT 1 FROM public.room_ai_creators WHERE room_id=NEW.room_id AND last_human_at>now()-make_interval(hours=>coalesce(nullif(q.settings->>'inactivity','off')::integer,CASE q.settings->>'activity' WHEN 'low' THEN 24 WHEN 'medium' THEN 12 ELSE 6 END)))) OR NEW.trigger_type='deadline' AND q.settings->>'deadline'='false' THEN NEW.status:='skipped';NEW.error_code:='AI_PREFERENCE';NEW.finished_at:=now();END IF;
  RETURN NEW;
 END IF;
 IF NEW.status='skipped' THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND (OLD.status<>'pending' OR OLD.attempts<>0 OR OLD.credit_state<>'reserved') THEN RAISE EXCEPTION 'REQUEST_CONFLICT';END IF;
 p:=mvp_private.v24_period(q.account_id);amount:=(rule->>'cost')::integer;
 IF TG_OP='UPDATE' THEN
  IF p.id<>OLD.credit_period THEN RAISE EXCEPTION 'REQUEST_CONFLICT';END IF;
  difference:=amount-OLD.credit_cost;
 ELSE difference:=amount;END IF;
 UPDATE public.ai_credit_periods SET reserved=reserved+difference WHERE id=p.id AND granted-consumed-reserved>=difference;
 IF NOT FOUND THEN RAISE EXCEPTION 'CREDITS_EXHAUSTED';END IF;
 NEW.credit_period:=p.id;NEW.credit_cost:=amount;NEW.credit_state:='reserved';RETURN NEW;
END $$;
CREATE TRIGGER v24_credit_reserve BEFORE INSERT OR UPDATE OF task_class ON public.room_ai_tasks FOR EACH ROW EXECUTE FUNCTION public.v24_credit_reserve();
CREATE FUNCTION public.v24_credit_settle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid;action_name text;delta integer;
BEGIN
 IF NEW.credit_period IS NULL THEN RETURN NEW;END IF;
 SELECT account_id INTO a FROM public.ai_credit_periods WHERE id=NEW.credit_period;
 IF TG_OP='INSERT' THEN action_name:=CASE WHEN NEW.trigger_type='manual' THEN 'reserve' ELSE 'system' END;delta:=-NEW.credit_cost;
 ELSIF NEW.task_class IS DISTINCT FROM OLD.task_class THEN action_name:='reprice';delta:=OLD.credit_cost-NEW.credit_cost;
 ELSIF OLD.credit_state='reserved' AND NEW.status IN ('succeeded','failed','skipped','stuck') THEN
  action_name:=CASE WHEN NEW.status='succeeded' THEN 'consume' ELSE 'release' END;
  delta:=CASE WHEN NEW.status='succeeded' THEN 0 ELSE NEW.credit_cost END;
  UPDATE public.ai_credit_periods SET reserved=reserved-NEW.credit_cost,consumed=consumed+CASE WHEN NEW.status='succeeded' THEN NEW.credit_cost ELSE 0 END WHERE id=NEW.credit_period;
  UPDATE public.room_ai_tasks SET credit_state=CASE WHEN NEW.status='succeeded' THEN 'consumed' ELSE 'released' END WHERE id=NEW.id;
 ELSE RETURN NEW;END IF;
 INSERT INTO public.ai_credit_ledger(account_id,period_id,room_id,task_id,action,credit_delta,reason,source)
 VALUES(a,NEW.credit_period,NEW.room_id,NEW.id,action_name,delta,NEW.task_class,CASE WHEN NEW.trigger_type='manual' THEN 'manual' ELSE 'system' END) ON CONFLICT(task_id,action) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER v24_credit_settle AFTER INSERT OR UPDATE OF status,task_class ON public.room_ai_tasks FOR EACH ROW EXECUTE FUNCTION public.v24_credit_settle();
CREATE FUNCTION public.v24_ai_request(p_room uuid,p_request uuid,p_class text,p_text text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result_id uuid;t public.room_ai_tasks;rule jsonb;
BEGIN
 rule:=public.v24_plans()->'classes'->p_class;
 IF rule IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 -- v22 takes actor consent fence and room lock; identical class retries remain idempotent.
 PERFORM mvp_private.v2_actor();PERFORM 1 FROM public.rooms WHERE rooms.id=p_room FOR UPDATE;
 SELECT * INTO t FROM public.room_ai_tasks WHERE room_id=p_room AND dedupe_key='manual:'||p_request;
 IF FOUND AND t.task_class IS DISTINCT FROM p_class THEN RAISE EXCEPTION 'REQUEST_CONFLICT';END IF;
 result_id:=public.v22_ai_request(p_room,p_request,rule->>'kind',p_text);
 IF t.id IS NULL THEN UPDATE public.room_ai_tasks SET task_class=p_class WHERE room_ai_tasks.id=result_id;END IF;
 RETURN result_id;
END $$;
ALTER FUNCTION public.v22_ai_claim(uuid) SET SCHEMA mvp_private;
REVOKE ALL ON FUNCTION mvp_private.v22_ai_claim(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.v22_ai_claim(p_room uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;t public.room_ai_tasks;
BEGIN
 result:=mvp_private.v22_ai_claim(p_room);IF result IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO t FROM public.room_ai_tasks WHERE id=(result->>'id')::uuid;
 RETURN result||jsonb_build_object('taskClass',coalesce(t.task_class,t.kind),'modelTier',t.model_tier,'preferences',t.ai_preferences);
END $$;
REVOKE ALL ON FUNCTION public.v22_ai_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v22_ai_claim(uuid) TO service_role;
CREATE FUNCTION mvp_private.v24_settings(s jsonb,p_plan text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text;v jsonb;
BEGIN
 IF s IS NULL OR jsonb_typeof(s)<>'object' OR length(s::text)>4000 THEN RETURN false;END IF;
 FOR k,v IN SELECT * FROM jsonb_each(s) LOOP
  IF k NOT IN ('name','icon','personality','style','specialties','activity','profile','sliders','politeness','length','emoji','jargon','questions','inactivity','deadline','ideas','meeting','finalEdit','instructions') THEN RETURN false;END IF;
  IF p_plan<>'pro' AND k NOT IN ('name','icon','personality','style','specialties','activity') THEN RETURN false;END IF;
  IF k IN ('name','profile','instructions') THEN
   IF jsonb_typeof(v)<>'string' OR NOT mvp_private.ai_safe_text(s->>k) OR length(s->>k)>(CASE k WHEN 'name' THEN 40 WHEN 'profile' THEN 300 ELSE 500 END) THEN RETURN false;END IF;
  ELSIF k='specialties' THEN
   IF jsonb_typeof(v)<>'array' OR jsonb_array_length(v)>(CASE WHEN p_plan='pro' THEN 5 ELSE 1 END) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(v) x WHERE x NOT IN ('story','characters','world','editing','planning','visual','music')) THEN RETURN false;END IF;
  ELSIF k='sliders' THEN
   IF jsonb_typeof(v)<>'array' OR jsonb_array_length(v)<>5 OR EXISTS(SELECT 1 FROM jsonb_array_elements(v) x WHERE jsonb_typeof(x)<>'number' OR x::text !~ '^[0-4]$') THEN RETURN false;END IF;
  ELSIF k<>'deadline' AND jsonb_typeof(v)<>'string' THEN RETURN false;
  ELSIF k='icon' AND s->>k NOT IN ('spark','leaf','pen','star','compass','book') THEN RETURN false;
  ELSIF k='personality' AND s->>k NOT IN ('balanced','idea','editor','facilitator','listener','logical') THEN RETURN false;
  ELSIF k='style' AND s->>k NOT IN ('friendly','polite','concise') THEN RETURN false;
  ELSIF k IN ('activity','politeness','length','emoji','jargon','questions','ideas','meeting','finalEdit') AND s->>k NOT IN ('low','medium','high') THEN RETURN false;
  ELSIF k='inactivity' AND s->>k NOT IN ('6','12','24','off') THEN RETURN false;
  ELSIF k='deadline' AND jsonb_typeof(v)<>'boolean' THEN RETURN false;
  END IF;
 END LOOP;RETURN true;
END $$;
CREATE FUNCTION public.v24_room_billing(p_room uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid;q public.room_ai_entitlements;a public.billing_accounts;r public.rooms;p public.ai_credit_periods;
BEGIN
 uid:=mvp_private.v2_actor();
 SELECT * INTO r FROM public.rooms WHERE id=p_room AND deleted_at IS NULL AND is_hidden=false;
 IF r.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.room_members WHERE room_id=p_room AND user_id=uid AND left_at IS NULL) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 q:=mvp_private.v24_entitlement(p_room);SELECT * INTO a FROM public.billing_accounts WHERE id=q.account_id;
 IF a.deleting OR a.owner_id IS NULL THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE';END IF;
 p:=mvp_private.v24_period(a.id);
 RETURN jsonb_build_object('plan',q.plan,'settings',q.settings,'ownerPlan',mvp_private.v24_plan(a),'canEdit',r.created_by=uid AND r.status='open' AND r.expires_at>now() AND mvp_private.v24_plan(a)<>'free','isCreator',r.created_by=uid,'remaining',p.granted-p.consumed-p.reserved);
END $$;
CREATE FUNCTION public.v24_save_settings(p_room uuid,p_settings jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid;q public.room_ai_entitlements;a public.billing_accounts;r public.rooms;
BEGIN
 uid:=mvp_private.v2_actor();SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF r.created_by IS DISTINCT FROM uid OR r.status<>'open' OR r.expires_at<=now() OR r.is_hidden OR r.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 q:=mvp_private.v24_entitlement(p_room);a:=mvp_private.v24_account(uid);
 IF mvp_private.v24_plan(a)='free' OR NOT mvp_private.v24_settings(p_settings,mvp_private.v24_plan(a)) THEN RAISE EXCEPTION 'PLAN_REQUIRED';END IF;
 UPDATE public.room_ai_entitlements SET settings=settings||p_settings WHERE room_id=p_room;
END $$;
CREATE FUNCTION public.v24_save_profile(p_id uuid,p_name text,p_settings jsonb,p_version integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;existing public.ai_profiles;
BEGIN
 a:=mvp_private.v24_account(mvp_private.v2_actor());
 IF mvp_private.v24_plan(a)<>'pro' OR NOT mvp_private.v24_settings(p_settings,'pro') OR p_id IS NULL OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 40 OR NOT mvp_private.ai_safe_text(p_name) THEN RAISE EXCEPTION 'PLAN_REQUIRED';END IF;
 SELECT * INTO existing FROM public.ai_profiles WHERE id=p_id;
 IF FOUND THEN
  IF existing.account_id<>a.id OR existing.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'CONFLICT';END IF;
  UPDATE public.ai_profiles SET name=btrim(p_name),settings=p_settings,version=version+1,updated_at=now() WHERE id=p_id;
 ELSE
  IF p_version IS DISTINCT FROM 0 OR (SELECT count(*) FROM public.ai_profiles WHERE account_id=a.id)>=5 THEN RAISE EXCEPTION 'PROFILE_LIMIT';END IF;
  INSERT INTO public.ai_profiles(id,account_id,name,settings) VALUES(p_id,a.id,btrim(p_name),p_settings);
 END IF;RETURN p_id;
END $$;
CREATE FUNCTION public.v24_delete_profile(p_id uuid,p_version integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;
BEGIN
 a:=mvp_private.v24_account(mvp_private.v2_actor());IF mvp_private.v24_plan(a)<>'pro' THEN RAISE EXCEPTION 'PLAN_REQUIRED';END IF;
 DELETE FROM public.ai_profiles WHERE id=p_id AND account_id=a.id AND version=p_version;IF NOT FOUND THEN RAISE EXCEPTION 'CONFLICT';END IF;
END $$;
CREATE FUNCTION public.v24_create_room(p_request uuid,p_title text,p_description text,p_genre text,p_deadline timestamptz,p_capacity integer,p_ai text,p_consent text,p_profile uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;r uuid;pr public.ai_profiles;old_room uuid;old_profile uuid;
BEGIN
 a:=mvp_private.v24_account(mvp_private.v2_actor());
 SELECT room_id INTO old_room FROM public.room_creation_requests WHERE actor_id=a.owner_id AND request_id=p_request;
 IF old_room IS NOT NULL THEN
  SELECT source_profile INTO old_profile FROM public.room_ai_entitlements WHERE room_id=old_room;
  IF old_profile IS DISTINCT FROM p_profile THEN RAISE EXCEPTION 'REQUEST_CONFLICT';END IF;
 END IF;
 IF p_profile IS NOT NULL AND old_room IS NULL THEN
  SELECT * INTO pr FROM public.ai_profiles WHERE id=p_profile AND account_id=a.id;
  IF pr.id IS NULL OR mvp_private.v24_plan(a)<>'pro' OR p_ai='forbidden' THEN RAISE EXCEPTION 'PLAN_REQUIRED';END IF;
 END IF;
 r:=public.v2_create_room(p_request,p_title,p_description,p_genre,p_deadline,p_capacity,p_ai,p_consent);
 IF p_profile IS NOT NULL AND old_room IS NULL THEN
  UPDATE public.room_ai_entitlements SET settings=pr.settings,source_profile=p_profile WHERE room_id=r;
  UPDATE public.room_ai_tasks SET ai_preferences=pr.settings WHERE room_id=r AND status='pending' AND attempts=0;
 END IF;RETURN r;
END $$;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname LIKE 'v24_%' AND n.nspname IN ('public','mvp_private') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated,service_role',r.nspname,r.proname,r.args);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.v24_plans() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.v24_billing_state(),public.v24_billing_intent(uuid,text,text),public.v24_room_billing(uuid),public.v24_save_settings(uuid,jsonb),public.v24_save_profile(uuid,text,jsonb,integer),public.v24_delete_profile(uuid,integer),public.v24_create_room(uuid,text,text,text,timestamptz,integer,text,text,uuid),public.v24_ai_request(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v24_operation_context(uuid),public.v24_customer_bind(uuid,text,text),public.v24_operation_finish(uuid,text,text),public.v24_webhook_claim(text,text,text,text,timestamptz,text),public.v24_webhook_apply(text,text,uuid,jsonb),public.v24_webhook_release(uuid,uuid) TO service_role;
COMMIT;
