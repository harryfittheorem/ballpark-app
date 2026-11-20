'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Assignment, Attempt, Course, CourseContent, Progress, Revision } from '@/lib/training/types';

export type CourseDetail = { course: Course; revisions: Revision[]; assignment: Assignment | null; progress: Progress[]; attempts: Attempt[]; content: CourseContent };
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'include', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data as T;
}
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const seq = ++sequence.current;
    setLoading(true); setError('');
    try { const result = await request<T>(path); if (seq === sequence.current) setData(result); }
    catch (e) { if (seq === sequence.current) setError(e instanceof Error ? e.message : 'Unable to load training.'); }
    finally { if (seq === sequence.current) setLoading(false); }
  }, [path]);
  useEffect(() => { setData(null); void reload(); return () => { sequence.current++; }; }, [reload]);
  return { data, error, loading, reload };
}
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  async function run<T>(work: () => Promise<T>, success = ''): Promise<T | undefined> {
    if (lock.current) return undefined;
    lock.current = true; setPending(true); setError(''); setMessage('');
    try { const result = await work(); setMessage(success); return result; }
    catch (e) { setError(e instanceof Error ? e.message : 'The action could not be completed.'); return undefined; }
    finally { lock.current = false; setPending(false); }
  }
  return { pending, error, message, run };
}
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
