/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const digest=b=>crypto.createHash("sha256").update(b).digest("hex");
function inventory(){
 const map=JSON.parse(fs.readFileSync(path.join(root,"docs/v2-rc-migration-map.json")));
 const files=fs.readdirSync(path.join(root,"supabase/migrations")).filter(x=>x.endsWith(".sql")).sort();
 assert.deepEqual(files,map.entries.map(x=>x.file).sort(),"UNREGISTERED_MIGRATION");
 assert.equal(new Set(map.entries.map(x=>x.number)).size,files.length,"DUPLICATE_NUMBER");
 for(const e of map.entries)assert.equal(digest(fs.readFileSync(path.join(root,"supabase/migrations",e.file))),e.sha256,"MIGRATION_BYTES_CHANGED_"+e.file);
 return map.entries.sort((a,b)=>a.number-b.number);
}
async function applyLocal(db,report){
 assert.equal(db.connectionParameters.host,"127.0.0.1","LOCAL_DATABASE_ONLY");
 assert.equal(db.connectionParameters.user,"fixture_admin","FIXTURE_DATABASE_ONLY");
 const entries=inventory();
 // Explicit local contract doubles: no HTTP, cron worker, Vault encryption, or managed ACL installation.
 await db.query(fs.readFileSync(path.join(__dirname,"platform-contracts.sql"),"utf8"));
 await db.query("CREATE SCHEMA rc_history; CREATE TABLE rc_history.migrations(number integer PRIMARY KEY,file text UNIQUE NOT NULL,sha256 text NOT NULL)");
 report.platform={kind:"local SQL contract doubles",extensions:["pg_cron","pg_net","http","vault"],realNetworkCalls:0,managedExtensionInstallation:"NOT_TESTED"};
 for(const e of entries){
  let sql=fs.readFileSync(path.join(root,"supabase/migrations",e.file),"utf8");
  const directives=sql.match(/^CREATE EXTENSION IF NOT EXISTS .+;$/gm)||[];
  for(const d of directives)assert.match(d,/^CREATE EXTENSION IF NOT EXISTS (pg_cron|pg_net|http WITH SCHEMA extensions);$/);
  sql=sql.replace(/^CREATE EXTENSION IF NOT EXISTS .+;\r?$/gm,"-- managed extension supplied by explicit local contract fixture");
  try{await db.query(sql);}catch(error){error.migration=e.file;throw error;}
  await db.query("INSERT INTO rc_history.migrations VALUES($1,$2,$3)",[e.number,e.file,e.sha256]);
  report.migrations.push({file:e.file,sha256:e.sha256,extensionContractSubstitutions:directives.length});
 }
 await assert.rejects(db.query("INSERT INTO rc_history.migrations SELECT * FROM rc_history.migrations LIMIT 1"),{code:"23505"});
 report.checks.push({name:"canonical history rejects duplicate migration number/file",pass:true});
 return entries;
}
module.exports={inventory,applyLocal,digest};
