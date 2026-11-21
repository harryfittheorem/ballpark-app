/**
 * Reconcile the supplied export using the actual authenticated portal API.
 * Run with node --experimental-websocket --env-file=portal/.env.local scripts/import-trainual-development.mjs [--import]
 * Runtime credentials and session cookies are never printed or written.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../portal/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(new URL(url).hostname!=='exjcwvvglthnxerzpukw.supabase.co')throw new Error('Unexpected database target');
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const tenantId='00000000-0000-0000-0000-000000000001';
const {data:tenant,error:te}=await db.from('tenants').select('name,slug').eq('id',tenantId).single();
if(te || tenant?.name!=='Infinite Hitting' || tenant.slug!=='infinitehitting')throw new Error('Tenant verification failed');
const {data:before,error:be}=await db.from('training_courses').select('id,source_id,updated_at,published_version').eq('tenant_id',tenantId);
if(be)throw new Error('Could not inventory existing courses');
console.log({project:'ballpark-app development',tenant:tenant.name,existingCourses:before.length});
// Use only the existing demo review owner, never impersonate a real staff member.
const {data:link,error:le}=await db.auth.admin.generateLink({type:'magiclink',email:'demo.owner.review@ballpark.test'});
if(le || link.user.user_metadata.tenant_slug!==tenant.slug || link.user.user_metadata.app_role!=='owner')throw new Error('Demo review owner unavailable');
const jar=new Map();
const auth=createServerClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
const {error:ae}=await auth.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});
if(ae)throw new Error('Demo session verification failed');
const origin=`https://${process.env.REPLIT_DEV_DOMAIN}`;
async function api(path,body){
 const r=await fetch(origin+'/api/training/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:[...jar].map(([n,v])=>`${n}=${v}`).join('; ')},body:JSON.stringify(body)});
 const result=await r.json();if(!r.ok)throw new Error(`Training API ${r.status}: ${result.error}`);return result;
}
const jsonPath='attached_assets/infinite-hitting-trainual-export_1795241377259.json';
const mdPath='attached_assets/infinite-hitting-trainual-export_1795241377262.md';
const body={trainualExport:readFileSync(jsonPath,'utf8'),companionMarkdown:readFileSync(mdPath,'utf8'),jsonFilename:basename(jsonPath),markdownFilename:basename(mdPath)};
const stage=await api('migrations',body);console.log({stage});
if(process.argv.includes('--import')) {
 console.log({import:await api(`migrations/${stage.id}`,{action:'import',reviewLinkedMedia:true})});
 console.log({repeat:await api(`migrations/${stage.id}`,{action:'import',reviewLinkedMedia:true})});
}
const repeated=await api('migrations',body);
if(repeated.id!==stage.id)throw new Error('Repeated staging created a duplicate');
const changed=JSON.parse(body.trainualExport);changed.subjects[0].title+=' changed';const changedMd=body.companionMarkdown.replace('## Subject 1: Welcome to the Company','## Subject 1: Welcome to the Company changed');
if(process.argv.includes('--import')) {
 let conflict=false;try{await api('migrations',{...body,trainualExport:JSON.stringify(changed),companionMarkdown:changedMd});}catch(e){conflict=String(e).includes('409');}
 if(!conflict)throw new Error('Changed-source conflict was not rejected');
}
const {data:after,error:ce}=await db.from('training_courses').select('id,source_id,updated_at,published_version,draft').eq('tenant_id',tenantId);
if(ce)throw new Error('Post-import verification failed');
for(const c of before.filter(c=>!c.source_id?.startsWith('trainual-infinite-hitting-export:'))) {
 const a=after.find(a=>a.id===c.id);if(!a || a.updated_at!==c.updated_at || a.published_version!==c.published_version)throw new Error('Existing course changed');
}
const imported=after.filter(c=>c.source_id?.startsWith('trainual-infinite-hitting-export:'));
if(imported.some(c=>c.published_version!==null))throw new Error('Import unexpectedly published content');
console.log({imported:imported.map(c=>({id:c.id,title:c.draft.title,topics:new Set(c.draft.lessons.map(l=>l.sectionId)).size,steps:c.draft.lessons.length,videos:c.draft.lessons.flatMap(l=>l.references||[]).filter(r=>r.kind==='video').length,tests:c.draft.sourceReview.tests.length})),preview:origin+'/training'});
await auth.auth.signOut();
