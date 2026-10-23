-- Staging safeupdate requires an explicit predicate, even for a singleton.
BEGIN;
CREATE OR REPLACE FUNCTION public.v22_ai_control(p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE mvp_private.ai_control SET enabled=p_enabled,epoch=epoch+1 WHERE singleton=true;
 IF NOT p_enabled THEN UPDATE public.room_ai_tasks SET status='skipped',finished_at=clock_timestamp(),error_code='AI_STOPPED',request_text=''
 WHERE status IN ('pending','running'); END IF;
END $$;
COMMIT;
