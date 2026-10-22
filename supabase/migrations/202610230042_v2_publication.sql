BEGIN;
ALTER TABLE public.v2_work_snapshots ADD COLUMN highlight_post_ids uuid[] NOT NULL DEFAULT '{}';
CREATE FUNCTION public.v2_draft_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.rooms WHERE id=NEW.room_id AND v2_enabled) THEN
  IF TG_OP='UPDATE' AND OLD.published_at IS NOT NULL AND (NEW.blocks IS DISTINCT FROM OLD.blocks OR NEW.published_at IS DISTINCT FROM OLD.published_at) THEN RAISE EXCEPTION 'SNAPSHOT_IMMUTABLE'; END IF;
  IF TG_OP='INSERT' OR NEW.blocks IS DISTINCT FROM OLD.blocks THEN PERFORM mvp_private.v2_validate_blocks(NEW.room_id,NEW.blocks); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.v2_draft_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER v2_draft_guard BEFORE INSERT OR UPDATE ON public.work_drafts FOR EACH ROW EXECUTE FUNCTION public.v2_draft_guard();

CREATE OR REPLACE FUNCTION public.mvp_publish_due() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; d public.work_drafts%ROWTYPE; safe jsonb; b jsonb; total integer:=0; incomplete boolean;
BEGIN
 FOR r IN SELECT * FROM public.rooms WHERE status='open' AND is_hidden=false AND deleted_at IS NULL
 AND expires_at<=clock_timestamp() ORDER BY expires_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  IF r.v2_enabled THEN
   SELECT * INTO d FROM public.work_drafts WHERE room_id=r.id FOR UPDATE;
   safe:='[]'::jsonb;
   FOR b IN SELECT value FROM jsonb_array_elements(coalesce(d.blocks,'[]'::jsonb)) LOOP
    -- Revalidate references after moderation/exclusion changes. Never fabricate text or call AI.
    BEGIN
     PERFORM mvp_private.v2_validate_blocks(r.id,jsonb_build_array(b));
     safe:=safe||jsonb_build_array(b);
    EXCEPTION WHEN raise_exception OR invalid_text_representation THEN NULL;
    END;
   END LOOP;
   incomplete:=NOT EXISTS(SELECT 1 FROM jsonb_array_elements(safe) x WHERE
    x->>'type'='text' AND length(btrim(x->>'text'))>0 OR x->>'type' IN ('image','link')
    OR x->>'type'='list' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'items') i WHERE length(btrim(i))>0));
   INSERT INTO public.v2_work_snapshots(room_id,title,description,genre,blocks,incomplete,source_version,highlight_post_ids)
   VALUES(r.id,CASE WHEN mvp_private.v2_safe_text(r.title) THEN r.title ELSE '未完成作品' END,
    CASE WHEN mvp_private.v2_safe_text(coalesce(r.concept,'')) THEN coalesce(r.concept,'') ELSE '' END,
    r.genre,safe,incomplete,coalesce(d.version,0),ARRAY(SELECT p.id FROM public.posts p WHERE p.room_id=r.id AND p.is_marked AND mvp_private.v2_post_eligible(p.id,r.id) ORDER BY p.created_at,p.id LIMIT 50))
   ON CONFLICT(room_id) DO NOTHING;
   INSERT INTO public.work_drafts(room_id,blocks,published_at) VALUES(r.id,'[]',clock_timestamp()) ON CONFLICT(room_id) DO UPDATE SET published_at=EXCLUDED.published_at;
   UPDATE public.room_join_requests SET status='revoked',decided_at=clock_timestamp() WHERE room_id=r.id AND status='pending';
   UPDATE public.core_resignations SET status='closed',decided_at=clock_timestamp() WHERE room_id=r.id AND status='pending';
   INSERT INTO public.v2_room_events(room_id,kind) VALUES(r.id,'published');
  ELSE
   INSERT INTO public.work_drafts(room_id,blocks) VALUES(r.id,'[{"id":"incomplete","kind":"text","text":"完成作品の内容は未確定です。"}]'::jsonb) ON CONFLICT DO NOTHING;
   UPDATE public.work_drafts SET blocks='[{"id":"incomplete","kind":"text","text":"完成作品の内容は未確定です。"}]'::jsonb
    WHERE room_id=r.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(blocks) legacy_block WHERE legacy_block->>'kind'='text' AND length(btrim(legacy_block->>'text'))>0);
   UPDATE public.work_drafts SET published_at=clock_timestamp() WHERE room_id=r.id AND published_at IS NULL;
  END IF;
  UPDATE public.rooms SET status='forced_publish' WHERE id=r.id;
  total:=total+1;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.mvp_publish_due() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_publish_due() TO service_role;

CREATE FUNCTION public.v2_room_state(p_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; m public.room_members%ROWTYPE; a uuid:=auth.uid(); d jsonb; members jsonb; requests jsonb; resignations jsonb; events jsonb;
BEGIN
 IF a IS NOT NULL AND NOT public.mvp_current_account_active() THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room AND v2_enabled AND is_hidden=false AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 SELECT * INTO m FROM public.room_members WHERE room_id=p_room AND user_id=a AND left_at IS NULL;
 IF m.id IS NOT NULL THEN
  SELECT jsonb_build_object('blocks',blocks,'version',version,'published_at',published_at) INTO d FROM public.work_drafts WHERE room_id=p_room AND published_at IS NULL;
  SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'created_at',created_at) ORDER BY created_at,id) INTO events
   FROM (SELECT * FROM public.v2_room_events WHERE room_id=p_room ORDER BY created_at DESC,id DESC LIMIT 30) e;
 END IF;
 IF r.status='forced_publish' THEN
  SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'created_at',created_at) ORDER BY created_at,id) INTO events
   FROM (SELECT * FROM public.v2_room_events WHERE room_id=p_room ORDER BY created_at DESC,id DESC LIMIT 30) e;
 END IF;
 IF m.role='creator' AND r.created_by=a THEN
  SELECT jsonb_agg(jsonb_build_object('user_id',user_id,'name',coalesce(username,'Member'),'role',CASE role WHEN 'supporter' THEN 'member' ELSE role END) ORDER BY joined_at)
   INTO members FROM public.room_members WHERE room_id=p_room AND left_at IS NULL;
  SELECT jsonb_agg(jsonb_build_object('id',q.id,'user_id',q.user_id,'name',coalesce(mm.username,'Member'),'created_at',q.created_at) ORDER BY q.created_at)
   INTO requests FROM public.room_join_requests q JOIN public.room_members mm ON mm.room_id=q.room_id AND mm.user_id=q.user_id
   WHERE q.room_id=p_room AND q.status='pending';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('id',s.id,'user_id',s.user_id,'name',coalesce(mm.username,'Core'),'status',s.status) ORDER BY s.created_at)
  INTO resignations FROM public.core_resignations s JOIN public.room_members mm ON mm.room_id=s.room_id AND mm.user_id=s.user_id
  WHERE s.room_id=p_room AND s.status='pending' AND (m.role='creator' AND r.created_by=a OR s.user_id=a);
 RETURN jsonb_build_object('room',jsonb_build_object('id',r.id,'title',r.title,'description',r.concept,'genre',r.genre,'capacity',r.capacity,'deadline',r.expires_at,'status',r.status,'aiLevel',r.ai_level),
  'myRole',CASE m.role WHEN 'supporter' THEN 'member' ELSE m.role END,'myUserId',a,
  'memberCount',(SELECT count(*) FROM public.room_members WHERE room_id=p_room AND left_at IS NULL),
  'coreCount',(SELECT count(*) FROM public.room_members WHERE room_id=p_room AND left_at IS NULL AND role='core'),
  'kicked',EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=p_room AND user_id=a),
  'rejections',(SELECT count(*) FROM public.room_join_requests WHERE room_id=p_room AND user_id=a AND status='rejected'),
  'pendingCore',EXISTS(SELECT 1 FROM public.room_join_requests WHERE room_id=p_room AND user_id=a AND status='pending'),
  'draft',d,'members',coalesce(members,'[]'::jsonb),'requests',coalesce(requests,'[]'::jsonb),'resignations',coalesce(resignations,'[]'::jsonb),'events',coalesce(events,'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.v2_room_state(uuid) FROM PUBLIC,service_role;
GRANT EXECUTE ON FUNCTION public.v2_room_state(uuid) TO anon,authenticated;
COMMIT;
