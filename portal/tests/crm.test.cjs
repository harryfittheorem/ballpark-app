const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
// Exercise the same TypeScript request handlers the Next routes export.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { localSQL, literal, fixtureLocation:L, fixtureTenant:T } = require('../lib/crm/local.ts');
const { makeCRMHandlers } = require('../lib/crm/http.ts');
const { processProviderRequest, twilioSignature, syntheticInbound, syntheticReceipt } = require('../lib/crm/provider.ts');
const { runAssistant, TransientModelError } = require('../lib/crm/engine.ts');
const U = '90000000-0000-0000-0000-000000000001';
const A = '70000000-0000-0000-0000-000000000001';
const B = '70000000-0000-0000-0000-000000000002';
const L2 = '20000000-0000-0000-0000-000000000002';
const SLOT1 = '80000000-0000-0000-0000-000000000001';
const SLOT2 = '80000000-0000-0000-0000-000000000002';
const ctx = {preview:true,userId:U,role:'owner',tenantId:T,locations:[{id:L,name:'Clearwater'}]};
const handlers=makeCRMHandlers(async()=>ctx);
let n=0;
const req=(body,location=L)=>new Request(`https://portal.test/api/crm?preview=1&location_id=${location}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);
const get=async()=>{ const r=await handlers.GET(req());assert.equal(r.status,200); return (await r.json()).state; };
async function act(kind,extra={},id=A,key=`test:${++n}`) {
 const s=await get(); const t=s.threads.find(t=>t.id===id);
 const command={kind,key,...(id?{thread_id:id,revision:t.revision}:{}),...extra};
 const r=await handlers.POST(req({command})); const json=await r.json();
 if(r.status!==200) throw new Error(json.error);
 return json.state;
}
async function expectFailure(kind,extra,pattern,id=A) { await assert.rejects(()=>act(kind,extra,id),pattern); }
async function patch(id,fields) {
 await localSQL(`UPDATE crm_threads SET data=data||${literal(fields)} WHERE id='${id}'; SELECT true;`);
}
before(()=>{
 execFileSync('python',['scripts/crm-preview.py','reset'],{cwd:path.resolve(__dirname,'../..'),stdio:'pipe'});
});

test('staff CRM application handlers and PostgreSQL transactional acceptance',async t=>{
 await t.test('real RLS and explicit location/role grants, not service identity',async()=>{
  const s=await get(); assert.equal(s.threads.length,2); assert.equal(s.slots.length,2);
  const denied=await handlers.GET(req(null,L2)); assert.equal(denied.status,403);
  await assert.rejects(()=>localSQL(`SELECT crm_snapshot('${L2}');`,ctx),/not authorized/);
  await assert.rejects(()=>localSQL(`SELECT crm_snapshot('${L}');`,{...ctx,role:'parent'}),/not authorized/);
  await assert.rejects(()=>localSQL(`SELECT crm_snapshot('${L}');`,{...ctx,tenantId:'10000000-0000-0000-0000-000000000002'}),/not authorized/);
  const count=await localSQL(`SELECT count(*) FROM crm_threads;`,ctx);assert.equal(count,2);
  await assert.rejects(()=>localSQL(`UPDATE crm_threads SET data='{}';`,ctx),/permission denied/);
 });
 await t.test('drafts/notes persist, stale revision and key collisions are rejected',async()=>{
  const before=await get(),thread=before.threads.find(t=>t.id===A);
  const cmd={kind:'save_sms',key:'stable-draft',thread_id:A,revision:thread.revision,text:'Draft preserved'};
  for(let i=0;i<2;i++)assert.equal((await handlers.POST(req({command:cmd}))).status,200);
  assert.equal((await get()).threads.find(t=>t.id===A).sms_draft,'Draft preserved');
  const conflict=await handlers.POST(req({command:{...cmd,text:'Different'}}));assert.equal(conflict.status,409);
  await act('note',{text:'Private coach context'});
  assert.equal((await get()).threads.find(t=>t.id===A).events.at(-1).kind,'private note');
  assert.equal((await handlers.POST(req({command:{...cmd,key:'stale'}}))).status,409);
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox;`),0);
 });
 await t.test('draft assistant can inspect but cannot book or send',async()=>{
  await act('assist');
  const s=await get(); const a=s.threads.find(t=>t.id===A);
  assert.match(a.sms_draft,/Available evaluations/);
  assert.equal(a.booking,null);
  await expectFailure('book',{source:'agent',slot_id:SLOT1},/Delegated authority denied/);
  await expectFailure('send',{source:'agent',text:'Hello'},/Delegated authority denied/);
  await expectFailure('call',{source:'agent'},/Assistant action not authorized/);
  await expectFailure('send',{text:'Hello {{parent}}'},/unresolved SMS/);
 });
 await t.test('signed duplicate inbound, signature and destination denial; STOP persists over replies',async()=>{
  await syntheticInbound(L,'+15005550102','STOP','duplicate-stop');
  await syntheticInbound(L,'+15005550102','STOP','duplicate-stop');
  let s=await get(); assert.equal(s.threads.find(t=>t.id===B).hold,'STOP');
  assert.equal(await localSQL(`SELECT count(*) FROM crm_provider_events WHERE provider_sid='SIM-IN-duplicate-stop';`),1);
  await syntheticInbound(L,'+15005550102','Actually hello again','after-stop');
  s=await get();assert.equal(s.threads.find(t=>t.id===B).hold,'STOP');
  const url='https://crm.synthetic.invalid/api/crm/provider?preview=1';
  const invalid=new Request(url,{method:'POST',body:new URLSearchParams({AccountSid:'AC_SYNTH_CLEARWATER',From:'+15005550102',To:'+15005550006',Body:'Hello',MessageSid:'bad'})});
  assert.equal((await processProviderRequest(invalid,true)).status,403);
  const secret=fs.readFileSync(path.resolve(__dirname,'../../generated-artifacts/crm-preview/signing-key'),'utf8');
  const form=new URLSearchParams({AccountSid:'AC_SYNTH_CLEARWATER',From:'+15005550102',To:'+15005550007',Body:'Hello',MessageSid:'wrong'});
  assert.equal((await processProviderRequest(new Request(url,{method:'POST',body:form,headers:{'x-twilio-signature':twilioSignature(url,form,secret)}}),true)).status,403);
  await expectFailure('consent',{text:'A new reply is not re-opt-in'},/STOP/,B);
 });
 await t.test('queued STOP and takeover suppress dispatch, ambiguity/missing permission fail closed',async()=>{
  await act('send',{text:'Will never leave queue'},B);
  await act('dispatch',{},B);
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox WHERE thread_id='${B}' AND status='suppressed' AND reason='STOP suppression';`),1);
  await patch(B,{hold:null,consent:false,verified:false});
  await act('send',{text:'Ambiguous'},B);await act('dispatch',{},B);
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox WHERE thread_id='${B}' AND reason='Guardian unresolved';`),1);
  await patch(B,{verified:true});await act('send',{text:'Missing permission'},B);await act('dispatch',{},B);
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox WHERE thread_id='${B}' AND reason='Missing SMS inquiry consent';`),1);
  await patch(B,{consent:true});
  await act('workflow',{text:'Approved follow up',delay_minutes:1,enabled:true,authority:'delegated'},null);
  await act('send',{text:'Queued agent reply',source:'agent'},B);
  await act('takeover',{},B);
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox WHERE thread_id='${B}' AND reason='Staff takeover';`),1);
  await syntheticInbound(L,'+15005550102','Hello after takeover','after-takeover');
  assert.equal((await get()).threads.find(t=>t.id===B).hold,'human');
 });
 await t.test('a new endpoint requires explicit guardian resolution without creating a member or consent',async()=>{
  const families=await localSQL('SELECT count(*) FROM families;');
  await syntheticInbound(L,'+15005550115','Could you tell me about evaluations?','new-prospect');
  await syntheticInbound(L,'+15005550115','Could you tell me about evaluations?','new-prospect');
  const prospective=(await get()).threads.filter(t=>t.phone==='+15005550115');
  assert.equal(prospective.length,1);assert.equal(prospective[0].verified,false);assert.equal(prospective[0].consent,false);
  await act('resolve',{text:'Staff confirmed guardian identity on an inbound call',parent_name:'Verified new parent',
   athlete_name:'New athlete',athlete_age:10,recipient_timezone:'America/New_York'},prospective[0].id);
  const resolved=(await get()).threads.find(t=>t.id===prospective[0].id);
  assert.equal(resolved.verified,true);assert.equal(resolved.athlete,'New athlete');assert.equal(resolved.consent,false);
  assert.equal(await localSQL('SELECT count(*) FROM families;'),families);
 });
 await t.test('one callback with due time and last question; unanswered facility call stays due',async()=>{
  await act('callback',{text:'Parent asks for coach'},B);
  const id=(await get()).threads.find(t=>t.id===B).callback.id;
  await act('callback',{text:'Repeated callback request'},B);
  assert.equal((await get()).threads.find(t=>t.id===B).callback.id,id);
  assert.equal((await get()).threads.find(t=>t.id===B).callback.reason,'Repeated callback request');
  await act('call',{},B);
  await act('call_outcome',{outcome:'no-answer'},B);
  const b=(await get()).threads.find(t=>t.id===B);
  assert.equal(b.callback.status,'due');assert.ok(b.callback.question);assert.ok(b.callback.due);
  assert.match(b.events.find(e=>e.kind==='call').body,/\+15005550006/);
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox WHERE purpose='call';`),1);
  const call=await localSQL(`SELECT to_jsonb(o) FROM crm_outbox o WHERE purpose='call' LIMIT 1;`);
  for(const status of ['ringing','completed','no-answer']) await syntheticReceipt(L,'+15005550102',call.provider_sid,status,true);
  assert.equal(await localSQL(`SELECT to_jsonb(status) FROM crm_outbox WHERE id='${call.id}';`),'no-answer');
  assert.equal((await get()).threads.find(t=>t.id===B).callback.status,'due');
 });
 await t.test('two families race for the final slot; one native booking, no enrollment',async()=>{
  await patch(B,{hold:null});
  const s=await get();const a=s.threads.find(t=>t.id===A),b=s.threads.find(t=>t.id===B);
  const attempts=await Promise.all([a,b].map(th=>handlers.POST(req({command:{kind:'book',key:'race:'+th.id,thread_id:th.id,revision:th.revision,slot_id:SLOT1}}))));
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  assert.equal(await localSQL(`SELECT count(*) FROM bookings WHERE crm_prospect_id IS NOT NULL;`),1);
  assert.equal(await localSQL(`SELECT count(*) FROM memberships;`),1);
  assert.equal(await localSQL(`SELECT count(*) FROM crm_reminder_intents;`),1);
 });
 await t.test('commit then lost response reconciles same intent; late competing draft cannot reserve twice',async()=>{
  const s=await get();const booked=s.threads.find(t=>t.booking),other=s.threads.find(t=>!t.booking);
  const bid=booked.booking.id;
  await act('book',{slot_id:SLOT2},booked.id); // other channel converges
  await act('reconcile',{},booked.id);
  assert.equal((await get()).threads.find(t=>t.id===booked.id).booking.id,bid);
  assert.equal(await localSQL(`SELECT count(*) FROM bookings WHERE crm_prospect_id='${booked.id}';`),1);
  assert.equal((await get()).threads.find(t=>t.id===booked.id).nurture.status,'stopped');
  await act('book',{slot_id:SLOT2},other.id);
  assert.equal(await localSQL(`SELECT count(*) FROM bookings WHERE crm_prospect_id IS NOT NULL;`),2);
  await localSQL(`UPDATE bookings SET scheduled_start=scheduled_start+interval '7 days',scheduled_end=scheduled_end+interval '7 days' WHERE id='${bid}'; SELECT true;`);
  assert.equal(await localSQL(`SELECT revision FROM crm_reminder_intents WHERE booking_id='${bid}';`),2);
  assert.equal((await get()).threads.find(t=>t.id===booked.id).nurture.status,'stopped');
 });
 await t.test('provider acceptance is not delivery; reordered/conflicting receipts retain evidence',async()=>{
  await act('send',{text:'Committed evaluation confirmation'});
  await act('dispatch');
  const rows=await localSQL(`SELECT to_jsonb(o) FROM crm_outbox o WHERE thread_id='${A}' AND status='accepted' LIMIT 1;`);
  assert.ok(rows);assert.ok(rows.provider_sid);
  for(const status of ['delivered','sent','failed','delivered']){
   await syntheticReceipt(L,'+15005550101',rows.provider_sid,status);
  }
  assert.equal(await localSQL(`SELECT to_jsonb(status) FROM crm_outbox WHERE id='${rows.id}';`),'delivered');
  assert.equal(await localSQL(`SELECT count(*) FROM crm_provider_events WHERE provider_sid='${rows.provider_sid}';`),3);
 });
 await t.test('missing provider preserves draft; unknown sends are not retried on recovery',async()=>{
  await localSQL(`UPDATE crm_locations SET connection='missing' WHERE location_id='${L}'; SELECT true;`);
  await act('send',{text:'Offline draft'});await act('dispatch');
  assert.equal((await get()).threads.find(t=>t.id===A).sms_draft,'Offline draft');
  await localSQL(`UPDATE crm_locations SET connection='simulated' WHERE location_id='${L}'; UPDATE crm_outbox SET status='unknown' WHERE body='Offline draft'; SELECT true;`);
  await act('dispatch');
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox WHERE body='Offline draft' AND status='unknown';`),1);
 });
 await t.test('controlled delegated journey requires parent selection and confirms committed state once',async()=>{
  await syntheticInbound(L,'+15005550104','Thursday after 5 for my child','delegated-inquiry');
  const newThread=(await get()).threads.find(t=>t.phone==='+15005550104');
  assert.equal(newThread.consent,false);assert.equal(newThread.verified,false);
  await act('resolve',{text:'Synthetic guardian verified by staff',recipient_timezone:'America/New_York'},newThread.id);
  await act('consent',{text:'Synthetic SMS inquiry consent',channel:'sms'},newThread.id);
  await act('offer_slots',{},newThread.id);
  await act('select_slot',{slot_id:SLOT1},newThread.id);
  await act('assist',{},newThread.id);
  const after=(await get()).threads.find(t=>t.id===newThread.id);
  assert.ok(after.booking);assert.equal(after.nurture.status,'stopped');
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox WHERE thread_id='${newThread.id}' AND purpose='confirmation';`),1);
  assert.equal(await localSQL(`SELECT count(*) FROM bookings WHERE crm_prospect_id='${newThread.id}';`),1);
 });
 await t.test('canonical online evaluation stops nurture without CRM reservation; internal rule never contacts parents',async()=>{
  await localSQL(`INSERT INTO families VALUES('30000000-0000-0000-0000-000000000004','${T}',NULL,'${L}');
   INSERT INTO kids(id,family_id,first_name,last_name) VALUES('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004','Online','Athlete');
   ALTER TABLE memberships ADD COLUMN next_billing_at timestamptz;
   INSERT INTO memberships(tenant_id,kid_id,status,next_billing_at) VALUES('${T}','40000000-0000-0000-0000-000000000004','active',now()+interval '9 days');
   SELECT true;`);
  await syntheticInbound(L,'+15005550105','Online evaluation inquiry','online-inquiry');
  const th=(await get()).threads.find(t=>t.phone==='+15005550105');
  await act('resolve',{text:'Synthetic canonical guardian verified',verified_family_id:'30000000-0000-0000-0000-000000000004',verified_kid_id:'40000000-0000-0000-0000-000000000004'},th.id);
  // Canonical scheduler insert equivalent to an already committed online path.
  await localSQL(`INSERT INTO bookings(tenant_id,location_id,kid_id,coach_id,session_type_id,scheduled_start,scheduled_end,cage_number,status)
    SELECT '${T}','${L}','40000000-0000-0000-0000-000000000004',coach_id,session_type_id,starts_at+interval '21 days',ends_at+interval '21 days',cage_number,'confirmed'
    FROM crm_evaluation_openings WHERE id='${SLOT1}'; SELECT true;`);
  assert.equal((await get()).threads.find(t=>t.id===th.id).nurture.status,'stopped');
  const before=await localSQL(`SELECT count(*) FROM crm_outbox;`);
  let s=await act('reevaluate',{},null);
  assert.equal(s.internal_tasks.length,1);
  assert.equal(await localSQL(`SELECT count(*) FROM crm_outbox;`),before);
  const task=s.internal_tasks[0];
  s=await act('reevaluate',{task_id:task.id},null);
  assert.equal(s.internal_tasks[0].status,'complete');
  s=await act('reevaluate',{},null);
  assert.equal(s.internal_tasks.length,1);assert.equal(s.internal_tasks[0].status,'complete');
 });
 await t.test('canonical cancellation updates the thread and reminder without restarting sales',async()=>{
  const s=await get();const t=s.threads.find(t=>t.phone==='+15005550104');const count=await localSQL('SELECT count(*) FROM crm_outbox;');
  await localSQL(`UPDATE bookings SET status='cancelled' WHERE id='${t.booking.id}'; SELECT true;`);
  const updated=(await get()).threads.find(x=>x.id===t.id);
  assert.equal(updated.booking.status,'cancelled');assert.equal(updated.nurture.status,'stopped');assert.equal(updated.selection,null);
  assert.equal(await localSQL(`SELECT to_jsonb(status) FROM crm_reminder_intents WHERE booking_id='${t.booking.id}';`),'cancelled');
  assert.equal(await localSQL('SELECT count(*) FROM crm_outbox;'),count);
 });
 await t.test('ordinary appointments are never adopted as evaluations; real online evaluations recover without duplication',async()=>{
  const kid='40000000-0000-0000-0000-000000000002',family='30000000-0000-0000-0000-000000000001';
  const selection='80000000-0000-0000-0000-000000000017';
  await localSQL(`INSERT INTO crm_evaluation_openings(id,tenant_id,location_id,coach_id,session_type_id,cage_number,starts_at,ends_at)
   SELECT '${selection}',tenant_id,location_id,coach_id,session_type_id,cage_number,starts_at+interval '7 days',ends_at+interval '7 days'
   FROM crm_evaluation_openings WHERE id='${SLOT2}'; SELECT true;`);
  assert.equal(await localSQL(`SELECT count(*) FROM memberships WHERE kid_id='${kid}' AND status='active';`),0);
  const ordinary=await localSQL(`WITH inserted AS (INSERT INTO bookings(tenant_id,location_id,kid_id,coach_id,session_type_id,scheduled_start,scheduled_end,cage_number,status)
   SELECT tenant_id,location_id,'${kid}',coach_id,'60000000-0000-0000-0000-000000000001',starts_at+interval '1 hour',starts_at+interval '2 hours',cage_number,'confirmed'
   FROM crm_evaluation_openings WHERE id='${selection}' RETURNING *) SELECT to_jsonb(inserted) FROM inserted;`);
  await syntheticInbound(L,'+15005550117','Thursday evaluation please','ordinary-appointment-regression');
  const prospect=(await get()).threads.find(t=>t.phone==='+15005550117');
  await act('resolve',{text:'Synthetic staff guardian and selected sibling verified',verified_family_id:family,verified_kid_id:kid},prospect.id);
  const reserved=await act('book',{slot_id:selection},prospect.id);
  const result=reserved.threads.find(t=>t.id===prospect.id),slot=reserved.slots.find(s=>s.id===selection);
  assert.notEqual(result.booking.id,ordinary.id);
  assert.equal(Date.parse(result.booking.starts_at),Date.parse(slot.starts_at));
  assert.match(result.sms_draft,/18:30/);assert.doesNotMatch(result.sms_draft,/19:30/);
  assert.equal(await localSQL(`SELECT to_jsonb(session_type_id) FROM bookings WHERE id='${result.booking.id}';`),'60000000-0000-0000-0000-000000000004');
  assert.equal(await localSQL(`SELECT to_jsonb(status) FROM bookings WHERE id='${ordinary.id}';`),'confirmed');
  // Replace the cancelled prospect reservation with a genuine canonical
  // online-equivalent evaluation (no CRM prospect ID), then recover it.
  await localSQL(`UPDATE bookings SET status='cancelled' WHERE id='${result.booking.id}'; SELECT true;`);
  const online=await localSQL(`WITH inserted AS (INSERT INTO bookings(tenant_id,location_id,kid_id,coach_id,session_type_id,scheduled_start,scheduled_end,cage_number,status)
   SELECT tenant_id,location_id,'${kid}',coach_id,session_type_id,starts_at,ends_at,cage_number,'confirmed'
   FROM crm_evaluation_openings WHERE id='${selection}' RETURNING *) SELECT to_jsonb(inserted) FROM inserted;`);
  const count=await localSQL('SELECT count(*) FROM bookings;');
  const recovered=(await act('book',{slot_id:selection},prospect.id)).threads.find(t=>t.id===prospect.id);
  assert.equal(recovered.booking.id,online.id);assert.equal(recovered.nurture.status,'stopped');
  assert.equal(await localSQL('SELECT count(*) FROM bookings;'),count);
  assert.equal(online.crm_prospect_id,null);
 });
 await t.test('PostgreSQL restart preserves bookings, suppression, ledger and drafts',async()=>{
  const count=await localSQL(`SELECT count(*) FROM bookings;`);
  execFileSync('python',['scripts/crm-preview.py','stop'],{cwd:path.resolve(__dirname,'../..'),stdio:'pipe'});
  execFileSync('python',['scripts/crm-preview.py'],{cwd:path.resolve(__dirname,'../..'),stdio:'pipe'});
  assert.equal(await localSQL(`SELECT count(*) FROM bookings;`),count);
  assert.equal((await get()).threads.find(t=>t.id===A).sms_draft,'Offline draft');
  assert.ok(await localSQL(`SELECT count(*) FROM crm_actions;`)>10);
 });
});

test('bounded model loop retries model only and hands off exhaustion',async()=>{
 const state=await get(), id=A;
 let requests=0,actions=[];
 const fixture=structuredClone(state);fixture.threads.find(t=>t.id===id).hold=null;
 const apply=async c=>{actions.push(c);return fixture;};
 await runAssistant(fixture,id,'transient',async input=>{assert.equal(input.thread.events.some(e=>e.kind==='private note'),false);requests++;if(requests===1)throw new TransientModelError('temporary');return{type:'reply',text:'Review this draft'};},apply);
 assert.equal(requests,2);assert.equal(actions.filter(a=>a.kind==='save_sms').length,1);
 actions=[];requests=0;
 await runAssistant(fixture,id,'limit',async()=>{requests++;return{type:'tool',name:'find_available_slots',args:{}};},apply);
 assert.equal(requests,6);assert.equal(actions.at(-1).kind,'callback');
 assert.match(actions.at(-1).text,/Six-iteration/);
 actions=[];
 await runAssistant(fixture,id,'unknown',async()=>{throw new Error('unavailable');},apply);
 assert.equal(actions.at(-1).kind,'callback');
});
