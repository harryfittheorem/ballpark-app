'use client';

import { useState } from 'react';
import type { Lesson } from '@/lib/training/types';
import { safeUrl, videoEmbed, lessonReferences } from './media';
import styles from './training.module.css';

function Reference({ reference }: { reference: NonNullable<Lesson['references']>[number] }) {
  const [failed, setFailed] = useState(false);
  const url = safeUrl(reference.url);
  const embed = reference.kind === 'video' && url ? videoEmbed(url) : null;
  const available = reference.status !== 'unavailable' && !!url;
  return <div className={`${styles.reference} ${styles.stack}`}>
    <h3>{reference.label || (reference.kind === 'video' ? 'Video reference' : 'Resource reference')}</h3>
    {!available ? <p className={styles.notice}>Reference unavailable. {url ? 'The source marked this material unavailable; ask a manager to verify access.' : 'A valid resource URL is missing. Ask a manager to update this reference.'}</p> : <>
      {embed && !failed && <iframe className={styles.mediaFrame} src={embed.url} title={`${reference.label || 'Training video'} (${embed.provider})`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allowFullScreen onError={() => setFailed(true)}/>}
      <p className={styles.muted}>{embed ? failed ? 'Embedded player unavailable. Open the original video below.' : 'If the player cannot load or requires access, open the original video.' : 'This provider is available through an external link only.'}</p>
    </>}
    {url && <a className={styles.link} href={url} target="_blank" rel="noopener noreferrer">{available ? 'Open' : 'Check original'} {reference.kind === 'video' ? 'video' : 'resource'} in a new tab</a>}
  </div>;
}

export function LessonMedia({ lesson }: { lesson: Lesson }) {
  const references = lessonReferences(lesson);
  return <>{references.map((reference, i) => <Reference key={`${i}-${reference.url}-${reference.status}`} reference={reference}/>)}</>;
}
