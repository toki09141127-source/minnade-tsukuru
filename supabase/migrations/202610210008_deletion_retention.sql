-- LOCAL CANDIDATE: restricted recovery snapshot only. Not permission to delete Auth.
BEGIN;
CREATE TABLE public.account_deletion_retention (
 job_id uuid PRIMARY KEY REFERENCES public.account_deletion_jobs(id) ON DELETE RESTRICT,
 policy_version text NOT NULL,
 attribution text NOT NULL CHECK(attribution IN ('anonymous','keep_name')),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_retention ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_retention FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.account_deletion_retention TO service_role;
CREATE FUNCTION public.mvp_snapshot_deletion_history(p_id uuid,p_lease uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs%ROWTYPE; saved public.account_deletion_retention%ROWTYPE; body jsonb;
BEGIN
 SELECT * INTO j FROM public.account_deletion_jobs WHERE id=p_id AND lease_token=p_lease
 AND lease_until>clock_timestamp() AND stage='requested' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
 IF j.policy_version<>'withdrawal-draft-2026-10-21' THEN RAISE EXCEPTION 'POLICY_UNSUPPORTED'; END IF;
 -- Stable ordering, explicit columns. No profiles, tokens, invite codes or whole-row JSON.
 SELECT jsonb_build_object(
 'decisions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'event_id',d.event_id,'post_id',d.post_id,
 'note',d.note,'created_at',d.created_at) ORDER BY d.id) FROM public.decisions d WHERE d.decided_by=j.actor_id),'[]'::jsonb),
 'event_members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'event_id',m.event_id,
 'role',m.role,'joined_at',m.joined_at) ORDER BY m.id) FROM public.event_members m WHERE m.user_id=j.actor_id),'[]'::jsonb),
 'room_pre_archive_notes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'room_id',n.room_id,
 'author_name',CASE WHEN j.attribution='keep_name' THEN n.author_name ELSE '退会したメンバー' END,
 'note',n.note,'created_at',n.created_at) ORDER BY n.id) FROM public.room_pre_archive_notes n WHERE n.author_id=j.actor_id),'[]'::jsonb)
 ) INTO body;
 -- Never overwrite a prior snapshot with changed or missing history on retry.
 SELECT * INTO saved FROM public.account_deletion_retention WHERE job_id=p_id;
 IF FOUND THEN
  IF saved.payload IS DISTINCT FROM body OR saved.attribution<>j.attribution OR saved.policy_version<>j.policy_version
   THEN RAISE EXCEPTION 'RETENTION_CHANGED'; END IF;
 ELSE
  INSERT INTO public.account_deletion_retention(job_id,policy_version,attribution,payload)
  VALUES(p_id,j.policy_version,j.attribution,body);
 END IF;
 RETURN jsonb_array_length(body->'decisions')+jsonb_array_length(body->'event_members')+
 jsonb_array_length(body->'room_pre_archive_notes');
END $$;
REVOKE ALL ON FUNCTION public.mvp_snapshot_deletion_history(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_snapshot_deletion_history(uuid,uuid) TO service_role;
COMMIT;
