import type { CourseContent, MigrationManifest, Question } from './types';

export class TrainingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function requireValue(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new TrainingError(message, status);
}
export function uuid(value: unknown): string {
  requireValue(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), 'Invalid identifier');
  return value;
}
export function text(value: unknown, max = 500, required = false): string {
  requireValue(typeof value === 'string', 'Expected text');
  requireValue(value.length <= max && (!required || value.trim().length > 0), `Text must be ${required ? 'non-empty and ' : ''}at most ${max} characters`);
  return value.trim();
}
export function safeExternalUrl(value: unknown): string {
  const s = text(value, 2000);
  if (!s) return '';
  let url: URL;
  try { url = new URL(s); } catch { throw new TrainingError('Enter a valid HTTPS URL'); }
  requireValue(url.protocol === 'https:' && !url.username && !url.password, 'Only HTTPS links without credentials are accepted');
  return url.toString();
}
export function validateCourse(value: unknown, publishing = false): CourseContent {
  requireValue(value && typeof value === 'object', 'Course content is required');
  const d = value as CourseContent;
  const title = text(d.title, 180, true);
  const description = text(d.description, 3000);
  const category = text(d.category, 100, true);
  requireValue(Array.isArray(d.lessons) && d.lessons.length <= 200, 'Use at most 200 lessons per course');
  requireValue(!publishing || d.lessons.length > 0, 'Add at least one lesson before publishing');
  const ids = new Set<string>();
  const lessons = d.lessons.map(l => {
    const id = text(l.id, 100, true);
    requireValue(!ids.has(id), 'Lesson identifiers must be unique'); ids.add(id);
    requireValue(['text','video','file','checklist'].includes(l.kind), 'Unknown lesson type');
    const checklist = (l.checklist ?? []).map(c => text(c, 500, true));
    requireValue(checklist.length <= 100, 'Use at most 100 checklist items');
    const externalUrl = l.externalUrl ? safeExternalUrl(l.externalUrl) : '';
    const body = text(l.body, 100000);
    requireValue(!l.references || Array.isArray(l.references) && l.references.length <= 100, 'Invalid lesson references');
    const references = l.references?.map(r => {
      requireValue(['video','resource'].includes(r.kind) && ['linked','unavailable'].includes(r.status), 'Invalid reference type or state');
      text(r.url,2000,true);
      return {url:safeExternalUrl(r.url),kind:r.kind,label:text(r.label,500,true),status:r.status};
    });
    requireValue(!l.sourceWarnings || Array.isArray(l.sourceWarnings) && l.sourceWarnings.length <= 100, 'Invalid source warnings');
    requireValue(!publishing || l.kind !== 'text' || body.length > 0, 'Text lessons need content');
    requireValue(!publishing || !['video','file'].includes(l.kind) || l.assetId || externalUrl, 'Media lessons need an uploaded file or external link');
    requireValue(!publishing || l.kind !== 'checklist' || checklist.length > 0, 'Checklist lessons need items');
    return {id,title:text(l.title,180,true),section:text(l.section ?? '',180),kind:l.kind,body,
      ...(l.assetId ? {assetId:uuid(l.assetId)} : {}),externalUrl,transcript:text(l.transcript ?? '',100000),
      checklist,managerSignoff:l.managerSignoff === true,
      ...(references ? {references} : {}),
      ...(l.sourceUrl ? {sourceUrl:safeExternalUrl(l.sourceUrl)} : {}),
      ...(l.sectionId ? {sectionId:text(l.sectionId,100,true)} : {}),
      ...(l.sourceNumber !== undefined ? {sourceNumber:l.sourceNumber} : {}),
      ...(l.sourceWarnings ? {sourceWarnings:l.sourceWarnings.map(w=>text(w,3000))} : {})};
  });
  requireValue(Array.isArray(d.questions) && d.questions.length <= 100, 'Use at most 100 questions');
  ids.clear();
  const questions = d.questions.map(q => {
    const id = text(q.id,100,true);
    requireValue(!ids.has(id), 'Question identifiers must be unique'); ids.add(id);
    requireValue(Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 10, 'Questions need 2–10 options');
    const options = q.options.map(o => text(o,1000,true));
    requireValue(Array.isArray(q.correct) && q.correct.length > 0 &&
      q.correct.every(i => Number.isInteger(i) && i >= 0 && i < options.length) &&
      new Set(q.correct).size === q.correct.length, 'Select valid correct answers');
    return {id,prompt:text(q.prompt,3000,true),options,correct:[...q.correct].sort((a,b)=>a-b)};
  });
  requireValue(Number.isInteger(d.passingScore) && d.passingScore >= 1 && d.passingScore <= 100, 'Passing score must be 1–100');
  requireValue(Number.isInteger(d.maxAttempts) && d.maxAttempts >= 1 && d.maxAttempts <= 100, 'Attempts must be 1–100');
  requireValue(Array.isArray(d.audience) && d.audience.length > 0 && d.audience.every(r => ['owner','admin','coach','staff'].includes(r)), 'Choose at least one valid audience role');
  requireValue(!d.reviewDate || /^\d{4}-\d{2}-\d{2}$/.test(d.reviewDate) && Number.isFinite(Date.parse(d.reviewDate)), 'Invalid review date');
  let sourceReview: CourseContent['sourceReview'];
  if(d.sourceReview) {
    const r=d.sourceReview;
    requireValue(Array.isArray(r.warnings) && r.warnings.length<=100 && Array.isArray(r.tests) && r.tests.length<=20,'Invalid source review');
    sourceReview={updated:text(r.updated,200),notes:text(r.notes,50000),warnings:r.warnings.map(w=>text(w,3000)),
      tests:r.tests.map(t=>({title:text(t.title,500,true),body:text(t.body,100000,true)}))};
  }
  return {title,description,category,lessons,questions,passingScore:d.passingScore,maxAttempts:d.maxAttempts,
    ...(sourceReview ? {sourceReview} : {}),
    audience:[...new Set(d.audience)],acknowledgment:text(d.acknowledgment,10000),reviewDate:d.reviewDate || null};
}
export function gradeQuiz(questions: Question[], input: unknown) {
  requireValue(questions.length > 0, 'This course has no quiz');
  requireValue(input && typeof input === 'object' && !Array.isArray(input), 'Quiz answers are required');
  const answers = input as Record<string, number[]>;
  requireValue(Object.keys(answers).every(key => questions.some(q => q.id === key)), 'Unknown quiz question');
  let correct = 0;
  for (const q of questions) {
    const chosen = answers[q.id];
    requireValue(Array.isArray(chosen) && chosen.length > 0 && chosen.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length) &&
      new Set(chosen).size === chosen.length, 'Answer every question with valid choices');
    if (JSON.stringify([...chosen].sort((a,b)=>a-b)) === JSON.stringify([...q.correct].sort((a,b)=>a-b))) correct++;
  }
  return Math.round(correct / questions.length * 100);
}
export function validateManifest(value: unknown): MigrationManifest {
  requireValue(value && typeof value === 'object', 'Upload a normalized migration manifest');
  const m = value as MigrationManifest;
  requireValue(m.format === 'ballpark-training-v1', 'This importer accepts ballpark-training-v1 JSON, not raw Trainual exports or PDFs. Normalize the source first.');
  text(m.source,100,true);
  requireValue(Array.isArray(m.items) && m.items.length > 0 && m.items.length <= 500, 'A batch must contain 1–500 inventory items');
  const ids = new Set<string>();
  if(m.sourceArchives) {
    requireValue(Array.isArray(m.sourceArchives) && m.sourceArchives.length<=10,'Invalid source archive');
    for(const archive of m.sourceArchives) {
      text(archive.filename,240,true);text(archive.content,2000000,true);
      requireValue(typeof archive.sha256==='string' && /^[a-f0-9]{64}$/.test(archive.sha256),'Invalid archive checksum');
    }
  }
  for (const i of m.items) {
    text(i.sourceId,180,true); text(i.title,180,true); text(i.kind,100,true);
    requireValue(!ids.has(i.sourceId),'Duplicate source identifier'); ids.add(i.sourceId);
    requireValue(['ready','blocked','archived'].includes(i.status),'Unknown migration item status');
    if (i.status === 'ready') validateCourse(i.course, true);
    else text(i.reason,2000,true);
  }
  requireValue(!m.historicalRecords || Array.isArray(m.historicalRecords) && m.historicalRecords.length <= 10000, 'At most 10,000 historical records per batch');
  ids.clear();
  for (const h of m.historicalRecords ?? []) {
    text(h.sourceId,180,true);
    requireValue(!ids.has(h.sourceId),'Duplicate historical source identifier'); ids.add(h.sourceId);
    requireValue(typeof h.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(h.email),'Historical record needs a valid email');
    requireValue(typeof h.completedAt === 'string' && Number.isFinite(Date.parse(h.completedAt)), 'Historical record needs a completion date');
    requireValue(m.items.some(i => i.sourceId === h.courseSourceId), 'Historical record references missing source content');
    requireValue(h.score === undefined || Number.isFinite(h.score) && h.score >= 0 && h.score <= 100, 'Invalid historical score');
    if (h.evidence) text(h.evidence,20000);
  }
  return m;
}
export function learnerContent(content: CourseContent): CourseContent {
  return {...content,questions:content.questions.map(({correct: _correct,...q}) => q as Question)};
}
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g,'""') + '"';
}
