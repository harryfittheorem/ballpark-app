'use client';

import { useState } from 'react';
import type { TrainingOverview, TrainingRole } from '@/lib/training/types';
import { Button } from '@/components/ui/Button';
import { request, useAction } from './api';
import { Feedback } from './ui';
import styles from './training.module.css';

export function Assignments({ overview, onSaved, initialCourseId = '' }: { overview: TrainingOverview; onSaved: () => Promise<void>; initialCourseId?: string }) {
  const [kind, setKind] = useState('course');
  const [target, setTarget] = useState(initialCourseId);
  const [selected, setSelected] = useState<string[]>([]);
  const [due, setDue] = useState('');
  const [search, setSearch] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const action = useAction();
  const people = overview.people.filter(p => `${p.name} ${p.email} ${p.role} ${p.staff ? 'front desk staff' : ''}`.toLowerCase().includes(search.toLowerCase()));
  function bulk(role: TrainingRole) { const ids = overview.people.filter(p => p.role === role).map(p => p.id); const all = ids.every(id => selected.includes(id)); setSelected(all ? selected.filter(id => !ids.includes(id)) : Array.from(new Set([...selected, ...ids]))); }
  return <form className={`${styles.panel} ${styles.stack}`} onSubmit={e => { e.preventDefault(); setResultMessage(''); void action.run(async () => { const result = await request<{ count: number }>('/api/training/assignments', 'POST', { ...(kind === 'course' ? { courseId: target } : { pathId: target }), userIds: selected, ...(due ? { dueAt: new Date(`${due}T23:59:59`).toISOString() } : {}) }); await onSaved(); return result; }).then(result => { if (result) { setSelected([]); setResultMessage(`${result.count} enrollment(s) created.`); } }); }}>
    <h2>Assign training</h2><p className={styles.muted}>Assign a published course or the ordered courses in a learning path. Each enrollment retains its published version.</p>
    <Feedback {...action}/>
    <Feedback message={resultMessage}/>
    <fieldset disabled={action.pending} className={styles.stack}>
      <div className={styles.grid}><label>Assignment type<select value={kind} onChange={e => { setKind(e.target.value); setTarget(''); }}><option value="course">Course</option><option value="path">Learning path</option></select></label><label>{kind === 'course' ? 'Published course' : 'Learning path'}<select required value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose…</option>{kind === 'course' ? overview.courses.filter(c => c.published_version && !c.archived).map(c => <option key={c.id} value={c.id}>{c.draft.title}</option>) : overview.paths.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div>
      <label>Due date (optional, end of day in your timezone)<input type="date" value={due} onChange={e => setDue(e.target.value)}/></label>
      <div className={styles.spread}><h3>People · {selected.length} selected</h3><Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>Clear</Button></div>
      <div className={styles.row}>{(['owner', 'admin', 'coach'] as const).map(role => <Button key={role} type="button" variant="secondary" size="sm" onClick={() => bulk(role)}>Toggle all {role}s</Button>)}<Button type="button" variant="secondary" size="sm" onClick={() => { const ids = overview.people.filter(p => p.staff).map(p => p.id); setSelected(ids.every(id => selected.includes(id)) ? selected.filter(id => !ids.includes(id)) : Array.from(new Set([...selected, ...ids]))); }}>Toggle front-desk staff</Button></div>
      <label>Find a person<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email or role"/></label>
      <div className="max-h-72 overflow-y-auto space-y-3">{people.map(person => <label className={styles.check} key={person.id}><input type="checkbox" checked={selected.includes(person.id)} onChange={e => setSelected(e.target.checked ? [...selected, person.id] : selected.filter(id => id !== person.id))}/><span>{person.name || person.email}<span className={`block ${styles.muted}`}>{person.email} · {person.role}{person.staff ? ' · staff' : ''}</span></span></label>)}{!people.length && <p className={styles.muted}>No people match this search.</p>}</div>
      <Button type="submit" disabled={!selected.length || !target}>{action.pending ? 'Assigning…' : 'Create assignments'}</Button>
    </fieldset>
  </form>;
}
