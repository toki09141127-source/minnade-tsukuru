-- After 020. Client reads are projections; all membership/profile writes stay closed.
BEGIN;
CREATE FUNCTION public.mvp_current_account_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid())
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=auth.uid());
$$;
CREATE FUNCTION public.mvp_public_profile_visible(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_id AND deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=p_id);
$$;
CREATE FUNCTION public.mvp_current_room_creator(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.mvp_current_account_active() AND EXISTS(SELECT 1 FROM public.rooms r
 JOIN public.room_members m ON m.room_id=r.id AND m.user_id=auth.uid()
 WHERE r.id=p_room AND r.created_by=auth.uid() AND r.is_hidden=false AND r.deleted_at IS NULL
 AND m.left_at IS NULL AND m.role='creator');
$$;
CREATE FUNCTION public.mvp_visible_member_count(p_room uuid) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT count(*) FROM public.room_members m JOIN public.rooms r ON r.id=m.room_id
 WHERE r.id=p_room AND r.is_hidden=false AND r.deleted_at IS NULL AND m.left_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs j WHERE j.actor_id=m.user_id);
$$;
REVOKE ALL ON FUNCTION public.mvp_current_account_active(),public.mvp_public_profile_visible(uuid),
 public.mvp_current_room_creator(uuid),public.mvp_visible_member_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mvp_current_account_active(),public.mvp_public_profile_visible(uuid),
 public.mvp_current_room_creator(uuid),public.mvp_visible_member_count(uuid) TO anon,authenticated,service_role;

-- Remove table and column grants, including those an older production schema may contain.
DO $$ DECLARE t text; c record; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','public_profiles','room_members','room_join_requests','room_likes','posts'] LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE SELECT (%I),INSERT (%I),UPDATE (%I),REFERENCES (%I) ON public.%I FROM PUBLIC,anon,authenticated',c.attname,c.attname,c.attname,c.attname,t);
  END LOOP;
 END LOOP;
END $$;
GRANT SELECT(id,username,bio,x_url,youtube_url,instagram_url,tiktok_url,website_url,
 terms_version,terms_agreed_at,privacy_version,privacy_agreed_at) ON public.profiles TO authenticated;
GRANT SELECT(username,bio) ON public.public_profiles TO anon,authenticated;
GRANT SELECT(id,room_id,user_id,role,joined_at,left_at,last_seen_at) ON public.room_members TO authenticated;
GRANT SELECT(id,room_id,user_id,created_at,status) ON public.room_join_requests TO authenticated;
GRANT SELECT(room_id,user_id) ON public.room_likes TO authenticated;
GRANT SELECT(id,room_id,user_id,username,content,created_at,post_type,deleted_at,is_hidden,
 attachment_url,attachment_type,is_marked,marked_by,marked_at) ON public.posts TO anon,authenticated;

CREATE POLICY mvp_own_profile_boundary ON public.profiles AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(id=auth.uid() AND public.mvp_current_account_active());
CREATE POLICY mvp_public_profile_boundary ON public.public_profiles AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.mvp_public_profile_visible(id));
DROP POLICY mvp_members_boundary ON public.room_members;
CREATE POLICY mvp_members_boundary ON public.room_members AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(user_id=auth.uid() AND public.mvp_current_account_active());
CREATE POLICY mvp_requests_boundary ON public.room_join_requests AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(public.mvp_current_account_active() AND (user_id=auth.uid() OR public.mvp_current_room_creator(room_id)));
CREATE POLICY mvp_likes_boundary ON public.room_likes AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(user_id=auth.uid() AND public.mvp_current_account_active());
CREATE POLICY mvp_active_posts_boundary ON public.posts AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(auth.uid() IS NULL OR public.mvp_current_account_active());
-- Explicit permissive readers: security does not depend on names of historical policies.
CREATE POLICY mvp_profile_reader ON public.profiles FOR SELECT TO authenticated USING(true);
CREATE POLICY mvp_public_profile_reader ON public.public_profiles FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY mvp_members_reader ON public.room_members FOR SELECT TO authenticated USING(true);
CREATE POLICY mvp_requests_reader ON public.room_join_requests FOR SELECT TO authenticated USING(true);
CREATE POLICY mvp_likes_reader ON public.room_likes FOR SELECT TO authenticated USING(true);
CREATE POLICY mvp_posts_reader ON public.posts FOR SELECT TO anon,authenticated USING(true);

REVOKE ALL ON public.rooms_with_counts,public.rooms_with_counts_v2,public.profiles_public,public.report_counts FROM PUBLIC,anon,authenticated;
CREATE VIEW public.mvp_room_list WITH(security_invoker=true,security_barrier=true) AS
 SELECT r.id,r.title,r.status,r.type,r.category,r.is_adult,r.created_at,r.expires_at,
 r.like_count,public.mvp_visible_member_count(r.id) AS member_count,r.is_hidden,r.deleted_at,r.ai_level
 FROM public.rooms r WHERE r.is_hidden=false AND r.deleted_at IS NULL;
GRANT SELECT ON public.mvp_room_list TO anon,authenticated;
CREATE FUNCTION public.mvp_accept_current_terms(p_terms text,p_privacy text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR p_terms IS DISTINCT FROM '2026-03-24' OR p_privacy IS DISTINCT FROM '2026-03-24' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,4917));
 IF NOT public.mvp_current_account_active() THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
 UPDATE public.profiles SET terms_version=p_terms,privacy_version=p_privacy,
 terms_agreed_at=clock_timestamp(),privacy_agreed_at=clock_timestamp() WHERE id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_REQUIRED'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_accept_current_terms(text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mvp_accept_current_terms(text,text) TO authenticated;
COMMIT;

