'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CourseDetail } from './api';
import { request, useAction } from './api';
import { date, Empty, Feedback } from './ui';
import styles from './training.module.css';
import { FormattedText } from './FormattedText';
import { safeUrl } from './media';
import { LessonMedia } from './LessonMedia';

function PrivateAsset({ id, video }: { id: string; video: boolean }) {
  const [url, setUrl] = useState('');
  const action = useAction();
  return <div className={styles.stack}><Feedback {...action}/>{url ? video ? <video controls preload="metadata" src={url} className="max-h-[480px] w-full rounded-lg" onError={() => setUrl('')}/> : <a className={styles.link} href={url} target="_blank" rel="noopener noreferrer">Open private file (temporary link)</a> : <Button variant="secondary" disabled={action.pending} onClick={() => void action.run(async () => { const result = await request<{ url: string }>(`/api/training/assets/${id}`); if (!safeUrl(result.url)) throw new Error('The file service returned an invalid URL.'); setUrl(result.url); return true; })}>{action.pending ? 'Preparing private access…' : video ? 'Load private video' : 'Get private file'}</Button>}<p className={styles.muted}>Access links expire. Reload private access if needed.</p>{url && <Button size="sm" variant="ghost" onClick={() => setUrl('')}>Reset access link</Button>}</div>;
}
export function CourseLearner({ detail, onSaved }: { detail: CourseDetail; onSaved: () => Promise<void> }) {
  const { assignment, content, progress, attempts } = detail;
  const firstIncomplete = content.lessons.findIndex(l => !progress.some(p => p.lesson_id === l.id));
  const [active, setActive] = useState(Math.max(0, firstIncomplete));
  const [checkedByLesson, setCheckedByLesson] = useState<Record<string, number[]>>({});
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [name, setName] = useState('');
  const [quizResult, setQuizResult] = useState('');
  const action = useAction();
  const lesson = content.lessons[active];
  const passed = attempts.some(a => a.passed);
  const completedCount = content.lessons.filter(l => progress.some(p => p.lesson_id === l.id)).length;
  const allLessons = completedCount === content.lessons.length;
  const allSignoffs = content.lessons.filter(l => l.managerSignoff).every(l => progress.some(p => p.lesson_id === l.id && p.signed_off_by));
  const isComplete = !!assignment?.completed_at;
  if (!assignment) return <Empty title="No enrollment selected">Choose an assigned enrollment to begin. Published courses require enrollment so your progress and version can be retained.</Empty>;
  return <div className={styles.stack}>
    <div className={styles.notice}><div className={styles.spread}><span>Version {assignment.version} · {isComplete ? `Completed ${date(assignment.completed_at)}` : `${completedCount} of ${content.lessons.length} lessons completed`}</span><span className={styles.muted}>{date(assignment.due_at)}</span></div><progress aria-label="Course lesson progress" className="mt-3 h-2 w-full accent-gold" value={completedCount} max={Math.max(1, content.lessons.length)}/></div>
    <Feedback {...action}/>
    <div className={styles.detail}>
      <aside className={styles.panel}><h3 className="mb-3">Course outline</h3>{content.lessons.map((l, i) => <div key={l.id}>{(!i || content.lessons[i - 1].section !== l.section) && <p className={`${styles.eyebrow} mt-5`}>{l.section}</p>}<button type="button" className={styles.lessonNav} aria-current={active === i} disabled={action.pending} onClick={() => setActive(i)}>{i + 1}. {l.title}<span className={`mt-1 block ${styles.muted}`}>{progress.some(p => p.lesson_id === l.id) ? 'Completed' : 'Not completed'}{l.managerSignoff ? ' · practical' : ''}</span></button></div>)}</aside>
      <div className={styles.stack}>
        {lesson ? <article className={`${styles.panel} ${styles.stack}`} key={lesson.id}>
          <div><p className={styles.eyebrow}>{lesson.kind} lesson · {active + 1} / {content.lessons.length}</p><h2>{lesson.title}</h2></div>
          <LessonMedia lesson={lesson}/>
          <FormattedText text={lesson.body}/>
          {lesson.assetId && <PrivateAsset id={lesson.assetId} video={lesson.kind === 'video'}/>}
          {lesson.transcript && <details><summary className="cursor-pointer text-sm text-gold">Transcript / accessible alternative</summary><div className={`${styles.pre} mt-4`}>{lesson.transcript}</div></details>}
          {lesson.kind === 'checklist' && <fieldset className={styles.stack} disabled={action.pending || isComplete || progress.some(p => p.lesson_id === lesson.id)}><legend className="mb-3 text-sm">Complete each step</legend>{(lesson.checklist || []).map((item, i) => <label className={styles.check} key={i}><input type="checkbox" checked={progress.some(p => p.lesson_id === lesson.id) || (checkedByLesson[lesson.id] || []).includes(i)} onChange={e => setCheckedByLesson({ ...checkedByLesson, [lesson.id]: e.target.checked ? [...(checkedByLesson[lesson.id] || []), i] : (checkedByLesson[lesson.id] || []).filter(n => n !== i) })}/>{item}</label>)}</fieldset>}
          {lesson.managerSignoff && <p className={styles.notice}>{progress.some(p => p.lesson_id === lesson.id && p.signed_off_by) ? 'Manager practical signoff recorded.' : 'Manager verification needed. A manager must observe this practical and record its completion; you cannot mark this lesson complete yourself.'}</p>}
          <div className={styles.row}><Button disabled={action.pending || isComplete || !!lesson.managerSignoff || progress.some(p => p.lesson_id === lesson.id) || (lesson.kind === 'checklist' && (lesson.checklist || []).some((_, i) => !(checkedByLesson[lesson.id] || []).includes(i)))} onClick={() => { if (lesson.managerSignoff) return; void action.run(async () => { await request('/api/training/progress', 'POST', { assignmentId: assignment.id, lessonId: lesson.id, ...(lesson.kind === 'checklist' ? { checked: checkedByLesson[lesson.id] || [] } : {}) }); await onSaved(); return true; }, 'Lesson completion saved.'); }}>{progress.some(p => p.lesson_id === lesson.id) ? 'Lesson completed' : lesson.managerSignoff ? 'Manager verification needed' : 'Mark lesson complete'}</Button><Button variant="secondary" disabled={action.pending || active === 0} onClick={() => setActive(active - 1)}>Previous lesson</Button><Button variant="secondary" disabled={action.pending || active >= content.lessons.length - 1} onClick={() => setActive(active + 1)}>Next lesson</Button></div>
        </article> : <Empty title="No lessons available">This course has no lesson content. Contact your manager before proceeding.</Empty>}
        {content.questions.length > 0 && <form className={`${styles.panel} ${styles.stack}`} onSubmit={e => { e.preventDefault(); setQuizResult(''); void action.run(async () => { const result = await request<{ score: number; passed: boolean }>('/api/training/attempts', 'POST', { assignmentId: assignment.id, answers }); await onSaved(); return result; }).then(result => { if (result) setQuizResult(`Score: ${result.score}%. ${result.passed ? 'Passed.' : 'Not passed. Review the course before trying again.'}`); }); }}>
          <h2>Knowledge check</h2><p className={styles.muted}>Passing score {content.passingScore}% · {attempts.length} of {content.maxAttempts} attempts used. Select every answer that applies.</p>
          {quizResult && <p className={styles.notice} role="status">{quizResult}</p>}
          <fieldset disabled={action.pending || isComplete || passed || attempts.length >= content.maxAttempts} className={styles.stack}>{content.questions.map((q, i) => <fieldset className={styles.stack} key={q.id}><legend className="mb-3 text-sm">{i + 1}. {q.prompt}</legend>{q.options.map((option, oi) => <label key={oi} className={styles.check}><input type="checkbox" checked={(answers[q.id] || []).includes(oi)} onChange={e => setAnswers({ ...answers, [q.id]: e.target.checked ? [...(answers[q.id] || []), oi] : (answers[q.id] || []).filter(n => n !== oi) })}/>{option}</label>)}</fieldset>)}<Button type="submit" disabled={!allLessons || content.questions.some(q => !(answers[q.id] || []).length)}>Submit knowledge check</Button></fieldset>
          {!allLessons && <p className={styles.muted}>Complete all lessons before submitting.</p>}
          {attempts.length > 0 && <ul className="space-y-2 text-sm">{attempts.map(a => <li key={a.id}>{date(a.created_at)} · {a.score}% · {a.passed ? 'Passed' : 'Not passed'}</li>)}</ul>}
          {!passed && attempts.length >= content.maxAttempts && <p className={styles.notice}>No attempts remaining. Contact your manager for next steps.</p>}
        </form>}
        <form className={`${styles.panel} ${styles.stack}`} onSubmit={e => { e.preventDefault(); void action.run(async () => { await request('/api/training/complete', 'POST', { assignmentId: assignment.id, ...(content.acknowledgment ? { acknowledgedName: name } : {}) }); await onSaved(); return true; }, 'Course completion recorded.'); }}>
          <h2>{isComplete ? 'Training completed' : 'Finish training'}</h2>
          {content.acknowledgment && <div className={styles.pre}>{content.acknowledgment}</div>}
          <fieldset disabled={action.pending || isComplete} className={styles.stack}>{content.acknowledgment && <label>Your full name as acknowledgment<input required autoComplete="name" value={isComplete ? assignment.acknowledged_name || '' : name} onChange={e => setName(e.target.value)}/></label>}<Button type="submit" disabled={!allLessons || !allSignoffs || (!!content.questions.length && !passed) || (!!content.acknowledgment && !name.trim())}>{isComplete ? 'Completion recorded' : content.acknowledgment ? 'Acknowledge & complete course' : 'Complete course'}</Button></fieldset>
          {(!allLessons || !allSignoffs || (!!content.questions.length && !passed)) && <p className={styles.muted}>Required: complete every lesson{content.questions.length ? ', pass the knowledge check' : ''}{content.lessons.some(l => l.managerSignoff) ? ', receive practical signoffs' : ''}.</p>}
          {assignment.acknowledged_at && <p className={styles.muted}>Acknowledged by {assignment.acknowledged_name} on {date(assignment.acknowledged_at)}.</p>}
        </form>
      </div>
    </div>
  </div>;
}
