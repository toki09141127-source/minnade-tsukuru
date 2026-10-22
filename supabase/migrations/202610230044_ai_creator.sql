-- V2.2 staging only. No Auth AI user; no changes to previously applied migrations.
BEGIN;
CREATE TABLE mvp_private.ai_control(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,
 epoch bigint NOT NULL DEFAULT 0, manual_per_hour integer NOT NULL DEFAULT 6 CHECK(manual_per_hour BETWEEN 1 AND 30),
 room_per_day integer NOT NULL DEFAULT 24 CHECK(room_per_day BETWEEN 1 AND 100),
 inactivity_seconds integer NOT NULL DEFAULT 21600 CHECK(inactivity_seconds>=300),
 cooldown_seconds integer NOT NULL DEFAULT 600 CHECK(cooldown_seconds>=60));
ALTER TABLE mvp_private.ai_control ENABLE ROW LEVEL SECURITY;
INSERT INTO mvp_private.ai_control DEFAULT VALUES;
REVOKE ALL ON mvp_private.ai_control FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.room_ai_creators(
 room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE RESTRICT,
 id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),
 human_count bigint NOT NULL DEFAULT 0,highlight_changes bigint NOT NULL DEFAULT 0,
 safety_revision bigint NOT NULL DEFAULT 0,last_human_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.room_ai_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),room_id uuid NOT NULL REFERENCES public.room_ai_creators(room_id) ON DELETE RESTRICT,
 actor_id uuid,actor_type text NOT NULL CHECK(actor_type IN ('human','system')),
 trigger_type text NOT NULL CHECK(trigger_type IN ('manual','greeting','posts','highlight','inactivity','deadline','publication')),
 kind text NOT NULL CHECK(kind IN ('question','idea','organize','summarize','draft_assist')),
 dedupe_key text NOT NULL CHECK(length(dedupe_key)<=120),request_text text NOT NULL DEFAULT '' CHECK(length(request_text)<=1200),request_hash text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','succeeded','failed','skipped','stuck')),
 created_at timestamptz NOT NULL DEFAULT now(),not_before timestamptz NOT NULL DEFAULT now(),started_at timestamptz,finished_at timestamptz,
 lease uuid,lease_until timestamptz,attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2),
 context_hash text,epoch bigint,safety_revision bigint,base_version integer,human_count bigint,
 provider text,model text,input_tokens integer CHECK(input_tokens>=0),output_tokens integer CHECK(output_tokens>=0),
 duration_ms integer CHECK(duration_ms>=0),error_code text,
 UNIQUE(room_id,dedupe_key));
CREATE INDEX ai_tasks_dispatch ON public.room_ai_tasks(not_before,created_at) WHERE status='pending';
CREATE INDEX ai_tasks_usage ON public.room_ai_tasks(room_id,created_at);
CREATE TABLE public.room_ai_outputs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL UNIQUE REFERENCES public.room_ai_tasks(id) ON DELETE RESTRICT,
 room_id uuid NOT NULL REFERENCES public.room_ai_creators(room_id) ON DELETE RESTRICT,
 kind text NOT NULL,payload jsonb NOT NULL,sources jsonb NOT NULL,safety_revision bigint NOT NULL,base_version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),hidden_at timestamptz,accepted_at timestamptz,accepted_by uuid);
CREATE INDEX ai_outputs_room ON public.room_ai_outputs(room_id,created_at);
ALTER TABLE public.room_ai_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_ai_outputs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_ai_creators,public.room_ai_tasks,public.room_ai_outputs FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION mvp_private.ai_safe_text(v text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT mvp_private.v2_safe_text(v) AND length(v)<=20000 AND normalize(v,NFKC) !~* '(sk-[a-z0-9_-]{10,}|eyJ[a-zA-Z0-9_-]{15,}\.|-----BEGIN|service.?role|access.?token|api.?key|password|パスワード|秘密鍵|システムプロンプト|system.?prompt|ignore.{0,25}(previous|instruction)|以前の指示.{0,10}(無視|忘)|他.{0,5}ルーム.{0,15}(取得|表示|情報)|https?://[^[:space:]]*[?][^[:space:]]+)';
$$;
CREATE FUNCTION mvp_private.ai_actor_allowed(p_actor uuid,p_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p_actor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor)
 AND EXISTS(SELECT 1 FROM public.room_members WHERE room_id=p_room AND user_id=p_actor AND left_at IS NULL AND role IN ('creator','core'))
 AND NOT EXISTS(SELECT 1 FROM public.room_exclusions WHERE room_id=p_room AND user_id=p_actor);
$$;
CREATE FUNCTION mvp_private.ai_safe_post(p_post uuid,p_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.posts WHERE id=p_post AND room_id=p_room AND is_hidden=false AND deleted_at IS NULL
 AND NOT excluded_from_public_log AND mvp_private.ai_safe_text(coalesce(content,'')));
$$;

-- The only context builder. No usernames, Auth IDs, storage paths, URLs, email or report data.
CREATE FUNCTION mvp_private.build_safe_ai_room_context(p_room uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; identity public.room_ai_creators%ROWTYPE; context_posts jsonb; draft jsonb:='[]'; b jsonb; d public.work_drafts%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room;
 SELECT * INTO identity FROM public.room_ai_creators WHERE room_id=p_room;
 IF r.id IS NULL OR identity.id IS NULL OR NOT r.v2_enabled OR r.ai_level='forbidden' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('ref',p.id,'text',left(p.content,700),'highlight',p.is_marked,
 'decision',CASE WHEN p.content ~ '^(決定:|決定：)' AND mvp_private.ai_actor_allowed(p.user_id,p_room) THEN left(p.content,700) ELSE NULL END,
 'attachment',CASE WHEN p.attachment_type LIKE 'image%' THEN 'image' WHEN p.attachment_type IS NOT NULL THEN 'attachment' ELSE NULL END)
 ORDER BY p.created_at,p.id),'[]') INTO context_posts
 FROM (SELECT * FROM public.posts WHERE room_id=p_room AND mvp_private.ai_safe_post(id,p_room) ORDER BY created_at DESC,id DESC LIMIT 20) p;
 SELECT * INTO d FROM public.work_drafts WHERE room_id=p_room;
 IF d.room_id IS NOT NULL THEN
  FOR b IN SELECT value FROM jsonb_array_elements(d.blocks) LOOP
   IF b->>'type' IN ('heading','summary','text') AND mvp_private.ai_safe_text(b->>'text') THEN
    IF jsonb_array_length(draft)>=5 THEN EXIT; END IF;
    draft:=draft||jsonb_build_array(jsonb_build_object('type',b->>'type','text',left(b->>'text',600)));
   END IF;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('title',CASE WHEN mvp_private.ai_safe_text(r.title) THEN r.title ELSE '' END,
 'description',CASE WHEN mvp_private.ai_safe_text(r.concept) THEN r.concept ELSE '' END,'genre',r.genre,'mode',r.ai_level,
 'deadline',r.expires_at,'posts',context_posts,'draft',draft,'draftVersion',coalesce(d.version,0),
 'safetyRevision',identity.safety_revision,'humanCount',identity.human_count);
END $$;

CREATE FUNCTION mvp_private.ai_enqueue(p_room uuid,p_trigger text,p_kind text,p_key text,p_actor uuid DEFAULT NULL,p_text text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result uuid; cfg mvp_private.ai_control%ROWTYPE; r public.rooms%ROWTYPE; old public.room_ai_tasks%ROWTYPE; initial_status text:='pending';
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR NOT r.v2_enabled OR r.ai_level='forbidden' OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL OR r.status<>'open' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_ai_creators WHERE room_id=p_room) OR EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=r.created_by) THEN RETURN NULL; END IF;
 SELECT * INTO old FROM public.room_ai_tasks WHERE room_id=p_room AND dedupe_key=p_key;
 IF FOUND THEN
  IF old.actor_id IS DISTINCT FROM p_actor OR old.kind<>p_kind OR old.request_hash<>encode(sha256(convert_to(p_text,'UTF8')),'hex') THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN old.id;
 END IF;
 SELECT * INTO cfg FROM mvp_private.ai_control;
 IF NOT cfg.enabled THEN
  IF p_trigger='manual' THEN RAISE EXCEPTION 'AI_UNAVAILABLE'; END IF;
  initial_status:='skipped';
 END IF;
 IF p_actor IS NOT NULL AND NOT mvp_private.ai_actor_allowed(p_actor,p_room) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_actor IS NOT NULL AND (SELECT count(*) FROM public.room_ai_tasks WHERE actor_id=p_actor AND created_at>clock_timestamp()-interval '1 hour')>=cfg.manual_per_hour THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 IF (SELECT count(*) FROM public.room_ai_tasks WHERE room_id=p_room AND created_at>clock_timestamp()-interval '1 day' AND status<>'skipped')>=cfg.room_per_day THEN
  IF p_trigger='manual' THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  initial_status:='skipped';
 END IF;
 INSERT INTO public.room_ai_tasks(room_id,actor_id,actor_type,trigger_type,kind,dedupe_key,request_text,request_hash,status,not_before,finished_at,error_code)
 VALUES(p_room,p_actor,CASE WHEN p_actor IS NULL THEN 'system' ELSE 'human' END,p_trigger,p_kind,p_key,p_text,encode(sha256(convert_to(p_text,'UTF8')),'hex'),initial_status,
 CASE WHEN p_trigger IN ('posts','highlight') THEN clock_timestamp()+interval '30 seconds' ELSE clock_timestamp() END,
 CASE WHEN initial_status='skipped' THEN clock_timestamp() END,CASE WHEN initial_status='skipped' THEN 'AI_STOP_OR_BUDGET' END) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.v22_ai_request(p_room uuid,p_request uuid,p_kind text,p_text text DEFAULT '') RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid; result uuid;
BEGIN
 a:=mvp_private.v2_actor();
 IF p_request IS NULL OR p_kind NOT IN ('question','idea','organize','summarize','draft_assist') OR p_kind IS NULL
 OR p_text IS NULL OR length(p_text)>1200 OR NOT mvp_private.ai_safe_text(p_text) THEN RAISE EXCEPTION 'UNSAFE_CONTENT'; END IF;
 IF EXISTS(SELECT 1 FROM public.rooms WHERE id=p_room AND expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 result:=mvp_private.ai_enqueue(p_room,'manual',p_kind,'manual:'||p_request,a,p_text);
 IF result IS NULL THEN RAISE EXCEPTION 'AI_UNAVAILABLE'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.v22_ai_room_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.v2_enabled AND NEW.ai_level IN ('assist','free') THEN
  INSERT INTO public.room_ai_creators(room_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  PERFORM mvp_private.ai_enqueue(NEW.id,'greeting','organize','greeting');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER v22_ai_room_created AFTER INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.v22_ai_room_created();
CREATE FUNCTION public.v22_ai_post_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE identity public.room_ai_creators%ROWTYPE; rid uuid;
BEGIN
 rid:=CASE WHEN TG_OP='DELETE' THEN OLD.room_id ELSE NEW.room_id END;
 IF NOT EXISTS(SELECT 1 FROM public.room_ai_creators WHERE room_id=rid) THEN RETURN coalesce(NEW,OLD); END IF;
 -- Same lock order as post creation: room then AI identity. AI output is in another table.
 PERFORM 1 FROM public.rooms WHERE id=rid FOR UPDATE;
 IF TG_OP='INSERT' THEN
  UPDATE public.room_ai_creators SET human_count=human_count+1,last_human_at=clock_timestamp() WHERE room_id=rid RETURNING * INTO identity;
  UPDATE public.room_ai_tasks SET status='skipped',finished_at=clock_timestamp(),error_code='HUMAN_RETURNED',request_text=''
    WHERE room_id=rid AND trigger_type='inactivity' AND status IN ('pending','running');
  IF identity.human_count=5 OR (identity.human_count>5 AND (identity.human_count-5)%10=0) THEN
   PERFORM mvp_private.ai_enqueue(rid,'posts','summarize','posts:'||identity.human_count);
  END IF;
 ELSE
  UPDATE public.room_ai_creators SET safety_revision=safety_revision+1,
   highlight_changes=highlight_changes+CASE WHEN TG_OP='UPDATE' AND OLD.is_marked IS DISTINCT FROM NEW.is_marked THEN 1 ELSE 0 END
   WHERE room_id=rid RETURNING * INTO identity;
  IF TG_OP='UPDATE' AND OLD.is_marked IS DISTINCT FROM NEW.is_marked AND identity.highlight_changes%3=0 THEN
   PERFORM mvp_private.ai_enqueue(rid,'highlight','summarize','highlight:'||identity.highlight_changes);
  END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER v22_ai_post_changed AFTER INSERT OR UPDATE OR DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.v22_ai_post_changed();

CREATE FUNCTION public.v22_ai_control(p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE mvp_private.ai_control SET enabled=p_enabled,epoch=epoch+1;
 IF NOT p_enabled THEN UPDATE public.room_ai_tasks SET status='skipped',finished_at=clock_timestamp(),error_code='AI_STOPPED',request_text=''
 WHERE status IN ('pending','running'); END IF;
END $$;
CREATE FUNCTION public.v22_ai_schedule() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; cfg mvp_private.ai_control%ROWTYPE; total integer:=0;
BEGIN
 SELECT * INTO cfg FROM mvp_private.ai_control;
 UPDATE public.room_ai_tasks SET status='stuck',finished_at=clock_timestamp(),error_code='LEASE_EXPIRED',request_text=''
 WHERE status='running' AND lease_until<clock_timestamp();
 FOR r IN SELECT rooms.*,a.last_human_at,a.human_count FROM public.rooms JOIN public.room_ai_creators a ON a.room_id=rooms.id
 WHERE status='open' AND is_hidden=false AND deleted_at IS NULL ORDER BY expires_at LIMIT 100 LOOP
  IF r.expires_at<=clock_timestamp() THEN
   PERFORM mvp_private.ai_enqueue(r.id,'publication','organize','publication');
  ELSIF r.expires_at<=clock_timestamp()+interval '1 hour' THEN
   PERFORM mvp_private.ai_enqueue(r.id,'deadline','organize','deadline');
  ELSIF r.last_human_at<clock_timestamp()-make_interval(secs=>cfg.inactivity_seconds) THEN
   PERFORM mvp_private.ai_enqueue(r.id,'inactivity',CASE WHEN r.ai_level='free' THEN 'idea' ELSE 'organize' END,'inactivity:'||r.human_count);
  END IF;
  total:=total+1;
 END LOOP;
 RETURN total;
END $$;

CREATE FUNCTION public.v22_ai_claim(p_room uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.room_ai_tasks%ROWTYPE; r public.rooms%ROWTYPE; cfg mvp_private.ai_control%ROWTYPE; context jsonb; ident public.room_ai_creators%ROWTYPE;
BEGIN
 SELECT * INTO cfg FROM mvp_private.ai_control;
 IF NOT cfg.enabled THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.rooms WHERE (p_room IS NULL OR id=p_room) AND status='open' AND is_hidden=false AND deleted_at IS NULL
 AND EXISTS(SELECT 1 FROM public.room_ai_tasks WHERE room_id=rooms.id AND status='pending' AND not_before<=clock_timestamp())
 ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- At most one generation in flight in a room, including manual and automatic requests.
 IF EXISTS(SELECT 1 FROM public.room_ai_tasks WHERE room_id=r.id AND status='running') THEN RETURN NULL; END IF;
 SELECT * INTO t FROM public.room_ai_tasks WHERE room_id=r.id AND status='pending' AND not_before<=clock_timestamp()
 ORDER BY CASE WHEN trigger_type='manual' THEN 0 ELSE 1 END,created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO ident FROM public.room_ai_creators WHERE room_id=r.id;
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=r.created_by) OR (t.actor_id IS NOT NULL AND NOT mvp_private.ai_actor_allowed(t.actor_id,r.id))
 OR (r.expires_at<=clock_timestamp() AND t.trigger_type<>'publication') THEN
  UPDATE public.room_ai_tasks SET status='skipped',finished_at=clock_timestamp(),error_code='STATE_CHANGED',request_text='' WHERE id=t.id; RETURN NULL;
 END IF;
 IF t.trigger_type IN ('inactivity','posts','highlight') AND EXISTS(SELECT 1 FROM public.room_ai_tasks WHERE room_id=r.id
 AND status='succeeded' AND finished_at>clock_timestamp()-make_interval(secs=>cfg.cooldown_seconds)) THEN
  UPDATE public.room_ai_tasks SET not_before=clock_timestamp()+make_interval(secs=>cfg.cooldown_seconds) WHERE id=t.id; RETURN NULL;
 END IF;
 context:=mvp_private.build_safe_ai_room_context(r.id);
 IF context IS NULL THEN RETURN NULL; END IF;
 UPDATE public.room_ai_tasks SET status='running',attempts=attempts+1,started_at=clock_timestamp(),lease=gen_random_uuid(),
 lease_until=clock_timestamp()+interval '45 seconds',context_hash=encode(sha256(convert_to(context::text,'UTF8')),'hex'),
 epoch=cfg.epoch,safety_revision=ident.safety_revision,base_version=(context->>'draftVersion')::integer,human_count=ident.human_count
 WHERE id=t.id RETURNING * INTO t;
 RETURN jsonb_build_object('id',t.id,'roomId',t.room_id,'lease',t.lease,'kind',t.kind,'trigger',t.trigger_type,'text',t.request_text,'context',context,'attempt',t.attempts);
END $$;

CREATE FUNCTION mvp_private.ai_valid_output(p_output jsonb,p_context jsonb,p_kind text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text; item jsonb; ref text;
BEGIN
 IF p_output IS NULL OR jsonb_typeof(p_output)<>'object' OR octet_length(p_output::text)>64000
 OR (SELECT count(*) FROM jsonb_object_keys(p_output))<>5
 OR (p_output-'message'-'unresolved'-'nextActions'-'highlightNotes'-'draftText')<>'{}'
 OR jsonb_typeof(p_output->'message') IS DISTINCT FROM 'string' OR jsonb_typeof(p_output->'draftText') IS DISTINCT FROM 'string'
 OR length(p_output->>'message')>1500 OR length(p_output->>'draftText')>6000
 OR NOT mvp_private.ai_safe_text(p_output->>'message') OR NOT mvp_private.ai_safe_text(p_output->>'draftText')
 OR (p_kind<>'draft_assist' AND p_output->>'draftText'<>'') THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['unresolved','nextActions','highlightNotes'] LOOP
  IF jsonb_typeof(p_output->k) IS DISTINCT FROM 'array' OR jsonb_array_length(p_output->k)>8 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_output->k) LOOP
   IF jsonb_typeof(item)<>'object' OR (item-'text'-'refs')<>'{}'
   OR jsonb_typeof(item->'text') IS DISTINCT FROM 'string' OR NOT mvp_private.ai_safe_text(item->>'text')
   OR length(item->>'text')>400 OR jsonb_typeof(item->'refs') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'refs')>5 THEN RETURN false; END IF;
   FOR ref IN SELECT value FROM jsonb_array_elements_text(item->'refs') LOOP
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_context->'posts') source WHERE source->>'ref'=ref AND (k<>'highlightNotes' OR source->'highlight'='true'::jsonb)) THEN RETURN false; END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION mvp_private.ai_valid_output(jsonb,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.v22_ai_finish(p_task uuid,p_lease uuid,p_output jsonb,p_usage jsonb,p_error text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.room_ai_tasks%ROWTYPE; r public.rooms%ROWTYPE; cfg mvp_private.ai_control%ROWTYPE; context jsonb; state text; decisions jsonb;
BEGIN
 SELECT * INTO t FROM public.room_ai_tasks WHERE id=p_task;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 SELECT * INTO r FROM public.rooms WHERE id=t.room_id FOR UPDATE;
 SELECT * INTO t FROM public.room_ai_tasks WHERE id=p_task FOR UPDATE;
 IF t.status<>'running' OR t.lease IS DISTINCT FROM p_lease THEN RETURN t.status; END IF;
 SELECT * INTO cfg FROM mvp_private.ai_control;
 context:=mvp_private.build_safe_ai_room_context(t.room_id);
 state:='succeeded';
 IF NOT cfg.enabled OR cfg.epoch<>t.epoch OR r.status<>'open' OR context IS NULL OR t.lease_until<clock_timestamp()
 OR EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=r.created_by)
 OR (t.actor_id IS NOT NULL AND NOT mvp_private.ai_actor_allowed(t.actor_id,t.room_id))
 OR t.context_hash IS DISTINCT FROM encode(sha256(convert_to(context::text,'UTF8')),'hex')
 THEN state:='skipped';p_error:='STATE_CHANGED';
 ELSIF p_error IS NOT NULL THEN state:='failed';
 ELSIF NOT mvp_private.ai_valid_output(p_output,context,t.kind) THEN state:='failed';p_error:='INVALID_OUTPUT';
 END IF;
 IF p_error IS NOT NULL AND p_error NOT IN ('STATE_CHANGED','INVALID_OUTPUT','PROVIDER_RATE','PROVIDER_UNAVAILABLE','PROVIDER_TIMEOUT','AI_STOPPED','UNSAFE_OUTPUT') THEN p_error:='PROVIDER_UNAVAILABLE'; END IF;
 IF state='succeeded' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('text',x->>'decision','refs',jsonb_build_array(x->>'ref'))),'[]') INTO decisions
  FROM jsonb_array_elements(context->'posts') x WHERE x->>'decision' IS NOT NULL;
  INSERT INTO public.room_ai_outputs(task_id,room_id,kind,payload,sources,safety_revision,base_version)
  VALUES(t.id,t.room_id,t.kind,p_output||jsonb_build_object('decisions',decisions),
   (SELECT coalesce(jsonb_agg(x->>'ref'),'[]') FROM jsonb_array_elements(context->'posts') x),t.safety_revision,t.base_version) ON CONFLICT(task_id) DO NOTHING;
 END IF;
 -- Retry only explicit provider rate rejection; timeout/unknown outcomes are never re-generated automatically.
 IF state='failed' AND p_error='PROVIDER_RATE' AND t.attempts<2 THEN state:='pending'; END IF;
 UPDATE public.room_ai_tasks SET status=state,finished_at=CASE WHEN state<>'pending' THEN clock_timestamp() END,
 not_before=clock_timestamp()+interval '2 minutes',error_code=p_error,request_text=CASE WHEN state='pending' THEN request_text ELSE '' END,
 provider=CASE WHEN p_usage->>'provider' IN ('openai','synthetic') THEN p_usage->>'provider' END,
 model=left(regexp_replace(coalesce(p_usage->>'model',''),'[^a-zA-Z0-9._-]','','g'),80),
 input_tokens=greatest(0,least(coalesce((p_usage->>'inputTokens')::integer,0),1000000)),
 output_tokens=greatest(0,least(coalesce((p_usage->>'outputTokens')::integer,0),1000000)),
 duration_ms=greatest(0,least(coalesce((p_usage->>'durationMs')::integer,0),60000))
 WHERE id=t.id;
 RETURN state;
END $$;

CREATE FUNCTION public.v22_ai_state(p_room uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; ident public.room_ai_creators%ROWTYPE; outputs jsonb; tasks jsonb; enabled boolean;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room;
 IF NOT FOUND OR NOT r.v2_enabled OR r.is_hidden IS DISTINCT FROM false OR r.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
 IF r.status<>'forced_publish' AND (auth.uid() IS NULL OR NOT public.mvp_current_account_active() OR NOT EXISTS(SELECT 1 FROM public.room_members WHERE room_id=p_room AND user_id=auth.uid() AND left_at IS NULL)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO ident FROM public.room_ai_creators WHERE room_id=p_room;
 IF ident.id IS NULL THEN RETURN jsonb_build_object('enabled',false,'identity',NULL,'outputs','[]'::jsonb,'tasks','[]'::jsonb); END IF;
 SELECT c.enabled INTO enabled FROM mvp_private.ai_control c;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC),'[]') INTO outputs FROM (
  SELECT o.id,o.kind,o.payload,o.sources,o.created_at,o.base_version,o.accepted_at,t.trigger_type
  FROM public.room_ai_outputs o JOIN public.room_ai_tasks t ON t.id=o.task_id
  WHERE o.room_id=p_room AND o.hidden_at IS NULL AND o.safety_revision=ident.safety_revision
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(o.sources) source WHERE NOT mvp_private.ai_safe_post(source::uuid,p_room) OR (r.status='forced_publish' AND NOT mvp_private.v2_post_eligible(source::uuid,p_room)))
  ORDER BY o.created_at DESC LIMIT 30) q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC),'[]') INTO tasks FROM (
  SELECT id,kind,trigger_type,status,created_at,finished_at,error_code FROM public.room_ai_tasks
  WHERE room_id=p_room ORDER BY created_at DESC LIMIT 20) q;
 RETURN jsonb_build_object('enabled',enabled,'identity',ident.id,'outputs',outputs,'tasks',tasks);
END $$;
CREATE FUNCTION public.v22_ai_accept(p_room uuid,p_output uuid,p_version integer,p_blocks jsonb,p_reviewed boolean) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid; o public.room_ai_outputs%ROWTYPE; version integer;
BEGIN
 a:=mvp_private.v2_actor();
 PERFORM 1 FROM public.rooms WHERE id=p_room FOR UPDATE;
 IF NOT mvp_private.ai_actor_allowed(a,p_room) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO o FROM public.room_ai_outputs WHERE id=p_output AND room_id=p_room AND hidden_at IS NULL FOR UPDATE;
 IF NOT FOUND OR o.kind<>'draft_assist' OR o.accepted_at IS NOT NULL OR o.base_version<>p_version
 OR o.safety_revision<>(SELECT safety_revision FROM public.room_ai_creators WHERE room_id=p_room) THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 version:=public.v2_save_draft(p_room,p_version,p_blocks,p_reviewed);
 UPDATE public.room_ai_outputs SET accepted_at=clock_timestamp(),accepted_by=a WHERE id=o.id;
 RETURN version;
END $$;

REVOKE ALL ON FUNCTION mvp_private.ai_safe_text(text),mvp_private.ai_actor_allowed(uuid,uuid),mvp_private.ai_safe_post(uuid,uuid),mvp_private.build_safe_ai_room_context(uuid),mvp_private.ai_enqueue(uuid,text,text,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.v22_ai_request(uuid,uuid,text,text),public.v22_ai_state(uuid),public.v22_ai_accept(uuid,uuid,integer,jsonb,boolean),
 public.v22_ai_room_created(),public.v22_ai_post_changed(),public.v22_ai_control(boolean),public.v22_ai_schedule(),
 public.v22_ai_claim(uuid),public.v22_ai_finish(uuid,uuid,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.v22_ai_request(uuid,uuid,text,text),public.v22_ai_accept(uuid,uuid,integer,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.v22_ai_state(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v22_ai_control(boolean),public.v22_ai_schedule(),public.v22_ai_claim(uuid),public.v22_ai_finish(uuid,uuid,jsonb,jsonb,text) TO service_role;
COMMIT;