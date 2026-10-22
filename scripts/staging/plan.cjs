/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'supabase/migrations');
const files=fs.readdirSync(dir).filter(n=>/^202610\d{2}00\d\d_.*\.sql$/.test(n)).sort();
if(files.length!==28)throw Error('MIGRATION_INVENTORY_CHANGED');
const result={apply:false,requiresBaseline:true,warning:'001 requires existing app schema. Empty Supabase is NOT ready for 001.',
 migrations:files.map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex')}))};
console.log(JSON.stringify(result,null,2));
