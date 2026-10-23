-- Durable recovery after browser reload. Only definite precondition rejection ends an intent.
BEGIN;
ALTER TABLE public.billing_operations ADD COLUMN selection jsonb;
CREATE FUNCTION public.v24_billing_start(p_request uuid,p_kind text,p_hash text,p_plan text DEFAULT NULL,p_cycle text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result uuid;
BEGIN
 IF p_kind IN ('checkout','change') AND (p_plan IS NULL OR p_cycle IS NULL OR p_plan NOT IN ('plus','pro') OR p_cycle NOT IN ('month','year')) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 IF p_kind NOT IN ('checkout','change') AND (p_plan IS NOT NULL OR p_cycle IS NOT NULL) THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 result:=public.v24_billing_intent(p_request,p_kind,p_hash);
 UPDATE public.billing_operations SET selection=jsonb_build_object('action',p_kind,'plan',p_plan,'cycle',p_cycle) WHERE id=p_request AND selection IS NULL;
 IF EXISTS(SELECT 1 FROM public.billing_operations WHERE id=p_request AND selection<>jsonb_build_object('action',p_kind,'plan',p_plan,'cycle',p_cycle)) THEN RAISE EXCEPTION 'REQUEST_CONFLICT';END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.v24_billing_intent(uuid,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.v24_billing_start(uuid,text,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.v24_billing_start(uuid,text,text,text,text) TO authenticated;
ALTER FUNCTION public.v24_billing_state() SET SCHEMA mvp_private;
REVOKE ALL ON FUNCTION mvp_private.v24_billing_state() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.v24_billing_state() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;pending jsonb;
BEGIN
 result:=mvp_private.v24_billing_state();
 SELECT jsonb_build_object('id',o.id,'selection',o.selection,'createdAt',o.created_at) INTO pending FROM public.billing_operations o JOIN public.billing_accounts a ON a.id=o.account_id WHERE a.owner_id=auth.uid() AND o.status<>'complete' ORDER BY o.created_at LIMIT 1;
 RETURN result||jsonb_build_object('pendingOperation',pending);
END $$;
REVOKE ALL ON FUNCTION public.v24_billing_state() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.v24_billing_state() TO authenticated;
CREATE FUNCTION public.v24_operation_reject(p_request uuid,p_code text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_code IS NULL OR p_code NOT IN ('PRICE_UNAVAILABLE','PRICE_CONFIG_MISMATCH','CHECKOUT_OPEN','SUBSCRIPTION_EXISTS','CHANGE_ALREADY_SCHEDULED','PAYMENT_PENDING','SUBSCRIPTION_REQUIRED','PORTAL_UNAVAILABLE','PORTAL_UNSAFE') THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 UPDATE public.billing_operations SET status='complete',provider_ref='rejected:'||p_code,result_url=NULL WHERE id=p_request AND status<>'complete';
END $$;
REVOKE ALL ON FUNCTION public.v24_operation_reject(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v24_operation_reject(uuid,text) TO service_role;
COMMIT;
