import type { CourseContent, Lesson } from '@/lib/training/types';
import { FormattedText } from './FormattedText';
import { safeUrl } from './media';
import styles from './training.module.css';

export function sourceReviewState(content: CourseContent) {
  const warnings = (content.sourceReview?.warnings.length || 0) + content.lessons.reduce((count, lesson) => count + (lesson.sourceWarnings?.length || 0) + (lesson.references?.filter(r => r.status === 'unavailable').length || 0), 0);
  if (content.sourceReview?.tests.length) return 'Answer-key review required';
  if (warnings) return 'Source review required';
  return content.sourceReview ? 'Source imported · verify before publishing' : 'No source review recorded';
}

export function SourceReview({ content }: { content: CourseContent }) {
  const review = content.sourceReview;
  if (!review) return null;
  return <section className={`${styles.notice} ${styles.stack}`} aria-label="Source review">
    <div className={styles.spread}><h3>Source review</h3><span className={styles.badge}>{sourceReviewState(content)}</span></div>
    {review.updated && <p className={styles.muted}>Source updated: {review.updated}</p>}
    {review.notes && <FormattedText text={review.notes}/>}
    {!!review.warnings.length && <ul className="list-disc space-y-2 pl-5">{review.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
    {!!review.tests.length && <div className={styles.stack}><p><strong>Test source awaiting answer-key review.</strong> These are source materials, not a scored knowledge check. A manager must verify questions and answers before creating a knowledge check.</p>{review.tests.map((test, i) => <details key={i}><summary className={styles.link}>{test.title || `Source test ${i + 1}`}</summary><FormattedText text={test.body}/></details>)}</div>}
  </section>;
}

export function LessonSource({ lesson }: { lesson: Lesson }) {
  const url = safeUrl(lesson.sourceUrl);
  if (!lesson.sourceUrl && lesson.sourceNumber === undefined && !lesson.sectionId && !lesson.sourceWarnings?.length) return null;
  return <div className={`${styles.notice} ${styles.stack}`}>
    <div className={styles.sourceMeta}>
      {lesson.sourceNumber !== undefined && <span>Source step {lesson.sourceNumber}</span>}
      {lesson.sectionId && <span>Source topic: {lesson.sectionId}</span>}
      {lesson.sourceUrl && (url ? <a className={styles.link} href={url} target="_blank" rel="noopener noreferrer">Open original source</a> : <span>Source URL unavailable or invalid</span>)}
    </div>
    {!!lesson.sourceWarnings?.length && <ul className="list-disc space-y-2 pl-5">{lesson.sourceWarnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
  </div>;
}
