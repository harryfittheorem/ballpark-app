const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const USER='90000000-0000-0000-0000-000000000004';
const LOCATION='21000000-0000-0000-0000-000000000001';
const OTHER='21000000-0000-0000-0000-000000000002';
const TENANT='11000000-0000-0000-0000-000000000001';
const encode=value=>`convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('hex')}','hex'),'UTF8')::jsonb`;
function harness(options={}) {
  const state={role:'admin',grant:LOCATION,scope:{location_id:LOCATION,operator_id:USER},...options};
  const sql=[];
  const client={
    auth:{getUser:async()=>({data:{user:{id:USER}},error:state.authError||null}),
      getSession:async()=>({data:{session:{}}})},
    from(table) {
      const conditions=[];
      const query={
        select(){return this;},eq(key,value){conditions.push(row=>row[key]===value);return this;},
        in(key,values){conditions.push(row=>values.includes(row[key]));return this;},limit(){return this;},
        then(resolve,reject){
          const rows=table==='locations' ? [
            {id:LOCATION,tenant_id:TENANT,name:'Frisco Academy',timezone:'America/Chicago'},
            {id:OTHER,tenant_id:TENANT,name:'Other location',timezone:'America/New_York'},
          ] : state.grant ? [{user_id:USER,location_id:state.grant}] : [];
          return Promise.resolve({data:rows.filter(row=>conditions.every(condition=>condition(row))),error:null}).then(resolve,reject);
        },
      };return query;
    },
  };
  const exports={};const module={exports};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/crm/context.ts'),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
  }).outputText;
  const loader=name=>{
    if(name==='@/lib/supabase/server')return {createClient:async()=>client};
    if(name==='@/lib/auth')return {readAppRole:()=>state.role,readTenantId:()=>TENANT};
    if(name==='node:fs/promises')return {readFile:async()=>{
      if(state.scope===null)throw Object.assign(new Error('absent'),{code:'ENOENT'});
      return typeof state.scope==='string'?state.scope:JSON.stringify(state.scope);
    }};
    if(name==='./local')return {root:'/isolated-fixture',previewReady:()=>true,literal:encode,
      assertUUID:value=>{assert.match(value,/^[a-f0-9-]{36}$/);return value;},
      fixtureLocation:'20000000-0000-0000-0000-000000000001',
      fixtureTenant:'10000000-0000-0000-0000-000000000001',
      localSQL:async query=>{sql.push(query);return true;}};
    return require(name);
  };
  new Function('require','exports','module',code)(loader,exports,module);
  return {resolve:module.exports.crmContext,sql};
}
const request=preview=>new Request('https://portal.test/api/crm'+(preview?'?preview=1':''));
test('approved preview scope reuses the real role and exact location grant',async()=>{
  for(const role of ['parent','coach','super_admin']){
    await assert.rejects(()=>harness({role}).resolve(request(true)),/Staff sign-in required/);
  }
  for(const role of ['owner','admin']){
    await assert.rejects(()=>harness({role,grant:null}).resolve(request(true)),/Explicit staff location required/);
    await assert.rejects(()=>harness({role,grant:OTHER}).resolve(request(true)),/Explicit staff location required/);
  }
  const approved=harness();
  const context=await approved.resolve(request(true));
  assert.equal(context.role,'admin');
  assert.equal(context.userId,USER);
  assert.match(context.locations[0].name,/Frisco Academy/);
  assert.equal(approved.sql.length,2);
  assert.match(approved.sql[0],/INSERT INTO auth.users\(id,raw_user_meta_data\)/);
  assert.ok(approved.sql[0].includes(encode('admin')));
  assert.ok(approved.sql[1].includes(encode('America/Chicago')));
  await assert.rejects(()=>harness({scope:{location_id:LOCATION,operator_id:'90000000-0000-0000-0000-000000000005'}}).resolve(request(true)),/Designated rehearsal operator/);
  await assert.rejects(()=>harness({scope:'not-json'}).resolve(request(true)),/scope is invalid/);
});
test('normal staff access never reads preview approval or writes a synthetic identity',async()=>{
  const normal=harness({scope:'invalid-preview-file'});
  const context=await normal.resolve(request(false));
  assert.equal(context.tenantId,TENANT);
  assert.deepEqual(context.locations.map(location=>location.id),[LOCATION]);
  assert.equal(normal.sql.length,0);
});
test('unbound deterministic rehearsal still requires an existing same-tenant grant',async()=>{
  const defaultPreview=harness({scope:null,grant:OTHER});
  assert.equal((await defaultPreview.resolve(request(true))).locations[0].name,'Clearwater • Rehearsal');
  await assert.rejects(()=>harness({scope:null,grant:null}).resolve(request(true)),/Explicit staff location required/);
});
