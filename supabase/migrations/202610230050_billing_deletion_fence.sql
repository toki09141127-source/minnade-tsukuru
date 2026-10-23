-- V2.4 test billing retirement. No user Auth deletion until provider stop is verified.
BEGIN;
CREATE OR REPLACE FUNCTION public.v24_operation_finish(p_request uuid,p_ref text,p_url text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;
BEGIN
 SELECT b.* INTO a FROM public.billing_accounts b JOIN public.billing_operations o ON o.account_id=b.id WHERE o.id=p_request FOR UPDATE OF b;
 IF a.id IS NULL OR a.owner_id IS NULL OR length(coalesce(p_ref,''))>250 OR length(coalesce(p_url,''))>2048 THEN RAISE EXCEPTION 'BILLING_INVALID';END IF;
 UPDATE public.billing_operations SET status='complete',provider_ref=p_ref,result_url=CASE WHEN a.deleting THEN NULL ELSE p_url END WHERE id=p_request;
 IF a.deleting THEN UPDATE public.billing_accounts SET deletion_confirmed=false WHERE id=a.id;END IF;
END $$;
CREATE FUNCTION public.v24_deletion_started() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.billing_accounts SET deleting=true,deletion_confirmed=false WHERE owner_id=NEW.actor_id;
 RETURN NEW;
END $$;
CREATE TRIGGER v24_deletion_started AFTER INSERT ON public.account_deletion_jobs FOR EACH ROW EXECUTE FUNCTION public.v24_deletion_started();
CREATE FUNCTION public.v24_auth_billing_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.billing_accounts;
BEGIN
 SELECT * INTO a FROM public.billing_accounts WHERE owner_id=OLD.id FOR UPDATE;
 IF FOUND AND (NOT a.deleting OR NOT a.deletion_confirmed OR EXISTS(SELECT 1 FROM public.billing_operations WHERE account_id=a.id AND status<>'complete')) THEN RAISE EXCEPTION 'BILLING_DELETION_NOT_READY';END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER v24_auth_billing_guard BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.v24_auth_billing_guard();
CREATE FUNCTION public.v24_deletion_context(p_id uuid,p_lease uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs;a public.billing_accounts;
BEGIN
 j:=mvp_private.deletion_job(p_id,p_lease);
 SELECT * INTO a FROM public.billing_accounts WHERE owner_id=j.actor_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 UPDATE public.billing_accounts SET deleting=true WHERE id=a.id;
 -- An uncertain external call stays fenced for reconciliation, never guessed successful.
 IF EXISTS(SELECT 1 FROM public.billing_operations WHERE account_id=a.id AND status<>'complete') THEN RAISE EXCEPTION 'BILLING_OPERATION_UNCERTAIN';END IF;
 RETURN jsonb_build_object('account',a.id,'customer',a.customer_id,'provider',a.provider,'confirmed',a.deletion_confirmed);
END $$;
CREATE FUNCTION public.v24_deletion_confirm(p_id uuid,p_lease uuid,p_account uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs;a public.billing_accounts;
BEGIN
 j:=mvp_private.deletion_job(p_id,p_lease);
 SELECT * INTO a FROM public.billing_accounts WHERE id=p_account AND owner_id=j.actor_id FOR UPDATE;
 IF a.id IS NULL OR NOT a.deleting OR EXISTS(SELECT 1 FROM public.billing_operations WHERE account_id=a.id AND status<>'complete') THEN RAISE EXCEPTION 'BILLING_DELETION_NOT_READY';END IF;
 UPDATE public.billing_accounts SET deletion_confirmed=true,status='canceled',cancel_at_end=false WHERE id=a.id;
 UPDATE public.billing_operations SET result_url=NULL WHERE account_id=a.id;
 DELETE FROM public.ai_profiles WHERE account_id=a.id;
END $$;
REVOKE ALL ON FUNCTION public.v24_deletion_started(),public.v24_auth_billing_guard(),public.v24_deletion_context(uuid,uuid),public.v24_deletion_confirm(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.v24_deletion_context(uuid,uuid),public.v24_deletion_confirm(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.mvp_verify_deletion(p_id uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.account_deletion_jobs%ROWTYPE; spec record; predicate text; found_old boolean; ready boolean; surrogate uuid;
BEGIN
 j:=mvp_private.deletion_job(p_id,p_lease);
 SELECT anonymous_id INTO surrogate FROM mvp_private.deletion_prepared WHERE job_id=j.id;
 IF surrogate IS NULL THEN RAISE EXCEPTION 'PREPARATION_MISSING'; END IF;
 FOR spec IN SELECT * FROM mvp_private.deletion_columns() LOOP
  SELECT string_agg(format('%I=$1',colname),' OR ') INTO predicate FROM unnest(spec.cols) colname;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %s)',spec.table_name,predicate) INTO found_old USING j.actor_id;
  IF found_old THEN RAISE EXCEPTION 'ORIGINAL_IDENTITY_REMAINING'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM profiles WHERE id=j.actor_id) OR EXISTS(SELECT 1 FROM public_profiles WHERE id=j.actor_id)
 OR EXISTS(SELECT 1 FROM room_members WHERE user_id=surrogate AND left_at IS NULL) THEN RAISE EXCEPTION 'PREPARATION_INCOMPLETE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE c.contype='f' AND c.confrelid='auth.users'::regclass AND n.nspname='public' AND t.relname NOT IN ('profiles','public_profiles') AND NOT (c.conrelid='public.billing_accounts'::regclass AND c.conname='billing_accounts_owner_id_fkey' AND c.confdeltype='n' AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='owner_id')]::smallint[] AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')]::smallint[])) THEN RAISE EXCEPTION 'NEW_AUTH_FK_REVIEW'; END IF;
 ready:=NOT EXISTS(SELECT 1 FROM mvp_private.deletion_uploads WHERE job_id=j.id AND NOT deleted)
 AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE owner_id=j.actor_id::text OR owner=j.actor_id)
 AND NOT EXISTS(SELECT 1 FROM storage.buckets WHERE owner_id=j.actor_id::text OR owner=j.actor_id);
 RETURN jsonb_build_object('jobId',j.id,'actorId',j.actor_id,'writesBlocked',true,'retainedWorksVerified',true,
 'attributionApplied',true,'foreignKeysVerified',true,'storageReadyForAuthDeletion',ready);
END $$;

COMMIT;
