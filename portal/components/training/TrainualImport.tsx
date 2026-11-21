'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { request, useAction } from './api';
import { Feedback } from './ui';
import styles from './training.module.css';

export function TrainualImport({ onSaved }: { onSaved: () => Promise<void> }) {
  const [json, setJson] = useState<{ name: string; text: string } | null>(null);
  const [markdown, setMarkdown] = useState<{ name: string; text: string } | null>(null);
  const [reading, setReading] = useState(0);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<{ id: string; ready: number; blocked: number } | null>(null);
  const sequence = useRef({ json: 0, markdown: 0 });
  const action = useAction();
  async function read(file: File | undefined, kind: 'json' | 'markdown') {
    const current = ++sequence.current[kind];
    const setFile = kind === 'json' ? setJson : setMarkdown;
    setFile(null); setStage(null); setError('');
    if (!file) return;
    setReading(count => count + 1);
    try {
      const text = await file.text();
      if (current !== sequence.current[kind]) return;
      if (!text.trim()) throw new Error('Source files must not be empty.');
      if (kind === 'json') JSON.parse(text);
      setFile({ name: file.name, text });
    } catch (e) { if (current === sequence.current[kind]) setError(e instanceof Error ? e.message : 'Unable to read source file.'); }
    finally { setReading(count => count - 1); }
  }
  return <section className={`${styles.panel} ${styles.stack}`}>
    <div><p className={styles.eyebrow}>Original source migration</p><h2>Import Trainual source files</h2><p className={styles.muted}>Choose the original JSON export and its companion Markdown. Both are required. The server preserves the original text privately and prepares a reviewable draft batch.</p></div>
    <Feedback {...action}/><Feedback error={error}/>
    <div className={styles.grid}>
      <label>Original Trainual export (.json)<input type="file" accept=".json,application/json" disabled={action.pending} onChange={e => void read(e.target.files?.[0], 'json')}/>{json && <span className={styles.muted}>{json.name} · ready</span>}</label>
      <label>Companion Markdown (.md)<input type="file" accept=".md,.markdown,text/markdown,text/plain" disabled={action.pending} onChange={e => void read(e.target.files?.[0], 'markdown')}/>{markdown && <span className={styles.muted}>{markdown.name} · ready</span>}</label>
    </div>
    {reading > 0 && <p role="status" className={styles.muted}>Reading source files…</p>}
    <p className={styles.notice}>Staging does not publish or enroll anyone. Review source warnings, unavailable references and test answer keys before publishing imported drafts.</p>
    <Button disabled={action.pending || reading > 0 || !json || !markdown} onClick={() => void action.run(async () => {
      if (!json || !markdown) throw new Error('Select both original source files.');
      const result = await request<{ id: string; ready: number; blocked: number }>('/api/training/migrations', 'POST', { trainualExport: json.text, companionMarkdown: markdown.text, jsonFilename:json.name, markdownFilename:markdown.name });
      setStage(result); await onSaved(); return result;
    }, 'Original sources staged privately. Review the batch before importing drafts.')}>{action.pending ? 'Staging sources…' : 'Stage Trainual sources / dry run'}</Button>
    {stage && <div role="status" className={styles.notice}><strong>{stage.ready} ready · {stage.blocked} blocked</strong><p>Batch {stage.id}. Open source batch history below to inspect and import eligible drafts.</p></div>}
  </section>;
}
