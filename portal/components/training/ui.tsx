'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './training.module.css';

export function Feedback({ error, message, pending }: { error?: string; message?: string; pending?: boolean }) {
  return <>{error && <div className={`${styles.notice} ${styles.error}`} role="alert">{error}</div>}{message && <div className={`${styles.notice} ${styles.success}`} role="status">{message}</div>}{pending && <p className={styles.muted} role="status">Saving changes…</p>}</>;
}
export function Loading() { return <div className={styles.stack} role="status" aria-label="Loading training"><div className={styles.skeleton}/><div className={styles.skeleton}/><span className={styles.muted}>Loading training…</span></div>; }
export function LoadError({ error, retry }: { error: string; retry: () => void }) { return <div className={styles.panel}><Feedback error={error}/><Button type="button" variant="secondary" onClick={retry} className="mt-4">Try again</Button></div>; }
export function Empty({ title, children }: { title: string; children: ReactNode }) { return <div className={styles.empty}><h3>{title}</h3><div className={styles.muted}>{children}</div></div>; }
export function Raw({ label, value }: { label: string; value: unknown }) { return <details className={styles.rule}><summary className="cursor-pointer text-sm text-gold">{label}</summary><pre className={`${styles.raw} mt-3`}>{JSON.stringify(value, null, 2)}</pre></details>; }
export function date(value?: string | null) { return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'No due date'; }
export function move<T>(items: T[], index: number, direction: number): T[] { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return next; [next[index], next[target]] = [next[target], next[index]]; return next; }
