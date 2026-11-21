'use client';

import { useState } from 'react';
import type { CourseContent } from '@/lib/training/types';
import { Button } from '@/components/ui/Button';
import { Empty } from './ui';
import { FormattedText } from './FormattedText';
import { LessonMedia } from './LessonMedia';
import { LessonSource, SourceReview } from './SourceReview';
import styles from './training.module.css';

export function CoursePreview({ content }: { content: CourseContent }) {
  const [active, setActive] = useState(0);
  const lesson = content.lessons[active];
  return <div className={styles.stack}>
    <SourceReview content={content}/>
    {!lesson ? <Empty title="No lessons yet">Add the first lesson in the draft editor.</Empty> : <div className={styles.detail}>
      <aside className={`${styles.panel} ${styles.outline}`} aria-label="Draft course outline"><h3>Topics & steps</h3>{content.lessons.map((item, i) => <div key={item.id}>
        {(!i || (item.sectionId || item.section) !== (content.lessons[i - 1].sectionId || content.lessons[i - 1].section)) && <p className={`${styles.eyebrow} mt-5`}>{item.section || 'General'}</p>}
        <button type="button" className={styles.lessonNav} aria-current={active === i ? 'step' : undefined} onClick={() => setActive(i)}>{i + 1}. {item.title}</button>
      </div>)}</aside>
      <article className={`${styles.panel} ${styles.stack}`} key={lesson.id}>
        <div><p className={styles.eyebrow}>{lesson.section} · Step {active + 1} of {content.lessons.length}</p><h2>{lesson.title}</h2><p className={styles.muted}>{lesson.kind}{lesson.managerSignoff ? ' · manager practical signoff required' : ''}</p></div>
        <LessonSource lesson={lesson}/>
        <LessonMedia lesson={lesson}/>
        <FormattedText text={lesson.body}/>
        {lesson.assetId && <p className={styles.notice}>Private attachment retained. Enroll to access private media through the learner view.</p>}
        {lesson.transcript && <details><summary className={styles.link}>Transcript / accessible alternative</summary><FormattedText text={lesson.transcript}/></details>}
        {!!lesson.checklist?.length && <ul className="list-disc space-y-2 pl-5">{lesson.checklist.map((item, i) => <li key={i}>{item}</li>)}</ul>}
        <nav className={`${styles.rule} ${styles.spread}`} aria-label="Preview steps"><Button variant="secondary" disabled={!active} onClick={() => setActive(i => i - 1)}>Previous step</Button><Button variant="secondary" disabled={active === content.lessons.length - 1} onClick={() => setActive(i => i + 1)}>Next step</Button></nav>
      </article>
    </div>}
  </div>;
}
