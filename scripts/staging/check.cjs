/* eslint-disable @typescript-eslint/no-require-imports */
const {load}=require('./safety.cjs');
try{const c=load();console.log(JSON.stringify({environment:'staging',projectRef:c.ref,syntheticOnly:true,productionProtected:true,remoteVerified:false}));}
catch(e){console.error(/^STAGING_|^PRODUCTION_|^KEY_/.test(e.message)?e.message:'STAGING_CHECK_FAILED');process.exitCode=1}
