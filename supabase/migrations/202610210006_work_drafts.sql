-- LOCAL CANDIDATE. Public-log review integration is required BEFORE enabling drafts in production.
BEGIN;
CREATE TABLE public.work_drafts(
 room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE RESTRICT,
 blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(blocks)='array' AND jsonb_array_length(blocks)<=50),
 version integer NOT NULL DEFAULT 0,
 updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz
);
ALTER TABLE public.work_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_drafts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.work_drafts TO service_role;
GRANT SELECT ON public.work_drafts TO anon,authenticated;
CREATE POLICY work_draft_read ON public.work_drafts FOR SELECT TO anon,authenticated
 USING(public.mvp_can_read_room_posts(room_id) AND (published_at IS NOT NULL OR EXISTS(
  SELECT 1 FROM public.room_members WHERE room_id=work_drafts.room_id AND user_id=auth.uid() AND left_at IS NULL)));
CREATE FUNCTION public.mvp_save_draft(p_actor uuid,p_room uuid,p_version integer,p_blocks jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; v integer; b jsonb;
BEGIN
 IF p_actor IS NULL OR p_blocks IS NULL OR jsonb_typeof(p_blocks)<>'array' OR jsonb_array_length(p_blocks)>50 OR p_version IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 FOR b IN SELECT * FROM jsonb_array_elements(p_blocks) LOOP
  IF b->>'kind' IS NULL OR b->>'kind' NOT IN ('title','summary','text','notes') OR jsonb_typeof(b->'text') IS DISTINCT FROM 'string'
   OR length(b->>'text')>20000 THEN RAISE EXCEPTION 'INVALID_BLOCK'; END IF;
 END LOOP;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF r.id IS NULL OR r.status IS DISTINCT FROM 'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL
 OR (r.expires_at IS NOT NULL AND r.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.room_members WHERE room_id=p_room AND user_id=p_actor AND left_at IS NULL AND role IN ('creator','core') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.work_drafts(room_id) VALUES(p_room) ON CONFLICT DO NOTHING;
 UPDATE public.work_drafts SET blocks=p_blocks,version=version+1,updated_by=p_actor,updated_at=clock_timestamp()
 WHERE room_id=p_room AND version=p_version AND published_at IS NULL RETURNING version INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 RETURN v;
END $$;
CREATE FUNCTION public.mvp_publish_due() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r record; total integer:=0;
BEGIN
 FOR r IN SELECT id FROM public.rooms WHERE status='open' AND is_hidden=false AND deleted_at IS NULL
 AND expires_at<=clock_timestamp() ORDER BY expires_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  INSERT INTO public.work_drafts(room_id,blocks) VALUES(r.id,
   '[{"id":"incomplete","kind":"text","text":"完成作品の内容は未確定です。"}]'::jsonb) ON CONFLICT DO NOTHING;
  UPDATE public.work_drafts SET blocks='[{"id":"incomplete","kind":"text","text":"完成作品の内容は未確定です。"}]'::jsonb
   WHERE room_id=r.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(blocks) b WHERE b->>'kind'='text' AND length(btrim(b->>'text'))>0);
  UPDATE public.work_drafts SET published_at=clock_timestamp() WHERE room_id=r.id AND published_at IS NULL;
  UPDATE public.rooms SET status='forced_publish' WHERE id=r.id;
  total:=total+1;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.mvp_save_draft(uuid,uuid,integer,jsonb),public.mvp_publish_due() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_save_draft(uuid,uuid,integer,jsonb),public.mvp_publish_due() TO service_role;

CREATE TABLE public.post_publication_reviews(
 post_id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
 approved boolean NOT NULL, content_hash text NOT NULL, actor_id uuid NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.post_publication_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_publication_reviews FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.post_publication_reviews TO service_role;
CREATE FUNCTION public.mvp_review_log(p_actor uuid,p_room uuid,p_post uuid,p_public boolean,p_hash text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; p public.posts%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR p_public IS NULL OR p_hash IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF r.id IS NULL OR r.status IS DISTINCT FROM 'open' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL
 OR (r.expires_at IS NOT NULL AND r.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.room_members WHERE room_id=p_room AND user_id=p_actor AND left_at IS NULL AND role IN ('creator','core') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO p FROM public.posts WHERE id=p_post AND room_id=p_room AND is_hidden=false AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR encode(sha256(convert_to(octet_length(coalesce(p.content,''))::text||':'||coalesce(p.content,'')||octet_length(coalesce(p.attachment_url,''))::text||':'||coalesce(p.attachment_url,'')||octet_length(coalesce(p.attachment_type,''))::text||':'||coalesce(p.attachment_type,''),'UTF8')),'hex')<>p_hash THEN RAISE EXCEPTION 'CONTENT_CHANGED'; END IF;
 INSERT INTO public.post_publication_reviews(post_id,approved,content_hash,actor_id) VALUES(p_post,p_public,p_hash,p_actor)
 ON CONFLICT(post_id) DO UPDATE SET approved=EXCLUDED.approved,content_hash=EXCLUDED.content_hash,actor_id=EXCLUDED.actor_id,reviewed_at=clock_timestamp();
END $$;
CREATE FUNCTION public.mvp_public_post_allowed(p_post uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.posts p JOIN public.rooms r ON r.id=p.room_id
 WHERE p.id=p_post AND p.is_hidden=false AND p.deleted_at IS NULL AND r.status='forced_publish' AND r.is_hidden=false AND r.deleted_at IS NULL
 AND (NOT EXISTS(SELECT 1 FROM public.work_drafts d WHERE d.room_id=r.id)
 OR EXISTS(SELECT 1 FROM public.post_publication_reviews v WHERE v.post_id=p.id AND v.approved
 AND v.content_hash=encode(sha256(convert_to(octet_length(coalesce(p.content,''))::text||':'||coalesce(p.content,'')||octet_length(coalesce(p.attachment_url,''))::text||':'||coalesce(p.attachment_url,'')||octet_length(coalesce(p.attachment_type,''))::text||':'||coalesce(p.attachment_type,''),'UTF8')),'hex'))));
$$;
REVOKE ALL ON FUNCTION public.mvp_review_log(uuid,uuid,uuid,boolean,text),public.mvp_public_post_allowed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_review_log(uuid,uuid,uuid,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mvp_public_post_allowed(uuid) TO anon,authenticated,service_role;
CREATE POLICY mvp_public_log_boundary ON public.posts AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(EXISTS(SELECT 1 FROM public.rooms WHERE id=posts.room_id AND status='open') OR public.mvp_public_post_allowed(id));
COMMIT;
