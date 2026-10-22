-- LOCAL CANDIDATE: room and creator membership commit together.
BEGIN;
CREATE TABLE public.room_creation_requests(
 actor_id uuid NOT NULL,request_id uuid NOT NULL,payload_hash text NOT NULL,
 room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
 PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.room_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_creation_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_create_room(p_actor uuid,p_request uuid,p_settings jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rooms%ROWTYPE; saved public.room_creation_requests%ROWTYPE; digest text; result uuid;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR jsonb_typeof(p_settings) IS DISTINCT FROM 'object'
 OR (auth.uid() IS NOT NULL AND auth.uid()<>p_actor) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_settings) k WHERE k<>ALL(ARRAY[
 'title','category','is_adult','time_limit_hours','work_type','concept','ai_level',
 'enable_core_approval','enable_core_invite','core_invite_code'])) THEN RAISE EXCEPTION 'INVALID_FIELDS'; END IF;
 SELECT * INTO r FROM jsonb_populate_record(NULL::public.rooms,p_settings);
 IF r.title IS NULL OR length(btrim(r.title)) NOT BETWEEN 1 AND 120 OR length(coalesce(r.concept,''))>300
 OR r.time_limit_hours IS NULL OR r.time_limit_hours NOT BETWEEN 1 AND 150 OR r.is_adult IS NULL
 OR r.enable_core_approval IS NULL OR r.enable_core_invite IS NULL
 OR (r.enable_core_invite AND (r.core_invite_code IS NULL OR r.core_invite_code !~ '^[A-Z0-9]{6,32}$'))
 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_actor) THEN RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING'; END IF;
 digest:=encode(sha256(convert_to(p_settings::text,'UTF8')),'hex');
 SELECT * INTO saved FROM public.room_creation_requests WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF saved.payload_hash<>digest THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.rooms WHERE id=saved.room_id AND is_hidden=false AND deleted_at IS NULL) THEN RAISE EXCEPTION 'ROOM_UNAVAILABLE'; END IF;
  RETURN saved.room_id;
 END IF;
 INSERT INTO public.rooms(title,category,is_adult,status,started_at,expires_at,created_by,host_ids,is_hidden,deleted_at,time_limit_hours,work_type,concept,ai_level,enable_core_approval,enable_core_invite,core_invite_code)
 VALUES(r.title,r.category,r.is_adult,'open',clock_timestamp(),clock_timestamp()+r.time_limit_hours*interval '1 hour',
 p_actor,ARRAY[p_actor],false,NULL,r.time_limit_hours,r.work_type,r.concept,r.ai_level,r.enable_core_approval,r.enable_core_invite,
 CASE WHEN r.enable_core_invite THEN r.core_invite_code END) RETURNING id INTO result;
 INSERT INTO public.room_members(room_id,user_id,role,joined_at,left_at) VALUES(result,p_actor,'creator',clock_timestamp(),NULL);
 INSERT INTO public.room_creation_requests VALUES(p_actor,p_request,digest,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mvp_create_room(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_create_room(uuid,uuid,jsonb) TO service_role;
COMMIT;
