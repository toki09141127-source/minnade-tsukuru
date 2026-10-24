/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit existing private store; never emit decrypted material.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const base=require('../release/private.cjs');
const privateDir='C:/Users/Sonet/AppData/Local/minnade-release-private/release52';
function readDpapi(name){
 const input=fs.readFileSync(path.join(privateDir,name),'utf8');
 const script="$s=[Console]::In.ReadToEnd().Trim() | ConvertTo-SecureString; [Console]::Out.Write(([System.Net.NetworkCredential]::new('', $s)).Password)";
 const r=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input,encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/Modules')}});
 if(r.status!==0||!r.stdout)throw Error('WINDOWS_PRIVATE_STORAGE_UNAVAILABLE');
 return r.stdout;
}
module.exports={...base,privateDir,password:()=>readDpapi('production-password.dpapi'),encryptionKey:()=>{const key=Buffer.from(readDpapi('backup-key.dpapi'),'base64');if(key.length!==32)throw Error('PRIVATE_KEY_INVALID');return key}};
