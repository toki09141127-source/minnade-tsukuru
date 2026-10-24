-- 027: durable pause and observable external operations. Requires 001-026.
-- An already dispatched external request cannot be cancelled; pause blocks new permits.
BEGIN;
CREATE TABLE mvp_private.deletion_control(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),paused boolean NOT NULL DEFAULT true,changed_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO mvp_private.deletion_control(singleton) VALUES(true);
CREATE TABLE mvp_private.deletion_checkpoints(job_id uuid PRIMARY KEY REFERENCES public.account_deletion_jobs(id),lease uuid NOT NULL,phase text NOT NULL,checked_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE mvp_private.deletion_effects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid NOT NULL REFERENCES public.account_deletion_jobs(id),lease uuid NOT NULL,effect text NOT NULL CHECK(effect IN ('storage_delete','auth_delete')),upload_id uuid,state text NOT NULL DEFAULT 'started' CHECK(state IN ('started','finished','unknown')),started_at timestamptz NOT NULL DEFAULT clock_timestamp(),finished_at timestamptz,reconciled_by text);
CREATE UNIQUE INDEX mvp_one_deletion_effect ON mvp_private.deletion_effects(job_id) WHERE state='started';
ALTER TABLE mvp_private.deletion_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_private.deletion_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_private.deletion_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA mvp_private FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_deletion_is_paused() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT coalesce((SELECT paused FROM mvp_private.deletion_control WHERE singleton),true) $$;
CREATE FUNCTION mvp_private.require_deletion_running() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE stopped boolean;
BEGIN
 SELECT paused INTO stopped FROM mvp_private.deletion_control WHERE singleton FOR SHARE;
 IF stopped IS DISTINCT FROM false THEN RAISE EXCEPTION 'DELETION_PAUSED'; END IF;
END $$;
CREATE FUNCTION public.mvp_deletion_checkpoint(p_id uuid,p_lease uuid,p_phase text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM mvp_private.require_deletion_running();
 IF auth.uid() IS NOT NULL OR p_phase<>ALL(ARRAY['prepare','after_prepare','storage_delete','auth_lookup','auth_delete','finalize','advance']) THEN RAISE EXCEPTION 'INVALID_CHECKPOINT'; END IF;
 PERFORM 1 FROM public.account_deletion_jobs WHERE id=p_id AND lease_token=p_lease AND lease_until>clock_timestamp() AND stage NOT IN ('completed','needs_review') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
 INSERT INTO mvp_private.deletion_checkpoints(job_id,lease,phase) VALUES(p_id,p_lease,p_phase)
 ON CONFLICT(job_id) DO UPDATE SET lease=excluded.lease,phase=excluded.phase,checked_at=clock_timestamp();
END $$;
CREATE FUNCTION public.mvp_begin_deletion_effect(p_id uuid,p_lease uuid,p_effect text,p_upload uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result uuid; j public.account_deletion_jobs%ROWTYPE;
BEGIN
 PERFORM public.mvp_deletion_checkpoint(p_id,p_lease,p_effect);
 SELECT * INTO j FROM public.account_deletion_jobs WHERE id=p_id;
 IF (p_effect='auth_delete' AND (j.stage<>'auth_unknown' OR p_upload IS NOT NULL)) OR (p_effect='storage_delete' AND (j.stage<>'requested' OR NOT EXISTS(SELECT 1 FROM mvp_private.deletion_uploads WHERE job_id=p_id AND upload_id=p_upload AND NOT deleted))) THEN RAISE EXCEPTION 'EFFECT_NOT_PREPARED'; END IF;
 INSERT INTO mvp_private.deletion_effects(job_id,lease,effect,upload_id) VALUES(p_id,p_lease,p_effect,p_upload) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.mvp_end_deletion_effect(p_id uuid,p_lease uuid,p_effect_id uuid,p_success boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NOT NULL OR p_success IS NULL THEN RAISE EXCEPTION 'WORKER_ONLY'; END IF;
 UPDATE mvp_private.deletion_effects SET state=CASE WHEN p_success THEN 'finished' ELSE 'unknown' END,finished_at=clock_timestamp()
 WHERE id=p_effect_id AND job_id=p_id AND lease=p_lease AND state='started';
 IF NOT FOUND THEN RAISE EXCEPTION 'EFFECT_NOT_FOUND'; END IF;
END $$;
-- Only the database owner may operate the switch or inspect the management snapshot.
CREATE FUNCTION public.mvp_set_deletion_pause(p_paused boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_paused IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 UPDATE mvp_private.deletion_control SET paused=p_paused,changed_at=clock_timestamp() WHERE singleton;
END $$;
CREATE FUNCTION public.mvp_deletion_operations() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('paused',public.mvp_deletion_is_paused(),'active_effects',(SELECT count(*) FROM mvp_private.deletion_effects WHERE state='started'),'unknown_effects',(SELECT count(*) FROM mvp_private.deletion_effects WHERE state='unknown'),
 'jobs',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT j.id,j.stage,j.updated_at,j.lease_until,c.phase,c.checked_at FROM public.account_deletion_jobs j LEFT JOIN mvp_private.deletion_checkpoints c ON c.job_id=j.id WHERE j.stage<>'completed' ORDER BY j.updated_at LIMIT 100) x),'[]'::jsonb))
$$;
ALTER FUNCTION public.mvp_request_deletion(uuid,text,text) RENAME TO mvp_request_deletion_before_pause;
REVOKE ALL ON FUNCTION public.mvp_request_deletion_before_pause(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_request_deletion(p_actor uuid,p_attribution text,p_policy text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM mvp_private.require_deletion_running();
 RETURN public.mvp_request_deletion_before_pause(p_actor,p_attribution,p_policy);
END $$;
ALTER FUNCTION public.mvp_claim_deletion(uuid) RENAME TO mvp_claim_deletion_before_pause;
REVOKE ALL ON FUNCTION public.mvp_claim_deletion_before_pause(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_claim_deletion(p_id uuid) RETURNS SETOF public.account_deletion_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM mvp_private.require_deletion_running();
 IF EXISTS(SELECT 1 FROM mvp_private.deletion_effects WHERE job_id=p_id AND state='started') THEN RAISE EXCEPTION 'DELETION_EFFECT_IN_FLIGHT'; END IF;
 RETURN QUERY SELECT * FROM public.mvp_claim_deletion_before_pause(p_id);
END $$;
ALTER FUNCTION public.mvp_prepare_deletion(uuid,uuid) RENAME TO mvp_prepare_deletion_before_pause;
REVOKE ALL ON FUNCTION public.mvp_prepare_deletion_before_pause(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_prepare_deletion(p_id uuid,p_lease uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.mvp_deletion_checkpoint(p_id,p_lease,'prepare');
 PERFORM public.mvp_prepare_deletion_before_pause(p_id,p_lease);
END $$;
ALTER FUNCTION public.mvp_advance_deletion(uuid,uuid,text,text) RENAME TO mvp_advance_deletion_before_pause;
REVOKE ALL ON FUNCTION public.mvp_advance_deletion_before_pause(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mvp_advance_deletion(p_id uuid,p_lease uuid,p_expected text,p_next text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.mvp_deletion_checkpoint(p_id,p_lease,'advance');
 PERFORM public.mvp_advance_deletion_before_pause(p_id,p_lease,p_expected,p_next);
END $$;
-- Owner-only recovery after a dead worker and the external result have been verified.
CREATE FUNCTION public.mvp_reconcile_deletion_effect(p_effect uuid,p_evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.mvp_deletion_is_paused() OR p_evidence IS DISTINCT FROM 'worker_stopped_external_checked' THEN RAISE EXCEPTION 'RECONCILIATION_REQUIRES_PAUSE_AND_EVIDENCE'; END IF;
 UPDATE mvp_private.deletion_effects e SET state='unknown',finished_at=clock_timestamp(),reconciled_by=session_user
 FROM public.account_deletion_jobs j WHERE e.id=p_effect AND e.job_id=j.id AND e.state='started' AND (j.lease_until IS NULL OR j.lease_until<clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_LEASE_OR_EFFECT_NOT_FOUND'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mvp_advance_deletion(uuid,uuid,text,text),public.mvp_reconcile_deletion_effect(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mvp_advance_deletion(uuid,uuid,text,text) TO service_role;
-- This shared lock also serializes pause with an Auth deletion already in the DB transaction.
CREATE FUNCTION mvp_private.guard_auth_deletion_pause() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE actor_id=OLD.id) THEN PERFORM mvp_private.require_deletion_running(); END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER aa_mvp_auth_deletion_pause BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION mvp_private.guard_auth_deletion_pause();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mvp_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.mvp_deletion_is_paused(),public.mvp_deletion_checkpoint(uuid,uuid,text),public.mvp_begin_deletion_effect(uuid,uuid,text,uuid),public.mvp_end_deletion_effect(uuid,uuid,uuid,boolean),public.mvp_set_deletion_pause(boolean),public.mvp_deletion_operations(),public.mvp_request_deletion(uuid,text,text),public.mvp_claim_deletion(uuid),public.mvp_prepare_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mvp_deletion_is_paused(),public.mvp_deletion_checkpoint(uuid,uuid,text),public.mvp_begin_deletion_effect(uuid,uuid,text,uuid),public.mvp_end_deletion_effect(uuid,uuid,uuid,boolean),public.mvp_request_deletion(uuid,text,text),public.mvp_claim_deletion(uuid),public.mvp_prepare_deletion(uuid,uuid) TO service_role;
COMMIT;
