'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { request, useAction, useResource, type CourseDetail } from './api';
import { date, Empty, Feedback, LoadError, Loading, Raw } from './ui';
import styles from './training.module.css';

type ReportRow = { assignmentId: string; courseId: string; course: string; userId: string; name: string; email: string; version: number; dueAt: string | null; completedAt: string | null; acknowledgedAt: string | null; acknowledgedName: string | null; progress: number; total: number; score: number | null; status: string; source: string };
type Report = { rows: ReportRow[]; history: unknown[]; audit: unknown[] };
export function Reports() {
  const report = useResource<Report>('/api/training/reports');
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [search, setSearch] = useState('');
  if (!report.data) return report.error ? <LoadError error={report.error} retry={() => void report.reload()}/> : <Loading/>;
  const rows = report.data.rows.filter(r => `${r.name} ${r.email} ${r.course} ${r.status}`.toLowerCase().includes(search.toLowerCase()));
  return <div className={styles.stack}><div className={styles.spread}><div><h2>Training records</h2><p className={styles.muted}>Enrollment evidence, practical signoffs and historical source records.</p></div><a className="rounded-xl border border-border-gold-strong px-4 py-2 text-sm text-gold" href="/api/training/reports?format=csv">Download CSV</a></div><Feedback error={report.error}/>
    <label>Search records<input type="search" placeholder="Person, course or status" value={search} onChange={e => setSearch(e.target.value)}/></label>
    <div className={`${styles.panel} ${styles.tableWrap}`}><table className={styles.table}><thead><tr><th>Person / course</th><th>Progress</th><th>Due / status</th><th>Evidence</th><th>Practical</th></tr></thead><tbody>{rows.map(row => <tr key={row.assignmentId}><td><strong>{row.name || row.email}</strong><p className={styles.muted}>{row.email}</p><p className="mt-2">{row.course} · v{row.version}</p></td><td>{row.progress} / {row.total}<p className={styles.muted}>Score {row.score === null ? '—' : `${row.score}%`}</p></td><td>{date(row.dueAt)}<p className="mt-2"><span className={styles.badge}>{row.status}</span></p></td><td><p className={styles.muted}>Source: {row.source}</p>{row.completedAt && <p>Completed {date(row.completedAt)}</p>}{row.acknowledgedAt && <p className={styles.muted}>{row.acknowledgedName} · acknowledged {date(row.acknowledgedAt)}</p>}</td><td><Button variant="secondary" size="sm" onClick={() => setSelected(row)}>View lessons</Button></td></tr>)}</tbody></table>{!rows.length && <Empty title="No matching training records">Assigned training will appear here. Adjust your search or create an assignment.</Empty>}</div>
    {selected && <Signoff key={selected.assignmentId} row={selected} onClose={() => setSelected(null)} onSaved={report.reload}/>}
    <Raw label="Historical source evidence (not native completions)" value={report.data.history}/><Raw label="Audit history" value={report.data.audit}/>
  </div>;
}
function Signoff({ row, onClose, onSaved }: { row: ReportRow; onClose: () => void; onSaved: () => Promise<void> }) {
  const detail = useResource<CourseDetail>(`/api/training/courses/${row.courseId}?assignmentId=${encodeURIComponent(row.assignmentId)}`);
  const action = useAction();
  return <section className={`${styles.panel} ${styles.stack}`}><div className={styles.spread}><div><h2>Practical observation</h2><p className={styles.muted}>{row.name || row.email} · {row.course} · v{row.version}</p></div><Button disabled={action.pending} variant="ghost" onClick={onClose}>Close</Button></div><Feedback {...action}/>{!detail.data ? detail.error ? <LoadError error={detail.error} retry={() => void detail.reload()}/> : <Loading/> : <><p className={styles.notice}>Only sign off work you have personally observed. This creates an auditable manager record for the selected enrollment.</p>{detail.data.content.lessons.filter(l => l.managerSignoff).map(lesson => {
    const progress = detail.data!.progress.find(p => p.lesson_id === lesson.id);
    return <div key={lesson.id} className={`${styles.rule} ${styles.stack}`}><h3>{lesson.section} / {lesson.title}</h3><div className={styles.pre}>{lesson.body}</div>{lesson.checklist?.length ? <ul className="list-inside list-disc text-sm">{lesson.checklist.map((item, i) => <li key={i}>{item}</li>)}</ul> : null}<p className={styles.muted}>{progress ? `Completion recorded ${date(progress.completed_at)}` : 'Manager verification needed. The learner cannot mark this practical complete.'}{progress?.signed_off_by ? ` · Signed off by ${progress.signed_off_by}` : ''}</p><Button variant="secondary" disabled={action.pending || !!progress?.signed_off_by} onClick={() => { if (window.confirm(`Confirm that you observed ${row.name || row.email} completing "${lesson.title}"?`)) void action.run(async () => { await request('/api/training/signoff', 'POST', { assignmentId: row.assignmentId, lessonId: lesson.id }); await detail.reload(); await onSaved(); return true; }, 'Practical signoff recorded.'); }}>{progress?.signed_off_by ? 'Signoff recorded' : 'Record observed practical signoff'}</Button></div>;
  })}{!detail.data.content.lessons.some(l => l.managerSignoff) && <Empty title="No practical signoffs required">This course does not require manager observations.</Empty>}<Raw label="Enrollment lesson and attempt evidence" value={{ assignment: detail.data.assignment, progress: detail.data.progress, attempts: detail.data.attempts }}/></>}</section>;
}
