-- LOCAL CANDIDATE. Operator assignments require explicit owner approval.
BEGIN;
CREATE TABLE public.moderation_operators(user_id uuid PRIMARY KEY);
CREATE TABLE public.moderation_actions(
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL,target_type text NOT NULL CHECK(target_type IN ('room','post')),
 target_id uuid NOT NULL, reason text NOT NULL CHECK(reason IN ('privacy','copyright','harassment','inappropriate','other')),
 hidden boolean NOT NULL, previous_hidden boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_operators,public.moderation_actions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.moderation_operators,public.moderation_actions TO service_role;
CREATE FUNCTION public.mvp_moderate(p_actor uuid,p_type text,p_target uuid,p_reason text,p_hidden boolean,p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_previous boolean; v_action public.moderation_actions%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR p_target IS NULL OR p_hidden IS NULL OR p_request IS NULL OR
 p_type IS NULL OR p_type NOT IN ('room','post') OR p_reason IS NULL OR p_reason NOT IN ('privacy','copyright','harassment','inappropriate','other') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM 1 FROM public.moderation_operators WHERE user_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,1801));
 SELECT * INTO v_action FROM public.moderation_actions WHERE request_id=p_request;
 IF FOUND THEN
  IF v_action.actor_id<>p_actor OR v_action.target_type<>p_type OR v_action.target_id<>p_target OR v_action.reason<>p_reason OR v_action.hidden<>p_hidden THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN;
 END IF;
 IF p_type='room' THEN
  SELECT is_hidden INTO v_previous FROM public.rooms WHERE id=p_target AND deleted_at IS NULL FOR UPDATE;
 ELSE
  SELECT is_hidden INTO v_previous FROM public.posts WHERE id=p_target AND deleted_at IS NULL FOR UPDATE;
 END IF;
 IF NOT FOUND OR v_previous IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF p_type='room' THEN UPDATE public.rooms SET is_hidden=p_hidden WHERE id=p_target;
 ELSE UPDATE public.posts SET is_hidden=p_hidden WHERE id=p_target; END IF;
 INSERT INTO public.moderation_actions VALUES(p_request,p_actor,p_type,p_target,p_reason,p_hidden,v_previous,clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_moderate(uuid,text,uuid,text,boolean,uuid) TO service_role;
COMMIT;
