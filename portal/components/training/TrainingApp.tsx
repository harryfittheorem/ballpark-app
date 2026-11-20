'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ClipboardCheck, Search, ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { emptyCourse, type TrainingOverview } from '@/lib/training/types';
import { request, useAction, useResource, type CourseDetail } from './api';
import { date, Empty, Feedback, LoadError, Loading, Raw } from './ui';
import { Assignments } from './Assignments';
import { CourseEditor } from './CourseEditor';
import { CourseLearner } from './CourseLearner';
import { Paths } from './Paths';
import { Reports } from './Reports';
import { Migration } from './Migration';
import { Rules } from './Rules';
import { FormattedText } from './FormattedText';
import styles from './training.module.css';

export function TrainingApp({ courseId }: { courseId?: string }) {
  const overview = useResource<TrainingOverview>('/api/training');
  return <div className={styles.app}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Team training / Operations</p><h1>Training Playbook</h1><p className={`${styles.muted} mt-3`}>The playbook for how we coach, serve families and run the facility.</p></div><span className={`${styles.badge} mt-1`}>Ballpark Training</span></header>
    {!overview.data ? overview.error ? <LoadError error={overview.error} retry={() => void overview.reload()}/> : <Loading/> : <><Feedback error={overview.error}/>{courseId ? <CourseScreen courseId={courseId} overview={overview.data} refreshOverview={overview.reload}/> : <Overview overview={overview.data} onSaved={overview.reload}/>}</>}
  </div>;
}

function Overview({ overview, onSaved }: { overview: TrainingOverview; onSaved: () => Promise<void> }) {
  const [tab, setTab] = useState('My Training');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const router = useRouter();
  const action = useAction();
  const manager = overview.viewer.canManage;
  const mine = overview.assignments.filter(a => a.user_id === overview.viewer.id);
  const incomplete = mine.filter(a => !a.completed_at);
  const tabs = ['My Training', 'Library', 'Learning Paths', ...(manager ? ['Assignments', 'Onboarding Rules', 'Reports', 'Migration'] : [])];
  const courses = overview.courses.filter(c => {
    const searchable = [c.draft.title, c.draft.description, c.draft.category, ...c.draft.lessons.flatMap(l => [l.title, l.section, l.body, l.transcript || '', ...(l.checklist || [])])].join(' ').toLowerCase();
    return searchable.includes(query.toLowerCase()) && (!category || c.draft.category === category) && (status === 'all' || (status === 'archived' ? c.archived : !c.archived));
  });
  return <div className={styles.stack}>
    <nav className={styles.tabs} aria-label="Training sections" role="tablist">{tabs.map(t => <button className={styles.tab} id={`training-tab-${t.replaceAll(' ', '-')}`} key={t} type="button" role="tab" aria-selected={tab === t} aria-controls="training-tab-panel" onClick={() => setTab(t)}>{t}</button>)}</nav>
    <Feedback {...action}/>
    <section className={styles.stack} role="tabpanel" id="training-tab-panel" aria-labelledby={`training-tab-${tab.replaceAll(' ', '-')}`}>
      {tab === 'My Training' && <>
        <div className={styles.spread}><div><h2>Your next reps</h2><p className={styles.muted}>{incomplete.length} active enrollment{incomplete.length === 1 ? '' : 's'} · {mine.filter(a => a.completed_at).length} completed</p></div><ClipboardCheck size={27} className="text-gold"/></div>
        {!mine.length && <Empty title="You’re ready for your first course"><p>Assigned training will appear here with your due dates and progress.</p><Button className="mt-4" variant="secondary" onClick={() => setTab('Library')}>Explore the library</Button></Empty>}
        {[...incomplete, ...mine.filter(a => a.completed_at)].map(a => {
          const course = overview.courses.find(c => c.id === a.course_id);
          return <article className={`${styles.panel} ${styles.spread}`} key={a.id}><div><p className={`${styles.eyebrow} mb-2`}>{course?.draft.category || 'Training'} · version {a.version}</p><h3>{course?.draft.title || 'Assigned course'}</h3><p className={`${styles.muted} mt-2`}>{a.completed_at ? `Completed ${date(a.completed_at)}` : a.due_at ? `Due ${date(a.due_at)}` : 'No due date'}{a.path_id ? ` · Path: ${overview.paths.find(p => p.id === a.path_id)?.title || 'Learning path'}` : ''}</p></div><Link className="inline-flex items-center gap-2 rounded-xl border border-border-gold-strong px-4 py-2 text-sm text-gold" href={`/training/courses/${a.course_id}?assignmentId=${encodeURIComponent(a.id)}`}>{a.completed_at ? 'Review' : 'Open training'}<ArrowRight size={14}/></Link></article>;
        })}
      </>}
      {tab === 'Library' && <>
        <div className={styles.spread}><div><h2>Team playbook</h2><p className={styles.muted}>Search courses, procedures, lesson text and transcripts.</p></div>{manager && <Button disabled={action.pending} onClick={() => setCreating(!creating)}><Plus size={15}/>Create course</Button>}</div>
        {creating && <form className={`${styles.panel} ${styles.stack}`} onSubmit={e => { e.preventDefault(); void action.run(async () => { const created = await request<{ id: string }>('/api/training/courses', 'POST', { draft: { ...emptyCourse(), title } }); await onSaved(); router.push(`/training/courses/${created.id}`); return created; }, 'Draft created.'); }}><fieldset disabled={action.pending} className={styles.stack}><label>New course title<input required value={title} onChange={e => setTitle(e.target.value)} autoFocus/></label><div className={styles.row}><Button type="submit">Create draft</Button><Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button></div></fieldset></form>}
        <div className={`${styles.panel} ${styles.grid}`}><label><span className={styles.row}><Search size={14}/>Search the playbook</span><input type="search" placeholder="Find a procedure, topic or phrase" value={query} onChange={e => setQuery(e.target.value)}/></label><div className={styles.grid}><label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{Array.from(new Set(overview.courses.map(c => c.draft.category))).sort().map(c => <option key={c}>{c}</option>)}</select></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active</option>{manager && <><option value="archived">Archived</option><option value="all">All content</option></>}</select></label></div></div>
        <p className={styles.muted}>{courses.length} course{courses.length === 1 ? '' : 's'}</p>
        {!courses.length && <Empty title={query || category ? 'No matching procedures' : 'The library is waiting for its first playbook'}>{query || category ? 'Try another phrase or choose all categories.' : manager ? 'Create a draft, add practical lessons and publish when it is ready.' : 'Published training will appear here when it is available to your role.'}</Empty>}
        {courses.map(c => <article key={c.id} className={`${styles.panel} ${styles.spread}`}><div><div className={`${styles.row} mb-3`}><span className={styles.badge}>{c.draft.category}</span><span className={styles.muted}>{c.archived ? 'Archived' : c.published_version ? `Published v${c.published_version}` : 'Draft'} · {c.draft.lessons.length} lessons</span></div><Link className="font-display text-xl text-cream-light hover:text-gold" href={`/training/courses/${c.id}`}>{c.draft.title}</Link><p className={`${styles.muted} mt-2 max-w-3xl`}>{c.draft.description}</p>{c.draft.reviewDate && <p className={`${styles.muted} mt-2`}>Review {date(c.draft.reviewDate)}</p>}</div><Link href={`/training/courses/${c.id}`} aria-label={`Open ${c.draft.title}`} className="rounded-lg border border-border-gold p-3 text-gold"><BookOpen size={18}/></Link></article>)}
      </>}
      {tab === 'Learning Paths' && <Paths overview={overview} onSaved={onSaved}/>}
      {tab === 'Assignments' && manager && <Assignments overview={overview} onSaved={onSaved}/>}
      {tab === 'Onboarding Rules' && manager && <Rules overview={overview} onSaved={onSaved}/>}
      {tab === 'Reports' && manager && <Reports/>}
      {tab === 'Migration' && manager && <Migration overview={overview} onSaved={onSaved}/>}
    </section>
  </div>;
}

function CourseScreen({ courseId, overview, refreshOverview }: { courseId: string; overview: TrainingOverview; refreshOverview: () => Promise<void> }) {
  const [enrollment, setEnrollment] = useState('');
  const [tab, setTab] = useState('Learn');
  const [freshKey, setFreshKey] = useState(0);
  const action = useAction();
  useEffect(() => { setEnrollment(new URLSearchParams(window.location.search).get('assignmentId') || ''); setTab('Learn'); }, [courseId]);
  const detail = useResource<CourseDetail>(`/api/training/courses/${courseId}${enrollment ? `?assignmentId=${encodeURIComponent(enrollment)}` : ''}`);
  async function reload() { await Promise.all([detail.reload(), refreshOverview()]); }
  if (!detail.data) return detail.error ? <LoadError error={detail.error} retry={() => void detail.reload()}/> : <Loading/>;
  const { course, content, assignment, revisions } = detail.data;
  const canEdit = overview.viewer.canManage || course.editors.includes(overview.viewer.id);
  const mine = overview.assignments.filter(a => a.user_id === overview.viewer.id && a.course_id === courseId);
  const courseTabs = ['Learn', ...(canEdit ? ['Edit draft', 'Revision history'] : []), ...(overview.viewer.canManage ? ['Assign'] : [])];
  async function courseAction(kind: string) {
    if (!overview.viewer.canManage) return;
    const prompts: Record<string, string> = { publish: 'Publish the saved draft as a new immutable version? Existing enrollments retain their assigned version.', archive: 'Archive this course? It will no longer be available for new assignments.', restore: 'Restore this course to the active library?', duplicate: 'Create a separate draft copy of this course?' };
    if (!window.confirm(prompts[kind])) return;
    await action.run(async () => { const result = await request<{ id: string }>(`/api/training/courses/${courseId}`, 'PATCH', { action: kind }); await reload(); return result; }, kind === 'duplicate' ? 'Draft copy created. Find it in the library.' : 'Course updated.');
  }
  return <div className={styles.stack}>
    <Link href="/training" className={`${styles.link} text-sm`}>← All training</Link>
    <Feedback error={detail.error}/><Feedback {...action}/>
    <div className={`${styles.panel} ${styles.stack}`}><div className={styles.header}><div><p className={styles.eyebrow}>{content.category} · {course.archived ? 'Archived' : course.published_version ? `Published v${course.published_version}` : 'Unpublished draft'}</p><h2 className="!text-3xl">{content.title || course.draft.title}</h2><p className={`${styles.muted} mt-3`}>{content.description}</p></div>{content.reviewDate && <span className={styles.badge}>Review {date(content.reviewDate)}</span>}</div>
      {overview.viewer.canManage && <div className={styles.row}><Button variant="secondary" disabled={action.pending || detail.loading || course.archived || tab === 'Edit draft'} onClick={() => void courseAction('publish')}>Publish saved draft</Button><Button variant="secondary" disabled={action.pending || detail.loading} onClick={() => void courseAction('duplicate')}>Duplicate</Button><Button variant={course.archived ? 'secondary' : 'danger'} disabled={action.pending || detail.loading || tab === 'Edit draft'} onClick={() => void courseAction(course.archived ? 'restore' : 'archive')}>{course.archived ? 'Restore course' : 'Archive course'}</Button></div>}
      {tab === 'Edit draft' && <p className={styles.muted}>Close the editor after saving to publish. Unsaved text is not published.</p>}
    </div>
    <nav className={styles.tabs} role="tablist" aria-label="Course views">{courseTabs.map(t => <button type="button" role="tab" aria-controls="course-tab-panel" aria-selected={tab === t} key={t} className={styles.tab} disabled={action.pending} onClick={() => { if (tab !== 'Edit draft' || window.confirm('Leave the draft editor? Any unsaved changes will be lost.')) setTab(t); }}>{t}</button>)}</nav>
    <div id="course-tab-panel" role="tabpanel" aria-label={tab} className={styles.stack}>
      {tab === 'Learn' && <>
        {mine.length > 0 && <label>My enrollment<select disabled={action.pending || detail.loading} value={enrollment || assignment?.id || ''} onChange={e => { setEnrollment(e.target.value); setFreshKey(k => k + 1); window.history.replaceState(null, '', `/training/courses/${courseId}?assignmentId=${encodeURIComponent(e.target.value)}`); }}><option value="">Select enrollment…</option>{mine.map(a => <option key={a.id} value={a.id}>Version {a.version} · {a.completed_at ? 'Completed' : a.due_at ? `Due ${date(a.due_at)}` : 'In progress'} · {date(a.created_at)}</option>)}</select></label>}
        {assignment ? <CourseLearner key={`${assignment.id}-${freshKey}`} detail={detail.data} onSaved={detail.reload}/> : <div className={`${styles.panel} ${styles.stack}`}><h2>{course.published_version ? 'Ready to begin?' : 'Draft preview'}</h2><p className={styles.muted}>{course.published_version ? 'Enroll in the published version to save lesson progress, take the knowledge check and record completion.' : 'This course has not been published. Learner completion is unavailable until a version is published and assigned.'}</p>
          {course.published_version && !course.archived && <Button disabled={action.pending || detail.loading} onClick={() => void action.run(async () => { await request('/api/training/assignments', 'POST', { courseId, userIds: [overview.viewer.id] }); await reload(); const result = await request<TrainingOverview>('/api/training'); const own = result.assignments.filter(a => a.user_id === overview.viewer.id && a.course_id === courseId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]; if (own) setEnrollment(own.id); return true; }, 'Enrollment ready.')}>Start training</Button>}
          {content.lessons.map((l, i) => <div key={l.id} className={styles.rule}><p className={styles.muted}>{l.section} · {l.kind}{l.managerSignoff ? ' · manager practical signoff' : ''}</p><h3>{i + 1}. {l.title}</h3>{canEdit && <FormattedText text={l.body}/>}</div>)}
          {!content.lessons.length && <Empty title="No lessons yet">Add the first lesson in the draft editor.</Empty>}
        </div>}
      </>}
      {tab === 'Edit draft' && canEdit && <CourseEditor key={course.id} course={course} overview={overview} onSaved={reload} onClose={() => setTab('Learn')}/>}
      {tab === 'Revision history' && canEdit && <div className={styles.stack}><h2>Published revisions</h2><p className={styles.muted}>Published revisions are immutable. Learner enrollments remain pinned to their assigned version.</p>{!revisions.length && <Empty title="Not published yet">The first published revision will be recorded here.</Empty>}{[...revisions].sort((a, b) => b.version - a.version).map(revision => <article key={revision.version} className={`${styles.panel} ${styles.stack}`}><div className={styles.spread}><h3>Version {revision.version}: {revision.content.title}</h3><span className={styles.badge}>{revision.content.lessons.length} lessons</span></div><p className={styles.muted}>Published {date(revision.published_at)} by {overview.people.find(p => p.id === revision.published_by)?.name || revision.published_by}</p><p className={styles.muted}>{revision.content.description}</p><Raw label="Inspect complete revision evidence" value={revision}/></article>)}</div>}
      {tab === 'Assign' && overview.viewer.canManage && <Assignments overview={overview} initialCourseId={courseId} onSaved={reload}/>}
    </div>
  </div>;
}

export default TrainingApp;
