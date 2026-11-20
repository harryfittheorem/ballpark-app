'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchCampRoster } from './actions';

export function CampRoster({ eventId, locationId, checkInHref }: { eventId: string; locationId: string; checkInHref: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchCampRoster>> | null>(null);
  const [error, setError] = useState('');
  const version = useRef(0);
  const reload = useCallback(async () => {
    const current = ++version.current;
    try {
      const result = await fetchCampRoster(eventId);
      if (current === version.current) { setRows(result); setError(''); }
    } catch { if (current === version.current) setError('Camp roster could not be refreshed.'); }
  }, [eventId]);
  useEffect(() => {
    setRows(null); void reload();
    const db = createClient();
    const channel = db.channel(`camp-roster-${eventId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'bookings', filter: `location_id=eq.${locationId}`,
    }, () => { void reload(); }).subscribe(status => { if (status === 'SUBSCRIBED') void reload(); });
    const timer = setInterval(() => { void reload(); }, 30000);
    const refresh = () => { void reload(); };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => {
      ++version.current; clearInterval(timer); void db.removeChannel(channel);
      window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh);
    };
  }, [eventId, locationId, reload]);
  return <section style={{ marginTop: 16 }}>
    <h3>Daily roster and attendance</h3>
    <p>Enrollment reserves the full event schedule; it does not mean the athlete attended.
      Record each day’s attendance and actual instructor in <a href={checkInHref}>today’s Check-In board</a>.</p>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {!rows && !error && <p role="status">Loading roster…</p>}
    {rows?.length === 0 && <p>No enrolled athletes. Paid camp sales are disabled; there is no manual purchase bypass here.</p>}
    {rows?.map(row => <div key={row.id} style={{ borderBottom: '1px solid #ddd', padding: '10px 0' }}>
      <strong>Day/window {row.day} · {row.name}</strong>
      <p>{new Date(row.startsAt).toLocaleString()} – {new Date(row.endsAt).toLocaleString()}</p>
      <p>{row.attendedAt ? `Checked in: ${new Date(row.attendedAt).toLocaleString()}` : row.status === 'no_show' ? 'No-show recorded' : 'Attendance not recorded'}</p>
    </div>)}
  </section>;
}
