/* eslint-disable @typescript-eslint/no-require-imports -- Node-only verification and release tooling. */
const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto'),ctx=require('../staging/safety.cjs').load(),{createClient}=require('@supabase/supabase-js');
Object.assign(process.env,ctx.env);require('../staging/web-network.cjs');
const s=JSON.parse(fs.readFileSync('.staging-private/v22-e2e.json'));assert.equal(s.projectRef,ctx.ref);
(async()=>{const user=s.users[3],c=createClient(ctx.url,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.ok(!(await c.auth.signInWithPassword({email:user.email,password:user.password})).error);
s.extra??={};for(const kind of ['publication','fallback'])if(!s.extra[kind]){const r=await c.rpc('v2_create_room',{p_request:crypto.randomUUID(),p_title:'TEST V22 '+s.runId.slice(0,8)+' '+kind,p_description:'共同制作と期限の動作を確かめるために用意した架空の検収用ルームです。',p_genre:'novel',p_deadline:new Date(Date.now()+86400000).toISOString(),p_capacity:10,p_ai:'assist',p_consent:'2026-10-22-v2.1'});assert.ok(!r.error,'CREATE_'+kind);s.extra[kind]=r.data;fs.writeFileSync('.staging-private/v22-e2e.json',JSON.stringify(s));}
const ids=[...Object.values(s.rooms),...Object.values(s.extra)];for(const id of ids)assert.match(id,/^[a-f0-9-]{36}$/);
const sql=[
'-- Temporary staging-only clock controls for exact disposable V22 fixture rooms.',
'BEGIN;',
'CREATE FUNCTION public.v22_fixture_clock(p_room uuid,p_mode text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$',
'BEGIN',
" IF auth.uid() IS NOT NULL OR p_room<>ALL(ARRAY["+ids.map(id=>"'"+id+"'::uuid").join(',')+"]) OR NOT EXISTS(SELECT 1 FROM public.rooms WHERE id=p_room AND v2_enabled AND title LIKE 'TEST V22 "+s.runId.slice(0,8)+"%') THEN RAISE EXCEPTION 'FIXTURE_ONLY'; END IF;",
" IF p_mode='ready' THEN",
"  UPDATE public.room_ai_tasks SET not_before=clock_timestamp(),finished_at=CASE WHEN status='succeeded' THEN clock_timestamp()-interval '1 hour' ELSE finished_at END WHERE room_id=p_room;",
" ELSIF p_mode='inactivity' THEN UPDATE public.room_ai_creators SET last_human_at=clock_timestamp()-interval '7 hours' WHERE room_id=p_room;",
" ELSIF p_mode IN ('deadline','expire') THEN",
'  LOCK TABLE public.rooms IN ACCESS EXCLUSIVE MODE;',
'  ALTER TABLE public.rooms DISABLE TRIGGER v2_settings_immutable;',
"  UPDATE public.rooms SET expires_at=CASE WHEN p_mode='deadline' THEN clock_timestamp()+interval '30 minutes' ELSE clock_timestamp()-interval '1 second' END WHERE id=p_room;",
'  ALTER TABLE public.rooms ENABLE TRIGGER v2_settings_immutable;',
" ELSE RAISE EXCEPTION 'FIXTURE_MODE'; END IF;",
'END $$;',
'REVOKE ALL ON FUNCTION public.v22_fixture_clock(uuid,text) FROM PUBLIC,anon,authenticated;',
'GRANT EXECUTE ON FUNCTION public.v22_fixture_clock(uuid,text) TO service_role;',
'COMMIT;',''].join('\n');
fs.writeFileSync('.staging-private/v22-fixture-clock.sql',sql);
console.log(JSON.stringify({fixtureRooms:ids.length,prepared:true}));
})().catch(()=>{console.log('V22_FIXTURE_PREPARE_FAILED');process.exitCode=1});