/** Render a private, reviewed schema-only staging candidate. Never reads app rows or credentials. */
const q=x=>'"'+String(x).replace(/"/g,'""')+'"',lit=x=>"'"+String(x).replace(/'/g,"''")+"'";
module.exports=function render(m,extra){
 const out=['SET LOCAL check_function_bodies=off;'];
 for(const name of new Set(m.enums.map(x=>x.type)))out.push('CREATE TYPE public.'+q(name)+' AS ENUM ('+m.enums.filter(x=>x.type===name).sort((a,b)=>a.order-b.order).map(x=>lit(x.label)).join(',')+');');
 for(const s of extra.sequences){
  if(!['bigint','integer','smallint'].includes(s.type))throw Error('SEQUENCE_TYPE_REVIEW');
  out.push('CREATE SEQUENCE public.'+q(s.name)+' AS '+s.type+' INCREMENT BY '+s.increment+' MINVALUE '+s.min+' NO MAXVALUE '+' START WITH '+s.start+' CACHE '+s.cache+(s.cycle?' CYCLE':' NO CYCLE')+';');
 }
 for(const table of new Set(m.columns.map(x=>x.table))){
  const cols=m.columns.filter(x=>x.table===table).map(x=>{
   if(x.identity||x.generated)throw Error('GENERATED_COLUMN_REVIEW_REQUIRED');
   return q(x.column)+' '+x.type+(x.default?' DEFAULT '+x.default:'')+(x.not_null?' NOT NULL':'');
  });
  out.push('CREATE TABLE public.'+q(table)+'('+cols.join(',')+');');
 }
 for(const x of [...m.constraints].sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY'))))out.push('ALTER TABLE public.'+q(x.table)+' ADD CONSTRAINT '+q(x.name)+' '+x.definition+';');
 const constraints=new Set(m.constraints.map(x=>x.name));
 for(const x of m.indexes)if(!constraints.has(x.name))out.push(x.definition+';');
 for(const x of m.functions)out.push(x.definition+';');
 for(const x of [...m.triggers,...extra.auth_app_triggers]){
  if(x.enabled!=='O')throw Error('TRIGGER_STATE_REVIEW_REQUIRED');
  out.push(x.definition+';');
 }
 for(const x of m.views)out.push('CREATE VIEW public.'+q(x.name)+(x.options?.length?' WITH ('+x.options.join(',')+')':'')+' AS '+x.definition);
 for(const s of extra.sequence_ownership)out.push('ALTER SEQUENCE public.'+q(s.sequence)+' OWNED BY public.'+q(s.table)+'.'+q(s.column)+';');
 // Keep the audited public policies for compatibility checks but close all client grants.
 // Storage is a managed service: never copy or alter its objects/policies here.
 for(const p of extra.policies.filter(x=>x.schema==='public')){
  if(!['ALL','SELECT','INSERT','UPDATE','DELETE'].includes(p.command)||!['PERMISSIVE','RESTRICTIVE'].includes(p.permissive))throw Error('POLICY_REVIEW_REQUIRED');
  out.push('CREATE POLICY '+q(p.name)+' ON public.'+q(p.table)+' AS '+p.permissive+' FOR '+p.command+' TO '+p.roles.map(q).join(',')+(p.using?' USING ('+p.using+')':'')+(p.check?' WITH CHECK ('+p.check+')':'')+';');
 }
 for(const table of new Set(m.columns.map(x=>x.table)))out.push('ALTER TABLE public.'+q(table)+' ENABLE ROW LEVEL SECURITY;');
 out.push('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;',
 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated;',
 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;',
 'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;',
 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;');
 return out.join('\n');
};
