import { emptyCourse, type MigrationManifest } from './types';
import { requireValue, safeExternalUrl, text } from './validation';

type Step = { number: number; title: string; url: string; body: string; video_urls: string[] };
type Subject = { number: number; file: string; title: string; category: string; updated: string; notes: string; step_count: number; topic_count: number; topics: { number: number; title: string; steps: Step[] }[] };
const urls = (body: string) => body.match(/https?:\/\/[^\s<>"\]]+/g)?.map(u => u.replace(/[).,;]+$/, '')) ?? [];

/** Companion Markdown separates tests that the JSON merges into preceding lessons. */
export function adaptTrainual(input: unknown, markdown: string): MigrationManifest {
  requireValue(input && typeof input === 'object', 'Expected a Trainual export');
  const raw = input as { subjects: Subject[]; known_gaps: string[]; totals?: { subjects:number; topics:number; steps:number; tests:number; video_urls:number } };
  requireValue(Array.isArray(raw.subjects) && raw.subjects.length > 0 && raw.subjects.length <= 100, 'Expected exported subjects');
  text(markdown, 2000000, true);
  // Slice by headings instead of relying on content/body formatting.
  const headings = [...markdown.matchAll(/^## Subject (\d+): (.+)$/gm)];
  const sections = new Map(headings.map((h, i) => [Number(h[1]), { title: h[2], body: markdown.slice(h.index! + h[0].length, headings[i + 1]?.index ?? markdown.length) }]));
  const ids = new Set<string>();
  const items = raw.subjects.map(s => {
    requireValue(Number.isInteger(s.number) && !ids.has(String(s.number)), 'Duplicate or invalid subject number'); ids.add(String(s.number));
    const companion = sections.get(s.number);
    requireValue(companion?.title === s.title, `Companion Markdown does not match subject ${s.number}`);
    requireValue(Array.isArray(s.topics) && s.topics.length === s.topic_count, 'Topic count mismatch');
    const tests = [...companion.body.matchAll(/^### Test: (.+)\r?\n([\s\S]*?)(?=^### |^## |^---|(?![\s\S]))/gm)]
      .map(m => ({ title: m[1], body: m[2].trim() }));
    const warnings = ['External media is linked only, not independently archived. Screenshots and attachments require acquisition and review.'];
    if (tests.length) warnings.push('Answer-key review required: source tests are retained as ungraded content; no correct answers were supplied.');
    const lessonIds = new Set<string>();
    const topicIds = new Set<number>();
    const lessons = s.topics.flatMap(t => {
      requireValue(Number.isInteger(t.number) && !topicIds.has(t.number), 'Duplicate or invalid topic number'); topicIds.add(t.number);
      text(t.title, 180, true); requireValue(Array.isArray(t.steps), 'Topic steps are required');
      return t.steps.map(step => {
        const sourceUrl = safeExternalUrl(step.url);
        const source = new URL(sourceUrl);
        const match = source.pathname.match(/^\/([^/]+)\/(steps|surveys)\/(\d+)\/consume$/);
        requireValue(source.hostname === 'app.trainual.com' && match, 'Invalid Trainual step identity');
        const id = match[2]==='steps' ? `trainual-step-${match[3]}` : `trainual-subject-${s.number}-step-${step.number}`;
        requireValue(!lessonIds.has(id), 'Duplicate source step'); lessonIds.add(id);
        requireValue(typeof step.body === 'string' && Array.isArray(step.video_urls), 'Step body and video URLs are required');
        const sourceWarnings: string[] = [];
        if(match[2]==='surveys') sourceWarnings.push('Source anomaly: the export merged a test into this lesson and recorded a survey URL instead of the lesson URL. Original content retained; answer-key review required.');
        if (!step.body.trim() || /GAP — CONTENT NOT ACCESSIBLE|body text not copied|requiring.*sign.in|requires.*sign.in/i.test(step.body)) sourceWarnings.push('Missing source content: protected or empty lesson body; acquisition required.');
        if (/screenshots?|attached files?|attachment/i.test(step.body) && !/no (?:links, )?attachments/i.test(step.body)) sourceWarnings.push('Referenced screenshots/files were not independently downloaded.');
        const references = step.video_urls.map((u, i) => ({ url: safeExternalUrl(u), kind: 'video' as const, label: `Source video ${i + 1}`, status: 'linked' as const }));
        const resources = urls(step.body).filter(u => !step.video_urls.includes(u)).filter(u => {
          if(u.startsWith('http:')) { sourceWarnings.push(`Insecure source URL retained as text only; not imported as a resource: ${u}`); return false; }
          return true;
        }).map(u => {
          const url = safeExternalUrl(u);
          const internal = new URL(url).hostname === 'app.trainual.com';
          if (internal) sourceWarnings.push(`Unresolved internal reference: ${url}`);
          return { url, kind: 'resource' as const, label: internal ? 'Unresolved Trainual reference' : 'Source resource (not archived)', status: internal || /scribe/i.test(url) ? 'unavailable' as const : 'linked' as const };
        });
        return { id, title: step.title, section: t.title, sectionId: `trainual-subject-${s.number}-topic-${t.number}`, sourceNumber: step.number, sourceUrl, kind: 'text' as const, body: step.body, references: [...references, ...resources], sourceWarnings };
      });
    });
    requireValue(lessons.length === s.step_count, 'Step count mismatch');
    return { sourceId: `subject-${s.number}`, title: s.title, kind: 'course', status: 'ready' as const, reason: warnings.join(' '),
      course: { ...emptyCourse(), title: s.title, category: s.category, description: 'Imported Trainual draft — source review required. No learner history was supplied.', lessons,
        sourceReview: { updated: s.updated, notes: s.notes, warnings, tests } } };
  });
  if(raw.totals) {
    const actual={subjects:items.length,topics:raw.subjects.reduce((n,s)=>n+s.topics.length,0),steps:items.reduce((n,i)=>n+i.course.lessons.length,0),tests:items.reduce((n,i)=>n+i.course.sourceReview.tests.length,0),video_urls:items.reduce((n,i)=>n+i.course.lessons.reduce((n,l)=>n+l.references.filter(r=>r.kind==='video').length,0),0)};
    for(const key of Object.keys(actual) as (keyof typeof actual)[]) requireValue(raw.totals[key]===actual[key],`Export ${key} total does not reconcile; review both source files`);
  }
  return { format: 'ballpark-training-v1', source: 'trainual-infinite-hitting-export', items, historicalRecords: [] };
}
