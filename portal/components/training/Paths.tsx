'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LearningPath, TrainingOverview } from '@/lib/training/types';
import { Button } from '@/components/ui/Button';
import { request, useAction } from './api';
import { Empty, Feedback, move } from './ui';
import styles from './training.module.css';

export function Paths({ overview, onSaved }: { overview: TrainingOverview; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState<Partial<LearningPath> | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [add, setAdd] = useState('');
  const action = useAction();
  function open(path?: LearningPath) { setEditing(path || {}); setTitle(path?.title || ''); setDescription(path?.description || ''); setIds(path?.course_ids || []); }
  return <div className={styles.stack}><div className={styles.spread}><div><h2>Learning paths</h2><p className={styles.muted}>A deliberate order for onboarding and ongoing development.</p></div>{overview.viewer.canManage && <Button disabled={action.pending} onClick={() => open()}>Create path</Button>}</div><Feedback {...action}/>
    {editing && <form className={`${styles.panel} ${styles.stack}`} onSubmit={e => { e.preventDefault(); void action.run(async () => { await request(editing.id ? `/api/training/paths/${editing.id}` : '/api/training/paths', editing.id ? 'PATCH' : 'POST', { title, description, courseIds: ids }); setEditing(null); await onSaved(); return true; }, 'Learning path saved.'); }}><fieldset disabled={action.pending} className={styles.stack}>
      <h3>{editing.id ? 'Edit path' : 'New path'}</h3><label>Title<input required value={title} onChange={e => setTitle(e.target.value)}/></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)}/></label>
      <ol className={styles.stack}>{ids.map((id, i) => <li className={styles.spread} key={id}><span>{i + 1}. {overview.courses.find(c => c.id === id)?.draft.title || id}</span><div className={styles.row}><Button type="button" size="sm" variant="ghost" disabled={!i} onClick={() => setIds(move(ids, i, -1))}>Up</Button><Button type="button" size="sm" variant="ghost" disabled={i === ids.length - 1} onClick={() => setIds(move(ids, i, 1))}>Down</Button><Button type="button" size="sm" variant="danger" onClick={() => setIds(ids.filter(c => c !== id))}>Remove</Button></div></li>)}</ol>
      <div className={styles.row}><label className="min-w-0 flex-1">Add published course<select value={add} onChange={e => setAdd(e.target.value)}><option value="">Choose course…</option>{overview.courses.filter(c => c.published_version && !c.archived && !ids.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.draft.title}</option>)}</select></label><Button type="button" variant="secondary" disabled={!add} onClick={() => { setIds([...ids, add]); setAdd(''); }}>Add to path</Button></div>
      <div className={styles.row}><Button type="submit" disabled={!ids.length}>Save path</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
    </fieldset></form>}
    {!overview.paths.length && <Empty title="Build a repeatable starting point">Create a path from published courses, then assign it to your team.</Empty>}
    {overview.paths.map(path => <article key={path.id} className={`${styles.panel} ${styles.stack}`}><div className={styles.spread}><h3>{path.title}</h3>{overview.viewer.canManage && <div className={styles.row}><Button variant="secondary" size="sm" disabled={action.pending} onClick={() => open(path)}>Edit</Button><Button variant="danger" size="sm" disabled={action.pending} onClick={() => { if (window.confirm('Delete this path? Only unassigned paths can be deleted.')) void action.run(async () => { await request(`/api/training/paths/${path.id}`, 'DELETE'); await onSaved(); return true; }, 'Path deleted.'); }}>Delete</Button></div>}</div><p className={styles.muted}>{path.description}</p><ol className="space-y-2">{path.course_ids.map((id, i) => <li key={id} className="text-sm">{i + 1}. {overview.courses.some(c => c.id === id) ? <Link className={styles.link} href={`/training/courses/${id}`}>{overview.courses.find(c => c.id === id)?.draft.title}</Link> : 'Course unavailable'}</li>)}</ol></article>)}
  </div>;
}
