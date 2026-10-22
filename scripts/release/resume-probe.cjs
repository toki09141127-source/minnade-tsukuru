/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),crypto=require('node:crypto'),{load}=require('../staging/safety.cjs'),{createClient}=require('@supabase/supabase-js');
(async()=>{const c=load(),f=JSON.parse(fs.readFileSync('.staging-private/release-staging-fixture.json')),m=JSON.parse(fs.readFileSync('docs/release52-maintenance-result.json'));if(m.projectRef!==c.ref)throw Error('STAGING_ONLY');const u=f.credentials.find(x=>x.alias==='creator');if(!u.email.endsWith('@example.invalid'))throw Error('SYNTHETIC_ONLY');const opt={auth:{persistSession:false,autoRefreshToken:false}},a=createClient(c.url,c.env.SUPABASE_SERVICE_ROLE_KEY,opt),client=createClient(c.url,c.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opt),r={projectRef:c.ref,checks:[],complete:false};const ok=(b,n)=>{if(!b)throw Error(n);r.checks.push({name:n,pass:true})};
 try{
 const login=await client.auth.signInWithPassword({email:u.email,password:u.password});ok(!login.error&&login.data.user.id===u.id,'AUTH_LOGIN_RESUMES');
 const room=await a.from('rooms').update({title:'TEST maintenance resume'}).eq('id',m.roomId);ok(!room.error,'SERVICE_WRITE_RESUMES');
 const post=await a.rpc('create_post_with_upload',{p_actor:u.id,p_room:m.roomId,p_request_key:crypto.randomUUID(),p_upload:null,p_content:'TEST DB stop resume',p_post_type:'log'});ok(!post.error&&!!post.data,'RPC_WRITE_RESUMES');
 const image=await require('sharp')({create:{width:4,height:4,channels:3,background:{r:25,g:80,b:120}}}).png().toBuffer(),file='rooms/'+m.roomId+'/images/'+crypto.randomUUID()+'.png';
 const up=await a.storage.from('room_uploads').upload(file,image,{contentType:'image/png',upsert:false});ok(!up.error,'STORAGE_UPLOAD_RESUMES');
 const down=await a.storage.from('room_uploads').download(file);ok(!down.error&&Buffer.from(await down.data.arrayBuffer()).equals(image),'NEW_TEST_OBJECT_BYTES_MATCH');
 // Only the disposable object created by this invocation is removed.
 ok(!(await a.storage.from('room_uploads').remove([file])).error,'STORAGE_DISPOSABLE_DELETE_RESUMES');
 ok((await a.rpc('mvp_deletion_is_paused')).data===true,'RETIREMENT_STAYS_PAUSED');r.complete=true;
 }catch(e){r.failure=/^[A-Z0-9_]+$/.test(e.message||'')?e.message:'RESUME_PROBE_FAILED';process.exitCode=1}finally{await client.auth.signOut({scope:'local'});fs.writeFileSync('docs/release52-global-resume-result.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r))}
})().catch(()=>{console.error('RESUME_SETUP_FAILED');process.exitCode=1});
