import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { adaptTrainual } from './trainual';
import { validateCourse, validateManifest } from './validation';
import { videoEmbed, lessonReferences } from '../../components/training/media';
const root=process.cwd().endsWith('/portal')?'..':'.';
const json=readFileSync(`${root}/attached_assets/infinite-hitting-trainual-export_1795241377259.json`,'utf8');
const markdown=readFileSync(`${root}/attached_assets/infinite-hitting-trainual-export_1795241377262.md`,'utf8');
const source=JSON.parse(json);
const manifest=adaptTrainual(source,markdown);
test('text-only published lessons derive safe inline players without changing content or duplicating explicit references',()=>{
 const lesson={id:'welcome',title:'Welcome',section:'Welcome',kind:'text' as const,body:'Video: https://www.youtube.com/watch?v=Q2QmuDLUTR4'};
 const refs=lessonReferences(lesson);
 assert.equal(refs.length,1);assert.equal(refs[0].kind,'video');
 assert.equal(videoEmbed(refs[0].url)?.url,'https://www.youtube-nocookie.com/embed/Q2QmuDLUTR4');
 assert.equal(lessonReferences({...lesson,references:[refs[0],refs[0]]}).length,2);
 assert.equal(lessonReferences({...lesson,body:'https://youtube.com.attacker.test/watch?v=Q2QmuDLUTR4 javascript:alert(1)'}).length,0);
 assert.equal(lessonReferences({...lesson,body:'',externalUrl:refs[0].url})[0].kind,'video');
});
test('exact export hierarchy, source bodies, order and repeated videos survive validation',()=>{
 assert.equal(manifest.items.length,9);
 let topics=0,steps=0;const videos:string[]=[];
 manifest.items.forEach((item,i)=>{
  const c=validateCourse(item.course);const s=source.subjects[i];
  assert.equal(c.title,s.title);assert.equal(c.category,s.category);
  assert.equal(c.sourceReview?.notes,s.notes);assert.equal(c.sourceReview?.updated,s.updated);
  topics+=new Set(c.lessons.map(l=>l.sectionId)).size;
  const raw=s.topics.flatMap((t:{steps:{title:string;body:string;url:string;video_urls:string[]}[]})=>t.steps);
  c.lessons.forEach((l,n)=>{
   assert.equal(l.title,raw[n].title);assert.equal(l.body,raw[n].body.trim());assert.equal(l.sourceUrl,raw[n].url);
   assert.deepEqual(l.references?.filter(r=>r.kind==='video').map(r=>r.url),raw[n].video_urls);
   videos.push(...raw[n].video_urls);steps++;
  });
 });
 assert.equal(topics,54);assert.equal(steps,241);assert.equal(videos.length,205);assert.equal(new Set(videos).size,202);
 validateManifest(manifest);
});
test('four source tests retain all 41 questions without invented answers or history',()=>{
 const tests=manifest.items.flatMap(i=>i.course!.sourceReview!.tests);
 assert.equal(tests.length,4);
 assert.deepEqual(tests.map(t=>(t.body.match(/\*\*Question /g)||[]).length),[8,5,21,7]);
 assert.ok(manifest.items.every(i=>i.course!.questions.length===0));
 assert.deepEqual(manifest.historicalRecords,[]);
});
test('missing Scribe, unresolved references and survey URL anomalies are explicit',()=>{
 const lessons=manifest.items.flatMap(i=>i.course!.lessons);
 assert.ok(lessons.find(l=>l.title.includes('Instagram Account [Mobile]'))?.sourceWarnings?.some(w=>w.includes('Missing source content')));
 assert.equal(lessons.filter(l=>l.sourceWarnings?.some(w=>w.includes('Source anomaly'))).length,4);
 assert.ok(lessons.some(l=>l.references?.some(r=>r.label==='Unresolved Trainual reference' && r.status==='unavailable')));
});
test('identities are deterministic and title edits do not change source identity',()=>{
 assert.deepEqual(adaptTrainual(source,markdown),manifest);
 const changed=structuredClone(source);changed.subjects[0].topics[0].steps[0].title+=' corrected';
 assert.equal(adaptTrainual(changed,markdown).items[0].course!.lessons[0].id,manifest.items[0].course!.lessons[0].id);
});
test('mismatched companion, count loss and unsafe media fail validation',()=>{
 assert.throws(()=>adaptTrainual(source,markdown.replace('### Test: Marketing Review','### Removed test: Marketing Review')));
 for(const url of ['javascript:alert(1)','data:text/html,bad','https://user:password@example.com/','http://example.com/']) {
  const changed=structuredClone(source);changed.subjects[0].topics[0].steps[0].video_urls=[url];
  assert.throws(()=>adaptTrainual(changed,markdown));
 }
 const c=structuredClone(manifest.items[0].course!);c.lessons[0].references![0].url='javascript:alert(1)';
 assert.throws(()=>validateCourse(c));
});
test('embeds use provider-specific IDs, not arbitrary hosts or imported HTML',()=>{
 assert.equal(videoEmbed('https://www.youtube.com/watch?v=Q2QmuDLUTR4')?.url,'https://www.youtube-nocookie.com/embed/Q2QmuDLUTR4');
 assert.ok(videoEmbed('https://www.loom.com/share/'+'a'.repeat(32)));
 for(const url of ['https://youtube.com.attacker.test/watch?v=Q2QmuDLUTR4','javascript:alert(1)','https://youtube.com/watch?v=<script>','https://loom.com/share/nope'])assert.equal(videoEmbed(url),null);
});
