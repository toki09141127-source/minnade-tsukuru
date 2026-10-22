-- LOCAL CANDIDATE ONLY: never apply to production without schema/trigger/storage audit.
-- Requires existing public rooms, room_members, posts, public_profiles and auth.users.
BEGIN;
CREATE TABLE public.attachment_uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
 bucket text NOT NULL DEFAULT 'room_uploads' CHECK (bucket = 'room_uploads'),
 storage_path text NOT NULL,
 status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','uploaded','bound','failed','cleanup_pending','deleted')),
 created_at timestamptz NOT NULL DEFAULT now(),
 uploaded_at timestamptz,
 used_at timestamptz,
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
 post_id uuid UNIQUE REFERENCES public.posts(id) ON DELETE SET NULL,
 mime_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 4000000),
 UNIQUE (bucket, storage_path),
 CHECK (status <> 'uploaded' OR (uploaded_at IS NOT NULL AND used_at IS NULL)),
 CHECK (status <> 'bound' OR (uploaded_at IS NOT NULL AND used_at IS NOT NULL)),
 CHECK (post_id IS NULL OR used_at IS NOT NULL)
);
CREATE INDEX attachment_uploads_cleanup ON public.attachment_uploads(status, expires_at) WHERE used_at IS NULL;
CREATE TABLE public.post_requests (
 actor_id uuid NOT NULL,
 request_key uuid NOT NULL,
 payload_hash text NOT NULL,
 post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id, request_key)
);
CREATE TABLE public.mvp_rate_limits (
 actor_id uuid NOT NULL,
 action text NOT NULL,
 window_start bigint NOT NULL,
 hits integer NOT NULL,
 PRIMARY KEY(actor_id, action, window_start)
);
ALTER TABLE public.attachment_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mvp_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attachment_uploads, public.post_requests, public.mvp_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachment_uploads, public.post_requests, public.mvp_rate_limits TO service_role;

CREATE FUNCTION public.mvp_take_rate_limit(p_actor uuid, p_action text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_limit integer; v_seconds integer := 60; v_window bigint; v_hits integer;
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'INVALID_ACTOR'; END IF;
 v_limit := CASE p_action WHEN 'posts' THEN 20 WHEN 'uploads' THEN 10 WHEN 'join' THEN 10
  WHEN 'core' THEN 10 WHEN 'like' THEN 30 WHEN 'reports' THEN 5 WHEN 'rooms' THEN 3 ELSE NULL END;
 IF v_limit IS NULL THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
 IF p_action = 'rooms' THEN v_seconds := 3600; END IF;
 v_window := floor(extract(epoch FROM clock_timestamp()) / v_seconds);
 INSERT INTO public.mvp_rate_limits(actor_id, action, window_start, hits)
 VALUES(p_actor, p_action, v_window, 1)
 ON CONFLICT(actor_id, action, window_start) DO UPDATE
 SET hits = least(public.mvp_rate_limits.hits + 1, v_limit + 1)
 RETURNING hits INTO v_hits;
 RETURN v_hits <= v_limit;
END $$;

CREATE FUNCTION public.create_post_with_upload(
 p_actor uuid, p_room uuid, p_content text, p_post_type text, p_upload uuid, p_request_key uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_room public.rooms%ROWTYPE; v_member public.room_members%ROWTYPE;
 v_upload public.attachment_uploads%ROWTYPE; v_request public.post_requests%ROWTYPE;
 v_payload text; v_post uuid; v_username text;
BEGIN
 IF p_actor IS NULL OR p_room IS NULL OR p_request_key IS NULL OR p_content IS NULL
    OR length(btrim(p_content)) = 0 OR length(p_content) > 20000
    OR p_post_type IS NULL OR p_post_type NOT IN ('log','final') THEN
   RAISE EXCEPTION 'INVALID_INPUT';
 END IF;
 -- Serialize same actor retries, then room -> membership -> upload, including different keys.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text, 1701));
 SELECT * INTO v_room FROM public.rooms WHERE id = p_room FOR UPDATE;
 IF NOT FOUND OR v_room.is_hidden IS DISTINCT FROM false OR v_room.deleted_at IS NOT NULL
    OR v_room.status IS DISTINCT FROM 'open' OR (v_room.expires_at IS NOT NULL AND v_room.expires_at <= clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 SELECT * INTO v_member FROM public.room_members WHERE room_id = p_room AND user_id = p_actor FOR UPDATE;
 IF NOT FOUND OR v_member.left_at IS NOT NULL OR (v_member.role IS NULL OR v_member.role NOT IN ('supporter','core','creator')) THEN
   RAISE EXCEPTION 'NOT_MEMBER';
 END IF;
 IF p_post_type = 'final' AND v_member.role NOT IN ('core','creator') THEN RAISE EXCEPTION 'FINAL_FORBIDDEN'; END IF;
 v_payload := encode(sha256(convert_to(jsonb_build_object('room',p_room,'content',p_content,'type',p_post_type,'upload',p_upload)::text, 'UTF8')), 'hex');
 SELECT * INTO v_request FROM public.post_requests WHERE actor_id=p_actor AND request_key=p_request_key;
 IF FOUND THEN
   IF v_request.payload_hash IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
   IF v_request.post_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.posts WHERE id=v_request.post_id AND deleted_at IS NULL AND is_hidden=false) THEN
     RAISE EXCEPTION 'POST_UNAVAILABLE';
   END IF;
   RETURN v_request.post_id;
 END IF;
 IF p_upload IS NOT NULL THEN
   SELECT * INTO v_upload FROM public.attachment_uploads WHERE id=p_upload FOR UPDATE;
   IF NOT FOUND OR v_upload.user_id IS DISTINCT FROM p_actor OR v_upload.room_id IS DISTINCT FROM p_room
      OR v_upload.bucket <> 'room_uploads' OR v_upload.status <> 'uploaded' OR v_upload.used_at IS NOT NULL
      OR v_upload.post_id IS NOT NULL OR v_upload.uploaded_at IS NULL OR v_upload.expires_at <= clock_timestamp()
      OR v_upload.storage_path NOT LIKE ('rooms/' || p_room::text || '/%') THEN
     RAISE EXCEPTION 'UPLOAD_UNAVAILABLE';
   END IF;
 END IF;
 SELECT username INTO v_username FROM public.public_profiles WHERE id=p_actor;
 INSERT INTO public.posts(room_id,user_id,username,content,post_type,attachment_url,attachment_type,is_hidden,deleted_at)
 VALUES(p_room,p_actor,coalesce(nullif(btrim(v_username),''),'名無し'),p_content,p_post_type,
   CASE WHEN p_upload IS NOT NULL THEN v_upload.storage_path END,
   CASE WHEN p_upload IS NOT NULL THEN v_upload.mime_type END,false,NULL) RETURNING id INTO v_post;
 IF p_upload IS NOT NULL THEN
   UPDATE public.attachment_uploads SET status='bound', used_at=clock_timestamp(), post_id=v_post WHERE id=p_upload;
 END IF;
 INSERT INTO public.post_requests(actor_id,request_key,payload_hash,post_id) VALUES(p_actor,p_request_key,v_payload,v_post);
 RETURN v_post;
END $$;
REVOKE ALL ON FUNCTION public.create_post_with_upload(uuid,uuid,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mvp_take_rate_limit(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_post_with_upload(uuid,uuid,text,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mvp_take_rate_limit(uuid,text) TO service_role;
-- API routes already use service_role for post mutations. Close direct REST bypasses.
-- Column-level grants survive table REVOKE, so revoke both explicitly.
REVOKE INSERT, UPDATE, DELETE ON public.posts FROM PUBLIC, anon, authenticated;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT attname FROM pg_attribute WHERE attrelid='public.posts'::regclass AND attnum>0 AND NOT attisdropped LOOP
  EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.posts FROM PUBLIC, anon, authenticated',c.attname,c.attname);
 END LOOP;
END $$;
COMMIT;
