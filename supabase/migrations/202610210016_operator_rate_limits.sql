-- LOCAL CANDIDATE: shared database counters, no external rate-limit provider.
BEGIN;
CREATE OR REPLACE FUNCTION public.mvp_take_rate_limit(p_actor uuid, p_action text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_limit integer; v_seconds integer := 60; v_window bigint; v_hits integer;
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'INVALID_ACTOR'; END IF;
 v_limit := CASE p_action WHEN 'posts' THEN 20 WHEN 'uploads' THEN 10 WHEN 'join' THEN 10
  WHEN 'core' THEN 10 WHEN 'like' THEN 30 WHEN 'reports' THEN 5 WHEN 'rooms' THEN 3 WHEN 'account' THEN 3 WHEN 'moderation' THEN 30 WHEN 'moderation_read' THEN 60 ELSE NULL END;
 IF v_limit IS NULL THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 IF p_action IN ('rooms','account') THEN v_seconds := 3600; END IF;
 v_window := floor(extract(epoch FROM clock_timestamp()) / v_seconds);
 INSERT INTO public.mvp_rate_limits(actor_id, action, window_start, hits)
 VALUES(p_actor, p_action, v_window, 1)
 ON CONFLICT(actor_id, action, window_start) DO UPDATE
 SET hits = least(public.mvp_rate_limits.hits + 1, v_limit + 1)
 RETURNING hits INTO v_hits;
 RETURN v_hits <= v_limit;
END $$;

REVOKE ALL ON FUNCTION public.mvp_take_rate_limit(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_take_rate_limit(uuid,text) TO service_role;
COMMIT;
