'use client';

import { useState } from 'react';
import type { Course, CourseContent, Lesson, TrainingOverview, TrainingRole } from '@/lib/training/types';
import { Button } from '@/components/ui/Button';
import { request, useAction } from './api';
import { Feedback, move } from './ui';
import styles from './training.module.css';
import { TextEditor } from './TextEditor';
import { trainingFileMime } from '@/lib/training/formats';
import { LessonSource, SourceReview } from './SourceReview';

const roles: (TrainingRole|'staff')[] = ['owner', 'admin', 'coach', 'staff'];
export function CourseEditor({ course, overview, onSaved, onClose }: { course: Course; overview: TrainingOverview; onSaved: () => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState<CourseContent>(() => structuredClone(course.draft));
  const [savedAt, setSavedAt] = useState(course.updated_at);
  const [editors, setEditors] = useState(course.editors);
  const [dirty, setDirty] = useState(false);
  const action = useAction();
  const [uploading, setUploading] = useState(false);
  const busy = action.pending || uploading;
  function update(patch: Partial<CourseContent>) { setDraft(d => ({ ...d, ...patch })); setDirty(true); }
  function lesson(index: number, patch: Partial<Lesson>) { update({ lessons: draft.lessons.map((l, i) => i === index ? { ...l, ...patch } : l) }); }
  async function save() {
    await action.run(async () => {
      await request(`/api/training/courses/${course.id}`, 'PATCH', { draft, updated_at: savedAt });
      const fresh = await request<{ course: Course }>(`/api/training/courses/${course.id}`);
      setSavedAt(fresh.course.updated_at); setDraft(structuredClone(fresh.course.draft)); setDirty(false); await onSaved(); return true;
    }, 'Draft saved. Published enrollments are unchanged.');
  }
  async function upload(file: File, index: number) {
    setUploading(true);
    await action.run(async () => {
      const mime=trainingFileMime(file.name);
      if(!mime)throw new Error('Unsupported file format. Use a supported document, image, MP4, WebM or MP3.');
      const asset = await request<{ id: string; signedUrl: string }>('/api/training/assets', 'POST', { filename: file.name, mime, size: file.size });
      const response = await fetch(asset.signedUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: file });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Private upload failed (${response.status}): ${details}`);
      }
      await request(`/api/training/assets/${asset.id}`, 'POST', { action: 'confirm' });
      lesson(index, { assetId: asset.id });
      return true;
    }, 'Private upload confirmed. Save the draft to attach it.');
    setUploading(false);
  }
  return <section className={styles.stack}>
    <div className={styles.spread}><div><h2>Edit draft</h2><p className={styles.muted}>Formatted text, original files and practical lessons. Changes only reach learners after publishing.</p></div><Button variant="ghost" disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard unsaved draft changes?')) onClose(); }}>Close editor</Button></div>
    <Feedback {...action}/>
    <SourceReview content={draft}/>
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className={styles.stack}>
        <div className={`${styles.panel} ${styles.stack}`}>
          <label>Course title<input required value={draft.title} onChange={e => update({ title: e.target.value })}/></label>
          <label>Description<textarea value={draft.description} onChange={e => update({ description: e.target.value })}/></label>
          <div className={styles.grid}><label>Category<input required value={draft.category} onChange={e => update({ category: e.target.value })}/></label><label>Review date<input type="date" value={draft.reviewDate?.slice(0, 10) || ''} onChange={e => update({ reviewDate: e.target.value || null })}/></label></div>
          <div><p className="mb-2 text-sm">Audience</p><div className={styles.row}>{roles.map(role => <label key={role} className={styles.check}><input type="checkbox" checked={draft.audience.includes(role)} onChange={e => update({ audience: e.target.checked ? [...draft.audience, role] : draft.audience.filter(r => r !== role) })}/>{role}</label>)}</div></div>
          <p className={styles.muted}>“Coach” includes all coach accounts. For front-desk-only content, select staff without coach. An explicit assignment also grants that person access.</p>
        </div>
        <div className={styles.spread}><h2>Sections & lessons</h2><span className={styles.muted}>{draft.lessons.length} lessons</span></div>
        <p className={styles.muted}>Lesson order is the course order. Consecutive lessons with the same section name form a section; rename or move a section below to keep its lessons together.</p>
        {Array.from(new Set(draft.lessons.map(l => l.section))).map(section => <div className={`${styles.panel} ${styles.row}`} key={section}>
          <label className="min-w-0 flex-1">Section name<input defaultValue={section} onBlur={e => { if (e.target.value.trim() && e.target.value !== section) update({ lessons: draft.lessons.map(l => l.section === section ? { ...l, section: e.target.value.trim() } : l) }); }}/></label>
          <Button type="button" variant="secondary" onClick={() => { const names = Array.from(new Set(draft.lessons.map(l => l.section))); const i = names.indexOf(section); const ordered = move(names, i, -1); update({ lessons: ordered.flatMap(name => draft.lessons.filter(l => l.section === name)) }); }} disabled={Array.from(new Set(draft.lessons.map(l => l.section)))[0] === section}>Move section up</Button>
        </div>)}
        {draft.lessons.map((item, index) => <article key={item.id} className={`${styles.panel} ${styles.stack}`}>
          <div className={styles.spread}><h3>Lesson {index + 1}</h3><div className={styles.row}><Button type="button" variant="ghost" size="sm" disabled={!index} onClick={() => update({ lessons: move(draft.lessons, index, -1) })}>Up</Button><Button type="button" variant="ghost" size="sm" disabled={index === draft.lessons.length - 1} onClick={() => update({ lessons: move(draft.lessons, index, 1) })}>Down</Button><Button type="button" variant="danger" size="sm" onClick={() => { if (window.confirm(`Remove lesson "${item.title || index + 1}"?`)) update({ lessons: draft.lessons.filter((_, i) => i !== index) }); }}>Remove</Button></div></div>
          <div className={styles.grid}><label>Lesson title<input required value={item.title} onChange={e => lesson(index, { title: e.target.value })}/></label><label>Section<input required value={item.section} onChange={e => lesson(index, { section: e.target.value })}/></label></div>
          <label>Lesson type<select value={item.kind} onChange={e => lesson(index, { kind: e.target.value as Lesson['kind'] })}><option value="text">Text</option><option value="video">Video</option><option value="file">File</option><option value="checklist">Checklist</option></select></label>
          <TextEditor value={item.body} onChange={value=>lesson(index,{body:value})}/>
          <LessonSource lesson={item}/>
          <div className={styles.stack}>
            <div className={styles.spread}><h3>Video & resource references</h3><Button type="button" variant="secondary" size="sm" onClick={() => lesson(index, { references: [...(item.references || []), { url: '', label: '', kind: 'video', status: 'linked' }] })}>Add reference</Button></div>
            <p className={styles.muted}>YouTube and Loom videos can play inline. Other providers open externally. Keep unavailable references to preserve source evidence.</p>
            {(item.references || []).map((reference, ri) => {
              const updateReference = (patch: Partial<NonNullable<Lesson['references']>[number]>) => lesson(index, { references: item.references!.map((r, i) => i === ri ? { ...r, ...patch } : r) });
              return <div key={ri} className={`${styles.reference} ${styles.stack}`}>
                <div className={styles.grid}><label>Reference {ri + 1} label<input value={reference.label} onChange={e => updateReference({ label: e.target.value })}/></label><label>URL<input type="url" pattern="https?://.*" placeholder="https://" value={reference.url} onChange={e => updateReference({ url: e.target.value })}/></label></div>
                <div className={styles.grid}><label>Reference type<select value={reference.kind} onChange={e => updateReference({ kind: e.target.value as 'video' | 'resource' })}><option value="video">Video</option><option value="resource">Resource</option></select></label><label>Availability<select value={reference.status} onChange={e => updateReference({ status: e.target.value as 'linked' | 'unavailable' })}><option value="linked">Linked · verify access</option><option value="unavailable">Unavailable</option></select></label></div>
                <Button type="button" size="sm" variant="danger" onClick={() => { if (window.confirm('Remove this source reference?')) lesson(index, { references: item.references!.filter((_, i) => i !== ri) }); }}>Remove reference</Button>
              </div>;
            })}
          </div>
          {(item.kind === 'video' || item.kind === 'file') && <div className={styles.stack}>
            <label>Upload private {item.kind === 'video' ? 'video' : 'file'}<input type="file" accept={item.kind === 'video' ? 'video/*' : undefined} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file, index); e.target.value = ''; }}/></label>
            <label>Private asset<select value={item.assetId || ''} onChange={e => lesson(index, { assetId: e.target.value || undefined })}><option value="">No private file</option>{overview.assets.map(a => <option key={a.id} value={a.id}>{a.filename} · {a.status}</option>)}{item.assetId && !overview.assets.some(a => a.id === item.assetId) && <option value={item.assetId}>{item.assetId} (new upload)</option>}</select></label>
          </div>}
          <label>External link (optional dependency)<input type="url" pattern="https?://.*" placeholder="https://" value={item.externalUrl || ''} onChange={e => lesson(index, { externalUrl: e.target.value || undefined })}/></label>
          {item.externalUrl && <p className={styles.notice}>External dependency: this resource is not stored in Ballpark. Confirm access and availability before publishing.</p>}
          <label>Transcript / accessible alternative<textarea value={item.transcript || ''} onChange={e => lesson(index, { transcript: e.target.value })}/></label>
          {item.kind === 'checklist' && <label>Checklist items (one per line)<textarea required value={(item.checklist || []).join('\n')} onChange={e => lesson(index, { checklist: e.target.value.split('\n') })}/></label>}
          <label className={styles.check}><input type="checkbox" checked={!!item.managerSignoff} onChange={e => lesson(index, { managerSignoff: e.target.checked })}/>Require manager practical signoff</label>
        </article>)}
        <Button type="button" variant="secondary" onClick={() => update({ lessons: [...draft.lessons, { id: crypto.randomUUID(), title: '', section: draft.lessons.at(-1)?.section || 'Getting started', kind: 'text', body: '' }] })}>Add lesson</Button>
        <div className={`${styles.panel} ${styles.stack}`}>
          <h2>Knowledge check</h2>
          <div className={styles.grid}><label>Passing score (%)<input required type="number" min="0" max="100" value={draft.passingScore} onChange={e => update({ passingScore: Number(e.target.value) })}/></label><label>Maximum attempts<input required type="number" min="1" value={draft.maxAttempts} onChange={e => update({ maxAttempts: Number(e.target.value) })}/></label></div>
          {draft.questions.map((question, index) => <div key={question.id} className={`${styles.stack} ${styles.rule}`}>
            <div className={styles.spread}><h3>Question {index + 1}</h3><Button type="button" variant="danger" size="sm" onClick={() => update({ questions: draft.questions.filter((_, i) => i !== index) })}>Remove question</Button></div>
            <label>Question<input required value={question.prompt} onChange={e => update({ questions: draft.questions.map((q, i) => i === index ? { ...q, prompt: e.target.value } : q) })}/></label>
            <p className={styles.muted}>Check every correct choice. Learners may select multiple answers.</p>
            {question.options.map((option, oi) => <div className={styles.row} key={oi}>
              <label className={styles.check}><input type="checkbox" aria-label={`Option ${oi + 1} is correct`} checked={(question.correct || []).includes(oi)} onChange={e => update({ questions: draft.questions.map((q, i) => i === index ? { ...q, correct: e.target.checked ? [...(q.correct || []), oi] : (q.correct || []).filter(n => n !== oi) } : q) })}/></label>
              <label className="min-w-0 flex-1"><span className="sr-only">Option {oi + 1}</span><input required value={option} onChange={e => update({ questions: draft.questions.map((q, i) => i === index ? { ...q, options: q.options.map((o, j) => j === oi ? e.target.value : o) } : q) })}/></label>
              <Button type="button" size="sm" variant="ghost" onClick={() => update({ questions: draft.questions.map((q, i) => i === index ? { ...q, options: q.options.filter((_, j) => j !== oi), correct: (q.correct || []).filter(n => n !== oi).map(n => n > oi ? n - 1 : n) } : q) })}>Remove option</Button>
            </div>)}
            <Button type="button" variant="secondary" size="sm" onClick={() => update({ questions: draft.questions.map((q, i) => i === index ? { ...q, options: [...q.options, ''] } : q) })}>Add option</Button>
          </div>)}
          <Button type="button" variant="secondary" onClick={() => update({ questions: [...draft.questions, { id: crypto.randomUUID(), prompt: '', options: ['', ''], correct: [] }] })}>Add question</Button>
          <label>Required acknowledgment (leave blank if not needed)<textarea value={draft.acknowledgment} onChange={e => update({ acknowledgment: e.target.value })}/></label>
        </div>
        <div className={styles.row}><Button type="submit">{busy ? 'Saving…' : 'Save draft'}</Button><span className={styles.muted}>{dirty ? 'Unsaved changes' : 'No unsaved changes'} · Updates checked against saved revision</span></div>
      </fieldset>
    </form>
    {overview.viewer.canManage && <div className={`${styles.panel} ${styles.stack}`}><h2>Editor delegation</h2><p className={styles.muted}>Give selected team members permission to maintain this course.</p><fieldset disabled={busy} className={styles.stack}>{overview.people.map(person => <label key={person.id} className={styles.check}><input type="checkbox" checked={editors.includes(person.id)} onChange={e => setEditors(e.target.checked ? [...editors, person.id] : editors.filter(id => id !== person.id))}/>{person.name || person.email} · {person.role}</label>)}<Button type="button" variant="secondary" onClick={() => void action.run(async () => { await request(`/api/training/courses/${course.id}`, 'PATCH', { action: 'editors', editors }); await onSaved(); return true; }, 'Editor access updated.')}>Save editor access</Button></fieldset></div>}
  </section>;
}
