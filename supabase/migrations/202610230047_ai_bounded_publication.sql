-- One publication implementation; optional bounded V2 worker entrypoint for staged acceptance.
BEGIN;
CREATE OR REPLACE FUNCTION mvp_private.v22_publish_rooms(p_rooms uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; d public.work_drafts%ROWTYPE; safe jsonb; b jsonb; total integer:=0; incomplete boolean; workflow record;
BEGIN
 FOR r IN SELECT * FROM public.rooms WHERE status='open' AND is_hidden=false AND deleted_at IS NULL
 AND expires_at<=clock_timestamp() AND (p_rooms IS NULL OR (id=ANY(p_rooms) AND v2_enabled)) ORDER BY expires_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
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
   -- A withdrawing applicant must not prevent deadline publication. Only the status
   -- and decision time are changed through the existing exact-row private capability.
   FOR workflow IN SELECT to_jsonb(q) body FROM public.room_join_requests q WHERE room_id=r.id AND status='pending' FOR UPDATE LOOP
    PERFORM mvp_private.patch_row('room_join_requests',workflow.body,jsonb_build_object('status','revoked','decided_at',clock_timestamp()));
   END LOOP;
   FOR workflow IN SELECT to_jsonb(q) body FROM public.core_resignations q WHERE room_id=r.id AND status='pending' FOR UPDATE LOOP
    PERFORM mvp_private.patch_row('core_resignations',workflow.body,jsonb_build_object('status','closed','decided_at',clock_timestamp()));
   END LOOP;
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

REVOKE ALL ON FUNCTION mvp_private.v22_publish_rooms(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.mvp_publish_due() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT mvp_private.v22_publish_rooms(NULL) $$;
CREATE FUNCTION public.v22_publish_room(p_room uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN IF p_room IS NULL THEN RAISE EXCEPTION 'ROOM_REQUIRED'; END IF; RETURN mvp_private.v22_publish_rooms(ARRAY[p_room]); END $$;
REVOKE ALL ON FUNCTION public.v22_publish_room(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v22_publish_room(uuid) TO service_role;
COMMIT;
