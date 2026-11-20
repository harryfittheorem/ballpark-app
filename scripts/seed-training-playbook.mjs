/**
 * Explicitly requested demo content, isolated to the demo owner review account.
 * Existing rows are never overwritten. No real staff enrollments or enabled rules.
 * Uses workspace credentials at runtime; never stores passwords or service tokens.
 * Run with: node scripts/seed-training-playbook.mjs --apply
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TENANT = '00000000-0000-0000-0000-000000000001';
const OWNER_EMAIL = 'demo.owner.review@ballpark.test';
const SOURCE = 'demo-training-playbook-v1';
const id = (group, n) => `d3a0${String(group).padStart(4, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const quote = v => v == null ? 'null' : `'${String(v).replaceAll("'", "''")}'`;
const json = v => `${quote(JSON.stringify(v))}::jsonb`;
const days = n => new Date(Date.now() + n * 86400000).toISOString();
const disclaimer = 'DEMO ONLY — fictional training example. Not an approved Infinite Hitting policy. Follow your location’s approved procedures and manufacturer guidance.';

const topics = [
  {
    title:'Facility Opening & Cage Safety',category:'Facility Operations',role:'staff',path:'Opening Shift Readiness',
    goal:'Prepare a safe, organized facility before families arrive.',
    steps:['Inspect walkways and cage nets for visible damage','Check emergency exits are clear and accessible','Confirm equipment is shut down before inspection','Match the day’s coaching schedule to available cages','Report hazards to the shift lead before opening'],
    scenario:'A net has a visible tear before the first lesson. Keep that cage out of use and notify the shift lead. Do not assume a busy schedule makes it safe to proceed.',
    questions:[
      ['What should happen when a cage net is damaged?','Keep the cage out of use and report the issue','Open it because the lesson is short','Cover the tear with a towel'],
      ['When should equipment be inspected?','While shut down according to approved guidance','While an athlete is hitting','Only after a complaint'],
      ['What belongs in the opening handoff?','Unresolved hazards and cage availability','Only yesterday’s revenue','Private family payment details'],
      ['What should be checked before families arrive?','Clear walkways and emergency exits','Leaderboard rankings only','Social media comments'],
      ['Who approves reopening an unsafe area?','The responsible lead using approved procedures','The next customer in line','Any athlete who wants to use it'],
    ],
  },
  {
    title:'Front Desk Check-In & Family Welcome',category:'Front Desk',role:'staff',path:'Front Desk First Week',
    goal:'Welcome families, verify their booking, and hand off clearly to the coach.',
    steps:['Confirm the booking and athlete identity discreetly','Check the correct athlete rather than a sibling','Review required consent status without bypassing it','Confirm the assigned coach and training area','Record arrival using the approved check-in workflow'],
    scenario:'A parent arrives with two siblings but only one booking is visible. Confirm the booked athlete and ask an authorized staff member to resolve the second request; do not mark both as booked.',
    questions:[
      ['What identifies the correct booking?','The athlete and scheduled session','The parent’s first name alone','The nearest open cage'],
      ['What if required consent is missing?','Follow the approved consent process before participation','Ignore it for returning families','Ask another athlete to agree'],
      ['How should family details be discussed?','Discreetly and only with authorized people','Across the waiting room','In a public group chat'],
      ['What if two siblings share a parent account?','Check the individual athlete for each booking','Use either sibling’s booking','Duplicate the first check-in'],
      ['Who needs the arrival handoff?','The assigned coach or responsible staff member','Every customer in the lobby','Only the equipment supplier'],
    ],
  },
  {
    title:'Coach Session Standards & Parent Handoff',category:'Coaching Standards',role:'coach',path:'Coach Onboarding Essentials',
    goal:'Run a focused coaching session with an age-appropriate objective and a clear parent handoff.',
    steps:['Review the athlete’s assigned session and relevant notes','Explain one age-appropriate objective','Follow approved warm-up and safety procedures','Use constructive observations rather than unsupported claims','Share a concise takeaway and next practice focus'],
    scenario:'An athlete reports discomfort during a drill. Stop the activity and follow the facility’s approved escalation process. Do not diagnose an injury or pressure the athlete to continue.',
    questions:[
      ['What makes a useful session objective?','One clear age-appropriate focus','A guarantee of a scholarship','Changing every technique at once'],
      ['What should a coach do if an athlete reports discomfort?','Stop and follow the approved escalation process','Increase repetitions','Make a medical diagnosis'],
      ['What belongs in a parent handoff?','Observed progress and one next practice focus','Another athlete’s private notes','A guaranteed future performance result'],
      ['What should be reviewed before the session?','The correct athlete’s relevant session notes','Unrelated family billing details','Only national rankings'],
      ['How should feedback be delivered?','Constructively with specific observations','As a public comparison with another child','As a promise of immediate results'],
    ],
  },
  {
    title:'HitTrax Session Setup & Data Quality',category:'Equipment & HitTrax',role:'coach',path:'HitTrax Operator Readiness',
    goal:'Associate sessions with the correct athlete and identify questionable capture data.',
    steps:['Verify the intended athlete profile before capture','Follow the manufacturer’s approved setup guidance','Check the training area is safe before starting','Review whether the captured session belongs to that athlete','Escalate missing or implausible readings without inventing results'],
    scenario:'A session appears under the wrong sibling. Stop making further changes, record what happened, and ask the authorized operator to correct the association. Never manually invent a personal best.',
    questions:[
      ['What should be verified before recording?','The correct athlete profile','Only the parent’s surname','The coach’s personal account'],
      ['Which setup guidance should operators follow?','Approved manufacturer and facility instructions','A guessed calibration setting','Advice from an unrelated device'],
      ['What if a reading looks implausible?','Flag it for review rather than treating it as confirmed','Publish it immediately as a record','Change it to a more impressive number'],
      ['What if data belongs to the wrong sibling?','Escalate the association issue through the approved process','Copy the session to every sibling','Ignore the mismatch'],
      ['What must never be fabricated?','Capture results or personal bests','A reminder to review the profile','An equipment issue report'],
    ],
  },
  {
    title:'Membership Questions & Payment Privacy',category:'Membership Operations',role:'admin',path:'Membership Support Fundamentals',
    goal:'Answer membership questions using verified records without exposing payment information.',
    steps:['Verify the person is authorized to discuss the membership','Read the current plan and status before answering','Explain only the terms shown in approved policies','Escalate refunds or exceptions to authorized managers','Never collect card numbers or passwords in chat or notes'],
    scenario:'A parent asks for an exception to a cancellation policy. Explain the published process and escalate the request. Do not promise a refund or change the membership without the required authorization.',
    questions:[
      ['What should be reviewed before answering a membership question?','The current record and approved policy','A remembered price from another business','Another family’s private account'],
      ['Where should card numbers be entered?','Only in the approved secure payment flow','In a coach message','In a training note'],
      ['Who should handle an unauthorized refund request?','An authorized manager through the approved process','Any available athlete','A staff member using someone else’s password'],
      ['What should staff avoid promising?','Exceptions or refunds they cannot authorize','A clear escalation path','A factual explanation of current status'],
      ['What belongs in a support note?','A relevant summary without sensitive payment credentials','The full card number','The parent’s password'],
    ],
  },
];

export async function seedTrainingPlaybook({url,serviceKey,managementToken}) {
  if(!url || !serviceKey || !managementToken) throw new Error('Supabase URL, service role and management access are required');
  if(new URL(url).hostname !== 'exjcwvvglthnxerzpukw.supabase.co')throw new Error('Refusing to seed an unexpected project');
  const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
  async function rest(path) {
    const response=await fetch(`${url}/rest/v1/${path}`,{headers});
    if(!response.ok)throw new Error(`Preflight failed (${response.status})`);
    return response.json();
  }
  const tenant=await rest(`tenants?id=eq.${TENANT}&select=id,slug`);
  if(tenant.length!==1 || tenant[0].slug!=='infinitehitting')throw new Error('Tenant verification failed');
  const usersResponse=await fetch(`${url}/auth/v1/admin/users?filter=${encodeURIComponent(OWNER_EMAIL)}`,{headers});
  if(!usersResponse.ok)throw new Error('Unable to locate demo review account');
  const users=await usersResponse.json();
  const owner=users.users.find(u=>u.email===OWNER_EMAIL && u.user_metadata?.app_role==='owner' && u.user_metadata?.tenant_slug==='infinitehitting');
  if(!owner)throw new Error('Demo owner review account not found; no real owner will be used instead');
  const ownerId=owner.id;
  const sql=['begin;'];
  // Check our namespace before uploading anything. Never overwrite unrelated records.
  const existing=await rest(`training_courses?id=in.(${topics.map((_,i)=>id(1,i+1)).join(',')})&select=id,source_id`);
  if(existing.some(c=>!c.source_id?.startsWith(SOURCE+':')))throw new Error('Demo identifier collides with existing content');
  for(let i=0;i<topics.length;i++){
    const n=i+1,t=topics[i],courseId=id(1,n),assetId=id(2,n),batchId=id(3,n),pathId=id(4,n),assignmentId=id(5,n);
    const filename=`Demo-${t.title.replace(/[^a-zA-Z0-9]+/g,'-')}.txt`;
    const path=`${TENANT}/demo-training-playbook/${assetId}/${filename}`;
    const file=[disclaimer,'',t.title,t.goal,'',...t.steps.map((s,j)=>`${j+1}. ${s}`),'','Practice scenario:',t.scenario,'','Before using this as policy, have the responsible owner review and approve it.'].join('\n');
    const checksum=createHash('sha256').update(file).digest('hex');
    const assets=await rest(`training_assets?id=eq.${assetId}&select=id,path,checksum`);
    if(assets.length && (assets[0].path!==path || assets[0].checksum!==checksum))throw new Error('Demo asset collision; existing asset preserved');
    if(!assets.length){
      const upload=await fetch(`${url}/storage/v1/object/training-private/${path}`,{
        method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'text/plain','x-upsert':'false'},body:file});
      if(!upload.ok) {
        // A retry after an interrupted SQL transaction may find the original object.
        const original=await fetch(`${url}/storage/v1/object/authenticated/training-private/${path}`,{headers});
        if(!original.ok || createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex')!==checksum)
          throw new Error(`Demo file upload failed (${upload.status}); no existing file was overwritten`);
      }
    }
    sql.push(`insert into training_assets(id,tenant_id,uploaded_by,filename,mime,size,path,checksum,status)
      values(${quote(assetId)},${quote(TENANT)},${quote(ownerId)},${quote(filename)},'text/plain',${Buffer.byteLength(file)},${quote(path)},${quote(checksum)},'ready') on conflict(id) do nothing;`);
    const lessons=[
      {id:`demo-${n}-overview`,title:'Purpose & responsibilities',section:'Understand',kind:'text',body:`${disclaimer}\n\n## Why this matters\n${t.goal}\n\n**Your responsibility:** use approved procedures, protect family information, and escalate uncertainty rather than guessing.`},
      {id:`demo-${n}-procedure`,title:'Step-by-step procedure',section:'Understand',kind:'text',body:`${disclaimer}\n\n${t.steps.map(s=>'- '+s).join('\n')}`},
      {id:`demo-${n}-checklist`,title:'Practice readiness checklist',section:'Practice',kind:'checklist',body:'Demo practice only. Tick each item after reviewing it; this does not record a real shift inspection.',checklist:t.steps},
      {id:`demo-${n}-reference`,title:'Downloadable reference guide',section:'Practice',kind:'file',body:'A genuine downloadable demo text document, independently stored in the private training library.',assetId},
      {id:`demo-${n}-scenario`,title:'Scenario & escalation',section:'Apply',kind:'text',body:`${disclaimer}\n\n## Discuss this scenario\n${t.scenario}\n\n## Reflection\nWhat would you record, who would you notify, and what should you avoid doing without authorization?`},
    ];
    const content={title:`Demo · ${t.title}`,description:`Fictional example for ${t.category.toLowerCase()}. ${t.goal} Review only—not approved policy.`,
      category:t.category,lessons,questions:t.questions.map((q,j)=>({id:`demo-${n}-q${j+1}`,prompt:q[0],options:q.slice(1),correct:[0]})),
      passingScore:80,maxAttempts:5,acknowledgment:'I understand this is a demo exercise, not approved business policy or a real employee certification.',
      audience:['owner'],reviewDate:days(30).slice(0,10)};
    sql.push(`insert into training_courses(id,tenant_id,draft,published_version,created_by,source_id)
      values(${quote(courseId)},${quote(TENANT)},${json(content)},1,${quote(ownerId)},${quote(SOURCE+':course-'+n)}) on conflict(id) do nothing;`);
    sql.push(`insert into training_revisions(course_id,version,content,published_by)
      values(${quote(courseId)},1,${json(content)},${quote(ownerId)}) on conflict(course_id,version) do nothing;`);
    const ordered=[courseId,id(1,n%5+1)];
    sql.push(`insert into training_paths(id,tenant_id,title,description,course_ids)
      values(${quote(pathId)},${quote(TENANT)},${quote('Demo · '+t.path)},${quote('Fictional two-course pathway. Review and customize before assigning to employees.')},array[${ordered.map(x=>quote(x)+'::uuid').join(',')}]) on conflict(id) do nothing;`);
    sql.push(`insert into training_rules(id,tenant_id,title,audience,course_id,due_days,repeat_days,enabled)
      values(${quote(id(6,n))},${quote(TENANT)},${quote('Demo · '+t.path+' enrollment')},${quote(t.role)},${quote(courseId)},${n+3},${n%2?90:180},false) on conflict(id) do nothing;`);
    const complete=n===1||n===5,partial=n===2||n===3;
    sql.push(`insert into training_assignments(id,tenant_id,course_id,version,user_id,assigned_by,due_at,completed_at,acknowledged_at,acknowledged_name,source,path_id,created_at)
      values(${quote(assignmentId)},${quote(TENANT)},${quote(courseId)},1,${quote(ownerId)},${quote(ownerId)},${quote(days(n===3?-2:n+3))},
      ${quote(complete?days(-1):null)},${quote(complete?days(-1):null)},${quote(complete?'Demo learner (synthetic example)':null)},
      'demo:synthetic-example-not-employee-evidence',${quote(pathId)},${quote(days(-7))}) on conflict(id) do nothing;`);
    const progressCount=complete?5:partial?2:0;
    for(let p=0;p<progressCount;p++)sql.push(`insert into training_progress(assignment_id,lesson_id,completed_at)
      values(${quote(assignmentId)},${quote(lessons[p].id)},${quote(days(-2))}) on conflict do nothing;`);
    if(complete)sql.push(`insert into training_attempts(id,assignment_id,score,passed,answers)
      values(${quote(id(7,n))},${quote(assignmentId)},100,true,${json(Object.fromEntries(content.questions.map(q=>[q.id,[0]])))}) on conflict(id) do nothing;`);
    const manifest={format:'ballpark-training-v1',source:`Demo · ${t.category} source inventory`,items:t.steps.map((step,j)=>({
      sourceId:`demo-${n}-source-${j+1}`,title:`Demo · ${step}`,kind:j===0?'video':'document',status:'blocked',
      reason:'Fictional inventory example only. No client material has been imported. Replace with authorized original files before migration.',
    }))};
    sql.push(`insert into training_import_batches(id,tenant_id,source,checksum,manifest,status,created_by)
      values(${quote(batchId)},${quote(TENANT)},${quote(manifest.source)},${quote(createHash('sha256').update(JSON.stringify(manifest)).digest('hex'))},${json(manifest)},'staged',${quote(ownerId)}) on conflict(id) do nothing;`);
    sql.push(`insert into training_audit(id,tenant_id,actor_id,action,entity_id,detail)
      values(${quote(id(8,n))},${quote(TENANT)},${quote(ownerId)},'demo_seed',${quote(courseId)},'{"synthetic":true,"purpose":"User-requested review examples; not employee evidence"}') on conflict(id) do nothing;`);
  }
  sql.push('commit;');
  const response=await fetch('https://api.supabase.com/v1/projects/exjcwvvglthnxerzpukw/database/query',{
    method:'POST',headers:{Authorization:`Bearer ${managementToken}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql.join('\n')})});
  if(!response.ok)throw new Error(`Demo database transaction failed (${response.status}): ${await response.text()}`);
  const counts={};
  for(const [table,group] of [['training_courses',1],['training_assets',2],['training_import_batches',3],['training_paths',4],['training_assignments',5],['training_rules',6]]) {
    const rows=await rest(`${table}?id=in.(${topics.map((_,i)=>id(group,i+1)).join(',')})&select=id`);
    if(rows.length!==5)throw new Error(`Expected five demo records in ${table}, found ${rows.length}`);
    counts[table]=rows.length;
  }
  return {...counts,lessons:25,quizQuestions:25,rulesEnabled:false,assignedTo:'demo owner review account only'};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  if(!process.argv.includes('--apply'))console.log('Preview: creates five demo courses, files, learning paths, disabled rules, demo-owner assignments/reports, and staged source inventories. Pass --apply to seed.');
  else seedTrainingPlaybook({
    url:process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,
    managementToken:process.env.SUPABASE_ACCESS_TOKEN,
  }).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
