/* eslint-disable @typescript-eslint/no-require-imports -- Offline input boundary tests. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('../node_modules/typescript');
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/uploadValidation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports,Uint8Array,TextDecoder});
const {validateUpload,MAX_UPLOAD_BYTES}=mod.exports;
let n=0;function check(value,label){assert.ok(value,label);console.log(++n+'. '+label);}
const bytes=s=>new TextEncoder().encode(s);
for(const [name,mime,data,ext] of [
 ['a.PNG','image/png',Uint8Array.from([137,80,78,71,13,10,26,10]),'png'],
 ['a.jpeg','image/jpeg',Uint8Array.from([255,216,255]),'jpg'],
 ['a.gif','image/gif',bytes('GIF89a'),'gif'],['a.webp','image/webp',bytes('RIFF0000WEBP'),'webp'],
 ['a.mp4','video/mp4',bytes('0000ftyp'),'mp4'],['a.webm','video/webm',Uint8Array.from([26,69,223,163]),'webm'],
 ['a.pdf','application/pdf',bytes('%PDF-1.7'),'pdf'],['a.txt','text/plain',bytes('日本語のテキスト'),'txt']]) {
 check(validateUpload(name,mime,data)?.ext===ext,'Supported header and MIME '+mime);
 check(!validateUpload(name,'application/octet-stream',data),'Wrong MIME '+mime);
 check(!validateUpload(name+'.exe',mime,data),'Executable extension '+mime);
}
for(const [name,mime,data] of [
 ['a.png','image/png',bytes('<script>alert(1)</script>')],['a.svg','image/svg+xml',bytes('<svg/>')],
 ['a.html','text/html',bytes('<html>')],['a.zip','application/zip',bytes('PK')],
 ['a.txt','text/plain',bytes('MZfake')],['a.txt','text/plain',Uint8Array.from([0,1])],
 ['a.txt','text/plain',Uint8Array.from([255,255])],['a.txt','text/plain',new Uint8Array()],
 ['a.txt','text/plain',new Uint8Array(MAX_UPLOAD_BYTES+1)],['a.jpg','image/jpeg',Uint8Array.from([255,216])]]) {
 check(!validateUpload(name,mime,data),'Reject invalid '+name+' ('+data.length+' bytes)');
}
check(!!validateUpload('a.txt','text/plain',new Uint8Array(MAX_UPLOAD_BYTES).fill(65)),'Exact 4MB text accepted');
console.log('Completed '+n+' upload validation checks. Header checks do not prove file safety or remove EXIF.');
