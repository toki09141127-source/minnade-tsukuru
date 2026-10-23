-- V2.4 boundary fixes; additive, staging-only rollout.
BEGIN;
CREATE FUNCTION mvp_private.v24_month_window(p_start timestamptz,p_end timestamptz,p_at timestamptz)
RETURNS TABLE(window_start timestamptz,window_end timestamptz)
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE anchor timestamp; observed timestamp; n integer;
BEGIN
 IF p_start IS NULL OR p_end IS NULL OR p_start>=p_end THEN RAISE EXCEPTION 'INVALID_PERIOD';END IF;
 anchor:=p_start AT TIME ZONE 'UTC';
 observed:=least(greatest(p_at,p_start),p_end-interval '1 microsecond') AT TIME ZONE 'UTC';
 n:=greatest(0,(extract(year FROM observed)::integer-extract(year FROM anchor)::integer)*12+
   extract(month FROM observed)::integer-extract(month FROM anchor)::integer);
 IF anchor+make_interval(months=>n)>observed THEN n:=greatest(0,n-1);END IF;
 window_start:=(anchor+make_interval(months=>n)) AT TIME ZONE 'UTC';
 window_end:=least((anchor+make_interval(months=>n+1)) AT TIME ZONE 'UTC',p_end);
 RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION mvp_private.v24_month_window(timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION mvp_private.v24_period(p_account uuid) RETURNS public.ai_credit_periods LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts; p public.ai_credit_periods; start_at timestamptz; end_at timestamptz; allowance integer; tier text;
BEGIN
 SELECT * INTO a FROM public.billing_accounts WHERE id=p_account FOR UPDATE;
 IF NOT FOUND OR a.deleting THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
 tier:=mvp_private.v24_plan(a);
 IF tier<>'free' THEN
  -- Twelve monthly credit windows within an annual billing term, anchored to the same start.
  SELECT w.window_start,w.window_end INTO start_at,end_at FROM mvp_private.v24_month_window(a.period_start,a.period_end,now()) w;
 ELSE start_at:=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';end_at:=start_at+interval '1 month'; END IF;
 allowance:=(public.v24_plans()->'plans'->tier->>'credits')::integer;
 IF a.status='past_due' AND tier<>'free' THEN allowance:=0; END IF;
 INSERT INTO public.ai_credit_periods(account_id,period_start,period_end,granted) VALUES(a.id,start_at,end_at,allowance)
 ON CONFLICT(account_id,period_start) DO UPDATE SET granted=greatest(ai_credit_periods.granted,excluded.granted),period_end=greatest(ai_credit_periods.period_end,excluded.period_end)
 RETURNING * INTO p;
 RETURN p;
END $$;

-- Check timing before allocating a dedupe key; original consent/state/budget guards remain.
ALTER FUNCTION mvp_private.ai_enqueue(uuid,text,text,text,uuid,text) RENAME TO v24_base_enqueue;
CREATE FUNCTION mvp_private.ai_enqueue(p_room uuid,p_trigger text,p_kind text,p_key text,p_actor uuid DEFAULT NULL,p_text text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE prefs jsonb; last_human timestamptz; hours integer; old public.room_ai_tasks;cfg mvp_private.ai_control;
BEGIN
 IF p_trigger IN ('inactivity','deadline') THEN
  PERFORM 1 FROM public.rooms WHERE id=p_room FOR UPDATE;
  SELECT q.settings,a.last_human_at INTO prefs,last_human FROM public.room_ai_entitlements q JOIN public.room_ai_creators a ON a.room_id=q.room_id WHERE q.room_id=p_room;
  IF p_trigger='deadline' AND prefs->>'deadline'='false' THEN RETURN NULL;END IF;
  IF p_trigger='inactivity' THEN
   IF prefs->>'inactivity'='off' THEN RETURN NULL;END IF;
   hours:=coalesce(nullif(prefs->>'inactivity','off')::integer,CASE prefs->>'activity' WHEN 'low' THEN 24 WHEN 'medium' THEN 12 ELSE 6 END);
   IF last_human>now()-make_interval(hours=>hours) THEN RETURN NULL;END IF;
  END IF;
  SELECT * INTO old FROM public.room_ai_tasks WHERE room_id=p_room AND dedupe_key=p_key FOR UPDATE;
  SELECT * INTO cfg FROM mvp_private.ai_control;
  IF old.status='skipped' AND old.error_code='AI_PREFERENCE' AND old.attempts=0 AND old.actor_id IS NULL
    AND old.trigger_type=p_trigger AND old.kind=p_kind AND cfg.enabled
    AND EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=p_room AND r.v2_enabled AND r.ai_level<>'forbidden' AND r.status='open'
      AND r.is_hidden=false AND r.deleted_at IS NULL AND r.expires_at>now()
      AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=r.created_by))
    AND (SELECT count(*) FROM public.room_ai_tasks WHERE room_id=p_room AND created_at>now()-interval '1 day' AND status<>'skipped')<cfg.room_per_day
  THEN
   UPDATE public.room_ai_tasks SET status='pending',error_code=NULL,finished_at=NULL,not_before=now(),ai_preferences=coalesce(prefs,'{}')
    WHERE id=old.id;
  END IF;
 END IF;
 RETURN mvp_private.v24_base_enqueue(p_room,p_trigger,p_kind,p_key,p_actor,p_text);
END $$;
REVOKE ALL ON FUNCTION mvp_private.ai_enqueue(uuid,text,text,text,uuid,text),mvp_private.v24_base_enqueue(uuid,text,text,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
