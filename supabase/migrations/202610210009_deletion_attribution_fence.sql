-- LOCAL CANDIDATE ONLY. Requires staging trigger/constraint verification.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs) THEN
  RAISE EXCEPTION 'EXISTING_JOBS_REQUIRE_RECONCILIATION';
 END IF;
END $$;
CREATE TABLE public.account_departed_authors(
 actor_id uuid PRIMARY KEY, public_name text NOT NULL, attribution text NOT NULL,
 job_id uuid NOT NULL REFERENCES public.account_deletion_jobs(id) ON DELETE RESTRICT
);
ALTER TABLE public.account_departed_authors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_departed_authors FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.account_departed_authors TO service_role;

CREATE FUNCTION public.mvp_guard_departing_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb; actors uuid[]:=ARRAY[]::uuid[]; a uuid; col text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF auth.uid() IS NOT NULL THEN actors:=array_append(actors,auth.uid()); END IF;
 FOR col IN SELECT unnest(TG_ARGV) LOOP
  IF TG_OP<>'INSERT' THEN
   r:=to_jsonb(OLD);
   IF r->>col IS NOT NULL THEN actors:=array_append(actors,(r->>col)::uuid); END IF;
  END IF;
  IF TG_OP<>'DELETE' THEN
   r:=to_jsonb(NEW);
   IF r->>col IS NOT NULL THEN actors:=array_append(actors,(r->>col)::uuid); END IF;
  END IF;
 END LOOP;
 FOR a IN SELECT DISTINCT x FROM unnest(actors) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(a::text,4917));
  IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=a) THEN
   RAISE EXCEPTION 'ACCOUNT_WITHDRAWAL_PENDING';
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_guard_departing_write() FROM PUBLIC,anon,authenticated;

-- Fail deployment if audited core tables are missing. Additional app tables are
-- guarded when present; record the installed inventory during staging.
DO $$
DECLARE t text; args text;
BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','public_profiles','posts','room_members','rooms','room_join_requests',
 'events','event_members','decisions','novel_drafts','room_pre_archive_notes'] LOOP
  IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'AUDITED_TABLE_MISSING'; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['profiles','public_profiles','posts','room_members','rooms','room_join_requests',
 'events','event_members','decisions','novel_drafts','room_pre_archive_notes','post_likes','room_likes',
 'reports','attachment_uploads','work_drafts','post_publication_reviews'] LOOP
  IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
  SELECT string_agg(quote_literal(attname),',' ORDER BY attname) INTO args
  FROM pg_attribute WHERE attrelid=to_regclass('public.'||t) AND attnum>0 AND NOT attisdropped
   AND atttypid='uuid'::regtype AND (attname IN ('user_id','created_by','approved_by','decided_by',
    'updated_by','author_id','actor_id','reporter_id','marked_by')
    OR (t IN ('profiles','public_profiles') AND attname='id'));
  EXECUTE format('CREATE TRIGGER zz_mvp_departing_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.mvp_guard_departing_write(%s)',t,coalesce(args,''));
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.mvp_request_deletion(p_actor uuid,p_attribution text,p_policy text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs%ROWTYPE; label text; private_slug text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ISOLATION_UNSUPPORTED'; END IF;
 IF p_actor IS NULL OR p_attribution IS NULL OR p_attribution NOT IN ('anonymous','keep_name')
 OR p_policy IS DISTINCT FROM 'withdrawal-draft-2026-10-21' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,4917));
 SELECT * INTO j FROM public.account_deletion_jobs WHERE actor_id=p_actor;
 IF FOUND THEN
  IF j.attribution<>p_attribution OR j.policy_version<>p_policy THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN j.id;
 END IF;
 SELECT username INTO label FROM public.profiles WHERE id=p_actor FOR UPDATE;
 IF NOT FOUND OR label IS NULL OR btrim(label)='' THEN RAISE EXCEPTION 'PROFILE_REQUIRED'; END IF;
 IF p_attribution='anonymous' THEN
  label:='退会したメンバー';
  -- Audited profiles CHECK requires at most 20 characters. Unique conflicts abort atomically.
  private_slug:='r_'||substr(md5(p_actor::text),1,18);
  -- Unique account lookup names are distinct from the public display label.
  UPDATE public.profiles SET username=private_slug WHERE id=p_actor;
  UPDATE public.public_profiles SET username=private_slug WHERE id=p_actor;
  UPDATE public.posts SET username=label WHERE user_id=p_actor;
  UPDATE public.room_members SET username=label WHERE user_id=p_actor;
  UPDATE public.room_pre_archive_notes SET author_name=label WHERE author_id=p_actor;
  IF EXISTS(SELECT 1 FROM public.posts WHERE user_id=p_actor AND username IS DISTINCT FROM label)
   OR EXISTS(SELECT 1 FROM public.room_members WHERE user_id=p_actor AND username IS DISTINCT FROM label)
   OR EXISTS(SELECT 1 FROM public.room_pre_archive_notes WHERE author_id=p_actor AND author_name IS DISTINCT FROM label)
   OR EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND username IS DISTINCT FROM private_slug)
   OR EXISTS(SELECT 1 FROM public.public_profiles WHERE id=p_actor AND username IS DISTINCT FROM private_slug)
   THEN RAISE EXCEPTION 'ATTRIBUTION_TRIGGER_CONFLICT'; END IF;
 END IF;
 INSERT INTO public.account_deletion_jobs(actor_id,attribution,policy_version)
 VALUES(p_actor,p_attribution,p_policy) RETURNING * INTO j;
 INSERT INTO public.account_departed_authors(actor_id,public_name,attribution,job_id)
 VALUES(p_actor,label,p_attribution,j.id);
 RETURN j.id;
END $$;

CREATE FUNCTION public.mvp_departed_author_labels(p_actors uuid[])
RETURNS TABLE(actor_id uuid,public_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_actors IS NULL OR cardinality(p_actors)>200 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 RETURN QUERY SELECT a.actor_id,a.public_name FROM public.account_departed_authors a WHERE a.actor_id=ANY(p_actors);
END $$;
REVOKE ALL ON FUNCTION public.mvp_departed_author_labels(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mvp_departed_author_labels(uuid[]) TO anon,authenticated,service_role;
COMMIT;
