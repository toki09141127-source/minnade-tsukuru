-- V2.2 output moderation, source invalidation and immutable AI publication reference.
BEGIN;
CREATE TABLE public.room_ai_moderation(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
 output_id uuid NOT NULL REFERENCES public.room_ai_outputs(id) ON DELETE RESTRICT,actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),action text NOT NULL CHECK(action='hide'));
ALTER TABLE public.room_ai_moderation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_ai_moderation FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.v22_ai_hide(p_room uuid,p_output uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid;
BEGIN
 a:=mvp_private.v2_actor();
 PERFORM 1 FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT mvp_private.ai_actor_allowed(a,p_room) AND NOT EXISTS(SELECT 1 FROM public.moderation_operators WHERE user_id=a) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 UPDATE public.room_ai_outputs SET hidden_at=clock_timestamp() WHERE id=p_output AND room_id=p_room AND hidden_at IS NULL;
 IF FOUND THEN INSERT INTO public.room_ai_moderation(room_id,output_id,actor_id,action) VALUES(p_room,p_output,a,'hide'); END IF;
END $$;
CREATE FUNCTION public.v22_ai_draft_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.blocks<>'[]'::jsonb) OR (TG_OP='UPDATE' AND OLD.blocks IS DISTINCT FROM NEW.blocks) THEN
  UPDATE public.room_ai_creators SET safety_revision=safety_revision+1 WHERE room_id=NEW.room_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER v22_ai_draft_changed AFTER INSERT OR UPDATE ON public.work_drafts FOR EACH ROW EXECUTE FUNCTION public.v22_ai_draft_changed();

ALTER TABLE public.v2_work_snapshots ADD COLUMN contains_ai_assistance boolean NOT NULL DEFAULT false,
 ADD COLUMN source_ai_output uuid REFERENCES public.room_ai_outputs(id) ON DELETE RESTRICT;
GRANT SELECT(contains_ai_assistance,source_ai_output) ON public.v2_work_snapshots TO anon,authenticated;
CREATE FUNCTION public.v22_ai_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE candidate public.room_ai_outputs%ROWTYPE; context jsonb; cfg mvp_private.ai_control%ROWTYPE;
BEGIN
 -- AI does not edit human blocks. Snapshot freezes one optional assistance output reference.
 -- Visibility of this separately stored AI text remains revocable through moderation.
 NEW.contains_ai_assistance:=false;NEW.source_ai_output:=NULL;
 BEGIN
  IF EXISTS(SELECT 1 FROM public.room_ai_outputs WHERE room_id=NEW.room_id AND accepted_at IS NOT NULL) THEN NEW.contains_ai_assistance:=true; END IF;
  SELECT * INTO cfg FROM mvp_private.ai_control;
  IF NOT cfg.enabled THEN RETURN NEW; END IF;
  context:=mvp_private.build_safe_ai_room_context(NEW.room_id);
  SELECT o.* INTO candidate FROM public.room_ai_outputs o JOIN public.room_ai_tasks t ON t.id=o.task_id
   WHERE o.room_id=NEW.room_id AND o.hidden_at IS NULL AND t.status='succeeded' AND t.trigger_type IN ('publication','deadline')
   AND t.epoch=cfg.epoch AND t.context_hash=encode(sha256(convert_to(context::text,'UTF8')),'hex')
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(o.sources) s WHERE NOT mvp_private.v2_post_eligible(s::uuid,NEW.room_id))
   ORDER BY o.created_at DESC LIMIT 1;
  IF FOUND THEN NEW.contains_ai_assistance:=true;NEW.source_ai_output:=candidate.id; END IF;
 EXCEPTION WHEN OTHERS THEN
  -- Failure of optional assistance must never cancel the human-only publication transaction.
  NEW.source_ai_output:=NULL;
 END;
 RETURN NEW;
END $$;
CREATE TRIGGER v22_ai_snapshot BEFORE INSERT ON public.v2_work_snapshots FOR EACH ROW EXECUTE FUNCTION public.v22_ai_snapshot();
CREATE FUNCTION public.v22_ai_work(p_room uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 SELECT o.payload INTO result FROM public.v2_work_snapshots w JOIN public.rooms r ON r.id=w.room_id
 JOIN public.room_ai_outputs o ON o.id=w.source_ai_output AND o.room_id=w.room_id
 JOIN public.room_ai_creators a ON a.room_id=w.room_id
 WHERE w.room_id=p_room AND r.status='forced_publish' AND r.is_hidden=false AND r.deleted_at IS NULL AND o.hidden_at IS NULL
 AND o.safety_revision=a.safety_revision
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(o.sources) s WHERE NOT mvp_private.v2_post_eligible(s::uuid,p_room));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.v22_ai_hide(uuid,uuid),public.v22_ai_draft_changed(),public.v22_ai_snapshot(),public.v22_ai_work(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.v22_ai_hide(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v22_ai_work(uuid) TO anon,authenticated;
COMMIT;