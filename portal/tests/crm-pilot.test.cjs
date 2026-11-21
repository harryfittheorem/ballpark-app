const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { localSQL, localExecute, localSnapshot, literal, fixtureLocation:L, fixtureTenant:T } = require('../lib/crm/local.ts');
const { processProviderRequest, twilioSignature, localSigner } = require('../lib/crm/provider.ts');
const { sendPilotClaim } = require('../lib/crm/pilotTransport.ts');
const { drainPilotLocation } = require('../lib/crm/pilot.ts');
const OWNER='90000000-0000-0000-0000-000000000001';
const ADMIN='90000000-0000-0000-0000-000000000004';
const actor={userId:ADMIN,role:'admin',tenantId:T};
const owner={userId:OWNER,role:'owner',tenantId:T};
const sender='+15005550006', handset='+15005550115';
const phone=i=>'+150055502'+String(i).padStart(2,'0');
let sequence=0;
const manage=(action,payload={},who=actor)=>localSQL(
  `SELECT crm_pilot_manage('${L}',${literal(action)}#>>'{}',${literal(payload)});`,who);
async function thread(i) {
  const id=`71000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
  await localSQL(`INSERT INTO crm_threads(id,tenant_id,location_id,phone,data)
    SELECT '${id}',tenant_id,location_id,${literal(phone(i))}#>>'{}',
    data||'{"revision":0,"booking":null,"callback":null,"events":[],"hold":null,"sms_draft":""}'
    FROM crm_threads WHERE id='70000000-0000-0000-0000-000000000001'; SELECT true;`);
  return id;
}
async function action(id,kind,extra={}) {
  const state=await localSnapshot(L,actor), target=state.threads.find(t=>t.id===id);
  return localExecute(L,{kind,key:'pilot-test:'+ ++sequence,thread_id:id,revision:target.revision,...extra},actor);
}
const prepare=()=>localSQL(`SELECT crm_pilot_prepare('${L}',NULL,true);`);
const begin=id=>localSQL(`SELECT crm_pilot_begin('${id}');`);
const finish=(id,result)=>localSQL(`SELECT crm_pilot_finish('${id}',${literal(result)}); SELECT true;`);
async function signed(form,attempt,leg) {
  const url=new URL('https://crm.synthetic.invalid/api/crm/provider?preview=1');
  if(attempt){url.searchParams.set('dispatch_id',attempt);url.searchParams.set('leg',leg);}
  const params=new URLSearchParams({AccountSid:'AC_SYNTH_CLEARWATER',...form});
  return processProviderRequest(new Request(url,{method:'POST',body:params,
    headers:{'x-twilio-signature':twilioSignature(url.toString(),params,await localSigner())}}),true);
}
before(async()=>{
  execFileSync('python',['scripts/crm-preview.py','reset'],{stdio:'pipe'});
  await localSQL(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES('${ADMIN}','{"app_role":"admin","tenant_slug":"one"}');
    INSERT INTO staff_locations VALUES('${ADMIN}','${L}');
    UPDATE crm_locations SET dispatch_policy=dispatch_policy||'{"start_hour":0,"end_hour":24}' WHERE location_id='${L}';
    SELECT true;`);
});
test('staff-only pilot guards and durable provider evidence',async t=>{
  await t.test('uses real admin role and explicit location grant; only owner configures, operator starts',async()=>{
    await assert.rejects(()=>manage('configure',{},actor),/Owner configuration/);
    await assert.rejects(()=>manage('configure',{operator_id:ADMIN,approved_numbers:[sender,phone(1)],approval:'test'}, {...owner,role:'coach'}),/not authorized/);
    await manage('configure',{operator_id:ADMIN,staff_handset:handset,
      approved_numbers:[sender,handset,...Array.from({length:10},(_,i)=>phone(i+1))],
      approval:'Synthetic staff-only pilot; synthetic dedicated sender; no real contacts'},owner);
    await assert.rejects(()=>manage('start',{confirm:'STAFF ONLY'},owner),/Designated operator/);
    await manage('start',{confirm:'STAFF ONLY'});
    const forbidden={kind:'send',key:'wrong-operator',thread_id:'70000000-0000-0000-0000-000000000001',revision:0,text:'Do not queue'};
    await assert.rejects(()=>localExecute(L,forbidden,owner),/Designated staff operator/);
    await assert.rejects(()=>localExecute(L,{...forbidden,source:'agent'},actor),/Designated staff operator/);
    await assert.rejects(()=>localSQL(`SELECT crm_pilot_status('20000000-0000-0000-0000-000000000002');`,actor),/not authorized/);
  });
  await t.test('signed staff-only inbound deduplicates and denies an unapproved origin',async()=>{
    const data={From:phone(1),To:sender,Body:'Hello',MessageSid:'SIM-PILOT-IN-1'};
    assert.equal((await signed(data)).status,200);
    assert.equal((await signed(data)).status,200);
    assert.equal(await localSQL(`SELECT count(*) FROM crm_threads WHERE phone='${phone(1)}';`),1);
    assert.equal((await signed({...data,From:'+15005550999',MessageSid:'DENIED'})).status,403);
    await localSQL(`DELETE FROM crm_threads WHERE phone='${phone(1)}'; SELECT true;`);
  });
  await t.test('pause/restart-safe prepared work rechecks eligibility and never begins twice',async()=>{
    const id=await thread(1);
    await action(id,'send',{text:'Reviewed staff test reply'});
    let ids=await prepare();assert.equal(ids.length,1);
    assert.deepEqual(await prepare(),ids); // crash before begin is recoverable
    await manage('pause');
    assert.equal(await begin(ids[0]),null);
    assert.equal(await localSQL(`SELECT to_jsonb(status) FROM crm_outbox WHERE thread_id='${id}';`),'held');
    await manage('resume',{confirm:'STAFF ONLY'});
    ids=await prepare();
    assert.equal(ids.length,1);
    const claim=await begin(ids[0]);assert.equal(claim.recipient,phone(1));
    assert.equal(await begin(ids[0]),null);
    assert.equal((await prepare()).length,0); // unknown cannot be retried
    const receipt={From:sender,To:phone(1),MessageSid:'SIM-SMS-ONE',MessageStatus:'delivered'};
    const [, firstReceipt] = await Promise.all([
      finish(ids[0],{status:'accepted',provider_sid:'SIM-SMS-ONE',reason:'Simulated acceptance, not delivery'}),
      signed(receipt,ids[0],'sms'),
    ]);
    assert.equal(firstReceipt.status,200);
    assert.equal((await signed(receipt,ids[0],'sms')).status,200);
    assert.equal((await signed({...receipt,MessageStatus:'sent'},ids[0],'sms')).status,200);
    assert.equal(await localSQL(`SELECT to_jsonb(status) FROM crm_outbox WHERE thread_id='${id}';`),'delivered');
  });
  await t.test('STOP, disconnect and takeover survive a later inbound and database restart',async()=>{
    const id=await thread(2);
    await action(id,'takeover');
    assert.equal((await signed({From:phone(2),To:sender,Body:'Hello again',MessageSid:'TAKEOVER-IN'})).status,200);
    assert.equal((await localSnapshot(L,actor)).threads.find(t=>t.id===id).hold,'human');
    await manage('disconnect',{},owner);
    assert.equal((await signed({From:phone(2),To:sender,Body:'STOP',MessageSid:'STOP-IN'})).status,200);
    assert.equal((await signed({From:phone(2),To:sender,Body:'Hello later',MessageSid:'AFTER-STOP'})).status,200);
    await manage('restore',{},owner);
    execFileSync('python',['scripts/crm-preview.py','stop'],{stdio:'pipe'});
    execFileSync('python',['scripts/crm-preview.py'],{stdio:'pipe'});
    const restored=(await localSnapshot(L,actor)).threads.find(t=>t.id===id);
    assert.equal(restored.hold,'STOP');assert.equal(restored.consent,false);
    await manage('resume',{confirm:'STAFF ONLY'});
    await action(id,'send',{text:'Must remain suppressed'});
    await prepare();
    assert.equal(await localSQL(`SELECT to_jsonb(status) FROM crm_outbox WHERE thread_id='${id}';`),'suppressed');
  });
  await t.test('completed staff bridge never completes callback; duplicate no-answer creates one due callback',async()=>{
    const id=await thread(3);
    await action(id,'call');
    const ids=await prepare();assert.equal(ids.length,1);
    await begin(ids[0]);
    await finish(ids[0],{status:'accepted',provider_sid:'SIM-CALL-STAFF',reason:'Staff bridge accepted'});
    assert.equal((await signed({From:sender,To:handset,CallSid:'SIM-CALL-STAFF',CallStatus:'completed'},ids[0],'staff')).status,200);
    let current=(await localSnapshot(L,actor)).threads.find(t=>t.id===id);
    assert.equal(current.callback,null);
    const noAnswer={From:sender,To:phone(3),CallSid:'SIM-CALL-RECIPIENT',ParentCallSid:'SIM-CALL-STAFF',CallStatus:'no-answer'};
    assert.equal((await signed(noAnswer,ids[0],'recipient')).status,200);
    current=(await localSnapshot(L,actor)).threads.find(t=>t.id===id);
    const callback=current.callback.id;
    assert.equal(current.callback.status,'due');
    assert.equal((await signed(noAnswer,ids[0],'recipient')).status,200);
    assert.equal((await localSnapshot(L,actor)).threads.find(t=>t.id===id).callback.id,callback);
    assert.equal((await signed({...noAnswer,To:phone(4)},ids[0],'recipient')).status,403);
    await action(id,'call_outcome',{outcome:'no-answer'});
    assert.equal(await localSQL(`SELECT to_jsonb(status) FROM crm_outbox WHERE thread_id='${id}';`),'no-answer');
    assert.equal((await localSnapshot(L,actor)).threads.find(t=>t.id===id).callback.id,callback);
  });
  await t.test('canonical role revocation is rechecked by service worker, not just cached staff JWT',async()=>{
    const id=await thread(4);
    await action(id,'send',{text:'Queued before role was revoked'});
    await localSQL(`UPDATE auth.users SET raw_user_meta_data='{}' WHERE id='${ADMIN}'; SELECT true;`);
    await prepare();
    assert.equal(await localSQL(`SELECT to_jsonb(reason) FROM crm_outbox WHERE thread_id='${id}';`),'Designated operator role or location grant missing');
    await localSQL(`UPDATE auth.users SET raw_user_meta_data='{"app_role":"admin","tenant_slug":"one"}' WHERE id='${ADMIN}'; SELECT true;`);
  });
  await t.test('automatic consumer only simulates; failed or unknown attempts preserve reviewed draft',async()=>{
    const id=await thread(5);
    await action(id,'send',{text:'Preserve this reviewed wording'});
    const ids=await prepare();assert.equal(ids.length,1);
    await begin(ids[0]);await finish(ids[0],{status:'unknown',reason:'Interrupted after request started'});
    assert.equal((await localSnapshot(L,actor)).threads.find(t=>t.id===id).sms_draft,'Preserve this reviewed wording');
    await assert.rejects(()=>action(id,'send',{text:'Preserve this reviewed wording'}),/unknown/);
    const next=await thread(6);await action(next,'send',{text:'Worker simulation'});
    assert.equal((await drainPilotLocation(true,L)).processed,1);
    assert.equal((await drainPilotLocation(true,L)).processed,0);
    const status=await localSQL(`SELECT crm_pilot_status('${L}');`,actor);
    assert.ok(status.last_worker_at);
  });
  await t.test('pilot consumer rechecks channel consent and the existing contact cap',async()=>{
    const denied=await thread(7);
    await localSQL(`UPDATE crm_threads SET data=data||'{"consent":false}' WHERE id='${denied}'; SELECT true;`);
    await action(denied,'send',{text:'Consent must block this'});
    assert.equal((await prepare()).length,0);
    assert.equal((await localSnapshot(L,actor)).threads.find(t=>t.id===denied).sms_draft,'Consent must block this');
    const capped=await thread(8);
    for(let i=0;i<3;i++){
      await action(capped,'send',{text:'Explicit staff review '+i});
      assert.equal((await drainPilotLocation(true,L)).processed,1);
    }
    await action(capped,'send',{text:'Fourth contact must be held'});
    assert.equal((await drainPilotLocation(true,L)).processed,0);
    assert.equal(await localSQL(`SELECT to_jsonb(reason) FROM crm_outbox WHERE thread_id='${capped}' AND status='held';`),'Approved contact cap reached');
  });
  await t.test('preview never falls through to real transport after a binding mistake',async()=>{
    const id=await thread(9);
    await action(id,'send',{text:'Must not leave the isolated preview'});
    await localSQL(`UPDATE crm_locations SET connection='rehearsal' WHERE location_id='${L}'; SELECT true;`);
    try {
      assert.equal((await drainPilotLocation(true,L)).processed,1);
      assert.equal(await localSQL(`SELECT to_jsonb(reason) FROM crm_outbox WHERE thread_id='${id}';`),
        'Preview cannot use real transport; review the isolated binding');
    } finally {
      await localSQL(`UPDATE crm_locations SET connection='simulated' WHERE location_id='${L}'; SELECT true;`);
    }
  });
});
test('Twilio transport double checks both identities and never retries ambiguous effects',async()=>{
  const claim={id:'11000000-0000-0000-0000-000000000001',account_sid:'AC'+'a'.repeat(32),
    sender,recipient:phone(1),staff_handset:handset,credential_ref:'CRM_TWILIO_PILOT',
    callback_url:'https://staging.example.test/api/crm/provider',kind:'sms',body:'Staff reviewed',
    approval:'synthetic transport contract',approved_numbers:[sender,phone(1),handset]};
  let calls=0;
  const runtime={enabled:true,credential:()=> 'TEST-DOUBLE-NOT-A-CREDENTIAL',
    request:async(url,options)=>{calls++;assert.match(url,/api.twilio.com/);
      assert.equal(options.redirect,'error');assert.equal(options.body.get('From'),sender);
      return Response.json({sid:'SM'+'b'.repeat(32)});}};
  assert.equal((await sendPilotClaim({...claim,approved_numbers:[phone(1)]},runtime)).status,'blocked');
  assert.equal(calls,0);
  assert.equal((await sendPilotClaim(claim,{...runtime,enabled:false})).status,'blocked');
  assert.equal(calls,0);
  assert.equal((await sendPilotClaim(claim,runtime)).status,'accepted');assert.equal(calls,1);
  assert.equal((await sendPilotClaim(claim,{...runtime,request:async()=>{calls++;throw new Error('timeout');}})).status,'unknown');
  assert.equal(calls,2);
  await sendPilotClaim({...claim,kind:'call'},{...runtime,request:async(_url,options)=>{
    calls++;assert.equal(options.body.get('To'),handset);
    assert.match(options.body.get('Twiml'),/answerOnBridge="true"/);
    assert.match(options.body.get('Twiml'),/leg=recipient/);
    return Response.json({sid:'CA'+'c'.repeat(32)});
  }});
  assert.equal(calls,3);
});
