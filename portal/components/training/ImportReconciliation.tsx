'use client';

import type { MigrationManifest } from '@/lib/training/types';
import { Button } from '@/components/ui/Button';
import styles from './training.module.css';

export function ImportReconciliation({manifest}:{manifest:MigrationManifest}) {
  if(!manifest.sourceArchives?.length)return null;
  function download(filename:string,content:string) {
    const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <details className={styles.notice}><summary className={styles.link}>Source preservation & reconciliation</summary>
    <p className="my-3">Original exports are stored privately in this business’s import batch. External URLs are linked references, not archived files. No source learner history was supplied.</p>
    {manifest.sourceArchives.map(a=><div key={a.filename} className="my-3"><Button variant="secondary" onClick={()=>download(a.filename,a.content)}>Download original {a.filename}</Button><p className={`${styles.muted} break-all`}>SHA-256: {a.sha256}</p></div>)}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Course</th><th>Topics / steps</th><th>Linked videos</th><th>Other linked references</th><th>Source tests</th><th>Review needs</th></tr></thead><tbody>{manifest.items.filter(i=>i.course).map(i=>{
      const c=i.course!;const refs=c.lessons.flatMap(l=>l.references??[]);
      return <tr key={i.sourceId}><td>{i.title}</td><td>{new Set(c.lessons.map(l=>l.sectionId||l.section)).size} / {c.lessons.length}</td><td>{refs.filter(r=>r.kind==='video').length}</td><td>{refs.filter(r=>r.kind==='resource').length}</td><td>{c.sourceReview?.tests.length||0} ungraded</td><td>{c.lessons.filter(l=>l.sourceWarnings?.length).length} flagged steps; {refs.filter(r=>r.status==='unavailable').length} unresolved/unavailable references</td></tr>;
    })}</tbody></table></div>
    <p className="mt-3">Independently archived video, screenshot and attachment files: <strong>0</strong>. The protected Scribe body remains missing. Export counts are not proof of a complete live-account backup. Review each course’s original notes for anomalies and acquisition needs.</p>
  </details>;
}
