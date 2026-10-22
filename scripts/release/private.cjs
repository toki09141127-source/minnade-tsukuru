/* eslint-disable @typescript-eslint/no-require-imports */
// Windows-only private backup helpers. Never print input, credentials, SQL, or user rows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const privateDir=path.join(process.env.LOCALAPPDATA,'minnade-release-private','release52');
function secureString(value,decrypt=false){
 const script=decrypt?"$s=[Console]::In.ReadToEnd().Trim() | ConvertTo-SecureString; [Console]::Out.Write(([System.Net.NetworkCredential]::new('', $s)).Password)":"$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force; [Console]::Out.Write((ConvertFrom-SecureString $s))";
 const r=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:value,encoding:'utf8',windowsHide:true,env:{...process.env,PSModulePath:path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/Modules')}});if(r.status!==0)throw Error('WINDOWS_PRIVATE_STORAGE_FAILED');return decrypt?r.stdout:r.stdout.trim();
}
function password(){const p=path.join(privateDir,'production-password.dpapi');if(!fs.existsSync(p))throw Error('PRODUCTION_DATABASE_PASSWORD_REQUIRED');return secureString(fs.readFileSync(p,'utf8'),true);}
function encryptionKey(){const p=path.join(privateDir,'backup-key.dpapi');if(!fs.existsSync(p))fs.writeFileSync(p,secureString(crypto.randomBytes(32).toString('base64')));const k=Buffer.from(secureString(fs.readFileSync(p,'utf8'),true),'base64');if(k.length!==32)throw Error('PRIVATE_KEY_INVALID');return k;}
function encrypt(bytes,key){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([Buffer.from('MVPBAK01'),iv,c.update(bytes),c.final(),c.getAuthTag()]);}
function decrypt(bytes,key){if(bytes.subarray(0,8).toString()!=='MVPBAK01')throw Error('BACKUP_FORMAT_REJECTED');const d=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(8,20));d.setAuthTag(bytes.subarray(-16));return Buffer.concat([d.update(bytes.subarray(20,-16)),d.final()]);}
function writeEncrypted(file,bytes,key){fs.writeFileSync(file,encrypt(Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes),key));}
function publicFailure(e){return {error: /^[A-Z0-9_]+$/.test(e.message||'')?e.message:'PRIVATE_OPERATION_FAILED',code:/^[A-Z0-9_]{2,40}$/.test(e.code||'')?e.code:undefined};}
module.exports={privateDir,password,encryptionKey,encrypt,decrypt,writeEncrypted,publicFailure};
