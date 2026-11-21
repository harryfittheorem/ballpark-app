'use client';

import { useState } from 'react';
import type { MigrationManifest, TrainingOverview } from '@/lib/training/types';
import { emptyCourse } from '@/lib/training/types';
import { Button } from '@/components/ui/Button';
import { downloadJson, request, useAction } from './api';
import { date, Empty, Feedback, Raw } from './ui';
import { DriveSource, ManualUploads } from './ManualUploads';
import { TrainualImport } from './TrainualImport';
import styles from './training.module.css';
import { ImportReconciliation } from './ImportReconciliation';

const template: MigrationManifest = { format: 'ballpark-training-v1', source: 'Replace with your source system or export name', items: [{ sourceId: 'replace-with-stable-source-id', title: 'Replace with course title', kind: 'course', status: 'ready', course: { ...emptyCourse(), title: 'Replace with course title', description: 'Replace with reviewed source content', lessons: [{ id: 'replace-with-stable-lesson-id', title: 'Replace with lesson title', section: 'Getting started', kind: 'text', body: 'Replace with plain-text source content. Do not insert HTML.' }] } }], historicalRecords: [] };
function parseManifest(text: string): MigrationManifest {
  const value: unknown = JSON.parse(text);
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  const strings = (items: unknown): items is string[] => Array.isArray(items) && items.every(item => typeof item === 'string');
  if (!record(value) || value.format !== 'ballpark-training-v1' || typeof value.source !== 'string' || !Array.isArray(value.items)) throw new Error('Use the ballpark-training-v1 JSON template with source and items fields.');
  value.items.forEach((item: unknown, index: number) => {
    if (!record(item) || !['sourceId', 'title', 'kind', 'status'].every(key => typeof item[key] === 'string') || !['ready', 'blocked', 'archived'].includes(String(item.status))) throw new Error(`Item ${index + 1}: sourceId, title, kind and a valid status are required.`);
    if (item.reason !== undefined && typeof item.reason !== 'string') throw new Error(`Item ${index + 1}: reason must be plain text.`);
    if (item.course !== undefined) {
      const course = item.course;
      if (!record(course) || !['title', 'description', 'category', 'acknowledgment'].every(key => typeof course[key] === 'string') || !Array.isArray(course.lessons) || !Array.isArray(course.questions) || !strings(course.audience) || typeof course.passingScore !== 'number' || typeof course.maxAttempts !== 'number' || (course.reviewDate !== null && typeof course.reviewDate !== 'string')) throw new Error(`Item ${index + 1}: course must follow the complete normalized CourseContent template.`);
      course.lessons.forEach((lesson: unknown, li: number) => {
        if (!record(lesson) || !['id', 'title', 'section', 'body', 'kind'].every(key => typeof lesson[key] === 'string') || !['text', 'video', 'file', 'checklist'].includes(String(lesson.kind)) || (lesson.checklist !== undefined && !strings(lesson.checklist)) || ['assetId', 'externalUrl', 'transcript'].some(key => lesson[key] !== undefined && typeof lesson[key] !== 'string')) throw new Error(`Item ${index + 1}, lesson ${li + 1}: invalid normalized lesson. Use plain text and supported lesson types.`);
      });
      course.questions.forEach((question: unknown, qi: number) => {
        if (!record(question) || typeof question.id !== 'string' || typeof question.prompt !== 'string' || !strings(question.options) || !Array.isArray(question.correct) || !question.correct.every(n => typeof n === 'number' && Number.isInteger(n))) throw new Error(`Item ${index + 1}, question ${qi + 1}: include options and numeric correct-choice indexes.`);
      });
    }
  });
  if (value.historicalRecords !== undefined && (!Array.isArray(value.historicalRecords) || !value.historicalRecords.every((item: unknown) => record(item) && ['sourceId', 'email', 'courseSourceId', 'completedAt'].every(key => typeof item[key] === 'string')))) throw new Error('Historical records must be an array with sourceId, email, courseSourceId and completedAt.');
  return value as MigrationManifest;
}
export function Migration({ overview, onSaved }: { overview: TrainingOverview; onSaved: () => Promise<void> }) {
  const [manifest, setManifest] = useState<MigrationManifest | null>(null);
  const [filename, setFilename] = useState('');
  const [parseError, setParseError] = useState('');
  const [stage, setStage] = useState<{ id: string; ready: number; blocked: number } | null>(null);
  const [rollbackId, setRollbackId] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reading, setReading] = useState(false);
  const action = useAction();
  return <div className={styles.stack}>
    <TrainualImport onSaved={onSaved}/>
    <ManualUploads overview={overview} onSaved={onSaved}/>
    <DriveSource onSaved={onSaved}/>
    <details className={styles.panel}><summary className="cursor-pointer text-sm text-gold">Source batch history & advanced normalized manifest migration</summary><div className={`${styles.stack} mt-5`}>
    <div><h2>Advanced manifest workspace</h2><p className={styles.muted}>For pre-normalized source content and historical evidence. Manual files and videos can be uploaded above without JSON.</p></div>
    <div className={styles.notice}><strong>This advanced importer accepts normalized JSON, not arbitrary Trainual PDFs.</strong><p>Use our <code>ballpark-training-v1</code> manifest format here. Upload PDFs and original media through the manual workflow above instead. Review source content, external links, quiz answers and historical evidence before importing. Registered Drive links remain blocked references; they are not copied media. This workspace does not establish transfer or cutover completion.</p></div>
    <Feedback {...action}/><Feedback error={parseError}/>
    <div className={`${styles.panel} ${styles.stack}`}><div className={styles.spread}><h3>1. Prepare source manifest</h3><Button variant="secondary" disabled={action.pending} onClick={() => downloadJson('ballpark-training-manifest-template.json', template)}>Download JSON template</Button></div>
      <label>Normalized manifest (.json)<input type="file" accept=".json,application/json" disabled={action.pending || reading} onChange={e => { const file = e.target.files?.[0]; setManifest(null); setStage(null); setParseError(''); if (!file) return; setFilename(file.name); setReading(true); void file.text().then(text => setManifest(parseManifest(text))).catch(e => setParseError(e instanceof Error ? e.message : 'Unable to read manifest.')).finally(() => setReading(false)); }}/></label>
      {reading && <p role="status" className={styles.muted}>Reading and checking manifest structure…</p>}
      {manifest && <><p className={styles.muted}>{filename} · {manifest.items.length} source items · {manifest.historicalRecords?.length || 0} historical records</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Source item</th><th>Status</th><th>Review warnings</th></tr></thead><tbody>{manifest.items.map((item, i) => <tr key={`${item.sourceId}-${i}`}><td>{item.title}<p className={styles.muted}>{item.sourceId} · {item.kind}</p></td><td>{item.status}</td><td>{[item.reason, !item.course && item.status === 'ready' ? 'Missing normalized course content' : '', ...(item.course?.lessons || []).filter(l => l.externalUrl).map(l => `External dependency: ${l.title}`), ...(item.course?.lessons || []).filter(l => (l.kind === 'video' || l.kind === 'file') && !l.assetId && !l.externalUrl).map(l => `Missing media: ${l.title}`)].filter(Boolean).join('; ') || 'Review source content before import'}</td></tr>)}</tbody></table></div><Raw label="Inspect full source manifest and historical evidence" value={manifest}/><Button disabled={action.pending} onClick={() => void action.run(async () => { const result = await request<{ id: string; ready: number; blocked: number }>('/api/training/migrations', 'POST', { manifest }); setStage(result); await onSaved(); return result; }, 'Dry run staged. No courses have been published or imported by this step.')}>2. Stage / dry run</Button></>}
      {stage && <div className={styles.notice}><strong>Dry run: {stage.ready} ready · {stage.blocked} blocked</strong><p>Batch {stage.id}. Review the staged batch below. Blocked or missing material must be resolved; importing does not publish training.</p></div>}
    </div>
    <h2>Staged batches</h2>
    {!overview.batches.length && <Empty title="No migration batches">Upload the normalized JSON manifest and run staging to inspect import readiness.</Empty>}
    {overview.batches.map(batch => <article className={`${styles.panel} ${styles.stack}`} key={batch.id}>
      <div className={styles.spread}><div><h3>{batch.source}</h3><p className={styles.muted}>{date(batch.created_at)} · {batch.id}</p></div><span className={styles.badge}>{batch.status}</span></div>
      <p className={styles.muted}>Checksum: <span className="break-all">{batch.checksum}</span>{batch.imported_at ? ` · Imported ${date(batch.imported_at)}` : ''}{batch.rolled_back_at ? ` · Rolled back ${date(batch.rolled_back_at)}` : ''}</p>
      <ul className="space-y-2 text-sm">{batch.manifest.items.map((item, i) => <li key={`${item.sourceId}-${i}`}><span className={styles.badge}>{item.status}</span> {item.title}{item.reason ? ` — ${item.reason}` : ''}{item.status === 'ready' && !item.course ? ' — Missing course content' : ''}</li>)}</ul>
      <div className={styles.row}>
        <Button disabled={action.pending || !!batch.imported_at || !!batch.rolled_back_at || !batch.manifest.items.some(i => i.status === 'ready' && i.course)} onClick={() => { if (window.confirm('Confirm you reviewed linked-only media, missing content and ungraded tests. External resources are NOT archived. Import eligible source items as drafts only, without publishing or enrolling staff?')) void action.run(async () => { const result = await request<{ count: number }>(`/api/training/migrations/${batch.id}`, 'POST', { action: 'import', reviewLinkedMedia:true }); await onSaved(); return result; }, 'Draft import processed. Review imported content before publishing.'); }}>Import drafts only</Button>
        <Button variant="secondary" disabled={action.pending} onClick={() => void action.run(async () => { const result = await request<MigrationManifest>(`/api/training/migrations/${batch.id}`, 'POST', { action: 'export' }); downloadJson(`source-manifest-${batch.id}.json`, result); return true; }, 'Source manifest exported.')}>Export source manifest</Button>
        <Button variant="danger" disabled={action.pending || !batch.imported_at || !!batch.rolled_back_at} onClick={() => { setRollbackId(batch.id); setConfirm(''); }}>Roll back batch</Button>
      </div>
      {rollbackId === batch.id && <form className={`${styles.notice} ${styles.stack}`} onSubmit={e => { e.preventDefault(); void action.run(async () => { const result = await request<{ count: number }>(`/api/training/migrations/${batch.id}`, 'POST', { action: 'rollback' }); setRollbackId(''); await onSaved(); return result; }, 'Rollback processed. Review the batch and audit evidence.'); }}>
        <strong className="text-danger">Warning: rollback removes imported batch material where permitted. It is not an undo for a completed system cutover.</strong><p>Existing use may block rollback. Read the server response and preserve your exported source manifest. Type the full batch ID to confirm.</p><fieldset disabled={action.pending} className={styles.stack}><label>Confirm batch ID<input value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off"/></label><div className={styles.row}><Button variant="danger" disabled={confirm !== batch.id} type="submit">Confirm rollback</Button><Button type="button" variant="ghost" onClick={() => setRollbackId('')}>Cancel</Button></div></fieldset>
      </form>}
      <ImportReconciliation manifest={batch.manifest}/>
      <Raw label="Staged manifest / raw historical evidence" value={batch.manifest}/>
    </article>)}
    </div></details>
  </div>;
}
