'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { emptyCourse, type MigrationManifest, type TrainingAsset, type TrainingOverview } from '@/lib/training/types';
import { request, useAction } from './api';
import { Empty, Feedback } from './ui';
import styles from './training.module.css';
import { TRAINING_ACCEPT, trainingFileMime } from '@/lib/training/formats';

const MAX_BYTES = 250 * 1024 * 1024;
const ACCEPT = TRAINING_ACCEPT;
type UploadJob = {
  key: string; file: File; mime: string; status: 'queued' | 'uploading' | 'verifying' | 'success' | 'error';
  error?: string; assetId?: string; uploaded?: boolean;
};
function fileMime(file: File): string | null {
  return trainingFileMime(file.name);
}
function sizeLabel(size: number) { return `${(size / (1024 * 1024)).toFixed(1)} MB`; }
function safePreview(url: string) { const parsed = new URL(url, window.location.origin); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('The asset service returned an invalid preview URL.'); return parsed.href; }

export function ManualUploads({ overview, onSaved }: { overview: TrainingOverview; onSaved: () => Promise<void> }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const lock = useRef(false);
  const ready = overview.assets.filter(asset => asset.status === 'ready');
  const [search, setSearch] = useState('');
  const visible = ready.filter(asset => asset.filename.toLowerCase().includes(search.toLowerCase()));
  function patch(key: string, update: Partial<UploadJob>) { setJobs(current => current.map(job => job.key === key ? { ...job, ...update } : job)); }
  function addFiles(files: FileList | null) {
    if (!files) return;
    const added: UploadJob[] = Array.from(files).map(file => {
      const mime = fileMime(file);
      const error = !file.size ? 'This file is empty.' : file.size > MAX_BYTES ? 'File exceeds the 250 MB limit.' : !mime ? 'Unsupported format. Use PDF, text, CSV, an image, MP4, WebM or MP3.' : '';
      return { key: crypto.randomUUID(), file, mime: mime || file.type, status: error ? 'error' : 'queued', error: error || undefined };
    });
    setJobs(current => [...current, ...added]);
  }
  async function uploadBatch(batch: UploadJob[]) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setRefreshError('');
    try {
      for (const job of batch) {
        if (!fileMime(job.file) || !job.file.size || job.file.size > MAX_BYTES) continue;
        let assetId = job.assetId;
        try {
          patch(job.key, { status: job.uploaded ? 'verifying' : 'uploading', error: undefined });
          if (!job.uploaded) {
            const asset = await request<{ id: string; signedUrl: string }>('/api/training/assets', 'POST', { filename: job.file.name, mime: job.mime, size: job.file.size });
            assetId = asset.id; patch(job.key, { assetId });
            const response = await fetch(asset.signedUrl, { method: 'PUT', headers: { 'Content-Type': job.mime }, body: job.file });
            if (!response.ok) {
              const text = await response.text();
              let message = text;
              try { const parsed = JSON.parse(text); message = parsed.error || parsed.message || text; } catch { /* Preserve non-JSON server messages. */ }
              throw new Error(message || `Private upload failed (${response.status}).`);
            }
            patch(job.key, { uploaded: true, status: 'verifying' });
          }
          if (!assetId) throw new Error('Missing asset ID. Select the original file again.');
          await request(`/api/training/assets/${assetId}`, 'POST', { action: 'confirm' });
          patch(job.key, { status: 'success', assetId });
        } catch (error) {
          patch(job.key, { status: 'error', error: error instanceof Error ? error.message : 'Upload failed. Retry this file.' });
        }
      }
      await onSaved();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Uploads were retained, but the asset list could not refresh.');
    } finally { lock.current = false; setBusy(false); }
  }
  return <section className={styles.stack}>
    <div><h2>Bring your training files into Ballpark</h2><p className={styles.muted}>Upload original files and videos, review each verified asset, then create unpublished course drafts. Nothing is automatically published.</p></div>
    <div className={`${styles.panel} ${styles.stack}`}>
      <h3>1. Upload files & videos</h3>
      <p className={styles.muted}>PDF, Word, Excel, PowerPoint, ZIP, plain text, CSV, JPG/PNG/GIF/WebP images, MP4, WebM and MP3 · up to 250 MB per file. Each file uploads privately and is confirmed separately. Originals are retained as attachments; uploading does not convert documents or unpack ZIP archives into lessons.</p>
      <label>Choose one or more original files<input type="file" multiple accept={ACCEPT} disabled={busy} onChange={event => { addFiles(event.target.files); event.target.value = ''; }}/></label>
      {jobs.length > 0 && <div className={styles.stack}>
        <div className={styles.spread}><p className={styles.muted}>{jobs.filter(job => job.status === 'success').length} confirmed · {jobs.filter(job => job.status === 'error').length} need attention · successful uploads are not retried</p><Button disabled={busy || !jobs.some(job => job.status === 'queued')} onClick={() => void uploadBatch(jobs.filter(job => job.status === 'queued'))}>{busy ? 'Uploading / verifying…' : 'Upload pending files'}</Button></div>
        <ul className={styles.stack} aria-live="polite">{jobs.map(job => <li key={job.key} className={`${styles.notice} ${styles.stack}`}>
          <div className={styles.spread}><div className="min-w-0"><h3 className="break-all">{job.file.name}</h3><p className={styles.muted}>{sizeLabel(job.file.size)}</p></div><span className={styles.badge}>{({ queued: 'Pending upload', uploading: 'Uploading privately', verifying: 'Confirming upload', success: 'Upload confirmed', error: 'Needs attention' })[job.status]}</span></div>
          {job.status === 'success' && <p className={styles.muted}>Confirmation succeeded. Review server readiness and checksum in the asset list below. Other failed files do not remove this upload.</p>}
          {job.error && <p className="text-sm text-danger" role="alert">{job.error}</p>}
          {job.status === 'error' && <div className={styles.row}><Button variant="secondary" size="sm" disabled={busy || !fileMime(job.file) || !job.file.size || job.file.size > MAX_BYTES} onClick={() => void uploadBatch([job])}>{job.uploaded ? 'Retry confirmation' : 'Retry this upload'}</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => setJobs(current => current.filter(item => item.key !== job.key))}>Remove from queue</Button></div>}
        </li>)}</ul>
      </div>}
      <Feedback error={refreshError}/>
    </div>
    <div className={styles.spread}><div><h3>2. Review verified assets & create drafts</h3><p className={styles.muted}>Ready assets only. Each draft contains one file or video lesson; edit and publish it separately after reviewing.</p></div><Button disabled={busy} variant="secondary" size="sm" onClick={() => void uploadBatch([])}>Refresh assets</Button></div>
    <label>Find an uploaded asset<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by filename"/></label>
    {!visible.length && <Empty title={ready.length ? 'No matching assets' : 'No ready assets yet'}>{ready.length ? 'Try a different filename.' : 'Upload and confirm your files above. Assets become available here when the server reports ready status.'}</Empty>}
    {visible.map(asset => <AssetDraft key={asset.id} asset={asset} onSaved={onSaved}/>)}
  </section>;
}

function AssetDraft({ asset, onSaved }: { asset: TrainingAsset; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState(false);
  const [title, setTitle] = useState(asset.filename.replace(/\.[^.]+$/, ''));
  const [category, setCategory] = useState('Onboarding');
  const [courseId, setCourseId] = useState('');
  const [preview, setPreview] = useState('');
  const action = useAction();
  return <article className={`${styles.panel} ${styles.stack}`}>
    <div className={styles.spread}><label className={styles.check}><input type="checkbox" disabled={action.pending || !!courseId} checked={selected} onChange={event => setSelected(event.target.checked)}/><span className="break-all">{asset.filename}</span></label><span className={styles.badge}>Server status: {asset.status}</span></div>
    <p className={styles.muted}>{asset.mime} · {sizeLabel(asset.size)} · Verified readiness: {asset.status === 'ready' ? 'ready' : 'not ready'}</p>
    <p className={`${styles.muted} break-all`}>Checksum: {asset.checksum || 'Not provided by the server; checksum verification is not claimed.'}</p>
    <Feedback {...action}/>
    <div className={styles.row}><Button variant="secondary" size="sm" disabled={action.pending} onClick={() => void action.run(async () => { const result = await request<{ url: string }>(`/api/training/assets/${asset.id}`); setPreview(safePreview(result.url)); return true; })}>{preview ? 'Renew preview link' : 'Prepare private preview'}</Button>{preview && <a className={styles.link} href={preview} target="_blank" rel="noopener noreferrer">Open asset preview (temporary private link)</a>}</div>
    {preview && asset.mime.startsWith('video/') && <video controls preload="metadata" src={preview} className="max-h-80 w-full rounded-lg"/>}
    {preview && asset.mime.startsWith('audio/') && <audio controls preload="metadata" src={preview} className="w-full"/>}
    {selected && !courseId && <form className={`${styles.stack} ${styles.rule}`} onSubmit={event => { event.preventDefault(); void action.run(async () => {
      const result = await request<{ id: string }>('/api/training/courses', 'POST', { draft: { ...emptyCourse(), title: title.trim(), category: category.trim(), lessons: [{ id: crypto.randomUUID(), title: title.trim(), section: 'Source material', kind: asset.mime.startsWith('video/') ? 'video' : 'file', body: '', assetId: asset.id }] } });
      setCourseId(result.id); await onSaved(); return result;
    }, 'Unpublished draft created. Review its content and accessibility before publishing.'); }}>
      <fieldset disabled={action.pending} className={styles.stack}><div className={styles.grid}><label>Course title<input required value={title} onChange={event => setTitle(event.target.value)}/></label><label>Category<input required value={category} onChange={event => setCategory(event.target.value)}/></label></div><p className={styles.muted}>The original asset will be attached to a single {asset.mime.startsWith('video/') ? 'video' : 'file'} lesson. Add descriptions, transcripts, checks and procedures in the plain-text draft editor.</p><Button type="submit" disabled={!title.trim() || !category.trim()}>Create unpublished draft</Button></fieldset>
    </form>}
    {courseId && <Link className={styles.link} href={`/training/courses/${courseId}`}>Review created draft</Link>}
  </article>;
}

export function DriveSource({ onSaved }: { onSaved: () => Promise<void> }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [batchId, setBatchId] = useState('');
  const action = useAction();
  return <section className={`${styles.panel} ${styles.stack}`}><h2>Files shared through Google Drive?</h2><p className={styles.muted}>For now, download the original files from Drive and upload them here. A private Drive link requires authorized access from its owner. Ballpark does not sync Drive or copy media from a registered link.</p>
    <details><summary className="cursor-pointer text-sm text-gold">Optional: register a Drive source for follow-up</summary>
      <form className={`${styles.stack} mt-4`} onSubmit={event => { event.preventDefault(); void action.run(async () => {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'drive.google.com' || parsed.username || parsed.password || parsed.port) throw new Error('Use an HTTPS drive.google.com link only.');
        const manifest: MigrationManifest = { format: 'ballpark-training-v1', source: title.trim(), items: [{ sourceId: parsed.href, title: title.trim(), kind: 'drive-folder', status: 'blocked', reason: 'awaiting authorized export' }] };
        const result = await request<{ id: string }>('/api/training/migrations', 'POST', { manifest });
        setBatchId(result.id); await onSaved(); return result;
      }, 'Source registered as blocked: awaiting authorized export. No media was copied.'); }}>
        <Feedback {...action}/><fieldset disabled={action.pending} className={styles.stack}><label>Source title<input required value={title} onChange={event => setTitle(event.target.value)}/></label><label>Google Drive source link<input type="url" required placeholder="https://drive.google.com/drive/folders/…" value={url} onChange={event => setUrl(event.target.value)}/></label><Button type="submit" variant="secondary" disabled={!title.trim() || !url.trim()}>Register Drive source only</Button></fieldset>
        {batchId && <p className={styles.muted}>Blocked source batch: {batchId}. It is not imported training or copied media.</p>}
      </form>
    </details>
  </section>;
}
