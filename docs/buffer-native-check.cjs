/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const cp=require('node:child_process');
async function main(){
 const runtime=process.env.BUFFER_TEST_RUNTIME;
 if(!runtime)throw Error('BUFFER_TEST_RUNTIME_REQUIRED');
 const bin=path.join(runtime,'node_modules/@embedded-postgres/windows-x64/native/bin');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'minntuku-buffer-native-')),data=path.join(dir,'data');
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
 const port=socket.address().port;await new Promise(r=>socket.close(r));
 const run=(name,args)=>{const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{
  windowsHide:true,timeout:30000,stdio:'ignore'});if(r.status!==0)throw Error('LOCAL_'+name+'_FAILED')};
 let started=false;
 try{
  run('initdb',['-D',data,'-U','fixture_admin','--auth=trust','--locale=C','--encoding=UTF8']);
  fs.appendFileSync(path.join(data,'postgresql.conf'),"\nlisten_addresses='127.0.0.1'\nport="+port+"\n");
  run('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-w','start']);started=true;
  const result=cp.spawnSync(process.execPath,[path.join(__dirname,'buffer-queue-check.cjs')],{
   env:{...process.env,BUFFER_TEST_PORT:String(port)},stdio:'inherit',windowsHide:true,timeout:120000});
  if(result.status!==0)throw Error('NATIVE_CHECK_FAILED');
 }finally{
  if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  // dir is created above by mkdtemp beneath the system temp directory.
  const relative=path.relative(path.resolve(os.tmpdir()),path.resolve(dir));
  if(!relative || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(dir).startsWith('minntuku-buffer-native-'))throw Error('UNSAFE_TEST_CLEANUP');
  fs.rmSync(dir,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
