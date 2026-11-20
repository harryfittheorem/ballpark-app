import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCourse } from './types';
import { csvCell, gradeQuiz, learnerContent, safeExternalUrl, uuid, validateCourse, validateManifest } from './validation';

const content=()=>({...emptyCourse(),title:'Safety',lessons:[{id:'lesson-1',title:'Equipment',section:'Safety',kind:'text' as const,body:'Turn off equipment.'}],
  questions:[{id:'q1',prompt:'Which steps?',options:['Disconnect','Restart','Inspect'],correct:[0,2]}]});
test('accepts deterministic seeded UUIDs as well as random UUIDs',()=>{
  assert.equal(uuid('de000001-0000-0000-0000-000000000009'),'de000001-0000-0000-0000-000000000009');
  assert.throws(()=>uuid('../other-tenant'));
});
test('publication requires complete lesson content',()=>{
  assert.throws(()=>validateCourse({...emptyCourse(),title:'Missing lessons'},true));
  assert.equal(validateCourse(content(),true).title,'Safety');
  assert.throws(()=>validateCourse({...content(),lessons:[{...content().lessons[0],kind:'video',body:''}]},true));
});
test('front desk can be targeted separately from all coaches',()=>{
  assert.deepEqual(validateCourse({...content(),audience:['staff']},true).audience,['staff']);
  assert.throws(()=>validateCourse({...content(),audience:['parent']}));
});
test('duplicate lesson IDs and invalid answer indexes are rejected',()=>{
  assert.throws(()=>validateCourse({...content(),lessons:[...content().lessons,...content().lessons]}));
  assert.throws(()=>validateCourse({...content(),questions:[{...content().questions[0],correct:[4]}]}));
});
test('quiz grading is order independent but not subset or duplicate tolerant',()=>{
  assert.equal(gradeQuiz(content().questions,{q1:[2,0]}),100);
  assert.equal(gradeQuiz(content().questions,{q1:[0]}),0);
  assert.throws(()=>gradeQuiz(content().questions,{q1:[0,0,2]}));
  assert.throws(()=>gradeQuiz(content().questions,{}));
  assert.throws(()=>gradeQuiz(content().questions,{q1:[0,2],injected:[1]}));
});
test('learners never receive answer keys or mutate original revision',()=>{
  const c=content(), view=learnerContent(c);
  assert.equal('correct' in view.questions[0],false);
  assert.deepEqual(c.questions[0].correct,[0,2]);
});
test('rejects executable URLs and embedded URL credentials',()=>{
  assert.throws(()=>safeExternalUrl('javascript:alert(1)'));
  assert.throws(()=>safeExternalUrl('https://user:password@example.com'));
  assert.throws(()=>safeExternalUrl('http://example.com'));
  assert.equal(safeExternalUrl('https://example.com/doc'),'https://example.com/doc');
});
test('migration requires explicit normalized format and unique source identities',()=>{
  const item={sourceId:'one',title:'Safety',kind:'course',status:'ready' as const,course:content()};
  const m={format:'ballpark-training-v1' as const,source:'manual',items:[item]};
  assert.equal(validateManifest(m),m);
  assert.throws(()=>validateManifest({...m,format:'trainual'}));
  assert.throws(()=>validateManifest({...m,items:[item,item]}));
  assert.throws(()=>validateManifest({...m,items:[{...item,status:'blocked',reason:''}]}));
});
test('historical records need valid source references and dates',()=>{
  const m={format:'ballpark-training-v1',source:'manual',items:[{sourceId:'one',title:'Safety',kind:'course',status:'ready',course:content()}],
    historicalRecords:[{sourceId:'r1',email:'learner@example.test',courseSourceId:'missing',completedAt:'not a date'}]};
  assert.throws(()=>validateManifest(m));
});
test('CSV escapes formulas, newlines and quotes',()=>{
  assert.equal(csvCell('=1+1'),'"\'=1+1"');
  assert.equal(csvCell('a"b'),'"a""b"');
  assert.equal(csvCell('line\nline'),'"line\nline"');
});
