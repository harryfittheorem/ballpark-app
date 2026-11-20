'use client';

import { useEffect, useState } from 'react';
import { OButton } from '@/components/owner/ui';
import { getSchedulingOptions } from './actions';
import { fetchCapacityOverrides, saveCapacityOverride, removeCapacityOverride } from './capacityOverrideActions';

type Options = Awaited<ReturnType<typeof getSchedulingOptions>>;
type Windows = Awaited<ReturnType<typeof fetchCapacityOverrides>>;
type Window = Windows['overrides'][number];

function localInput(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function CapacityOverrides({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [location, setLocation] = useState('');
  const [windows, setWindows] = useState<Windows | null>(null);
  const [editing, setEditing] = useState<Window | null>(null);
  const [category, setCategory] = useState<'lesson' | 'rental'>('lesson');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [capacity, setCapacity] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    getSchedulingOptions().then(data => {
      if (active) { setOptions(data); setLocation(data.locations[0]?.id ?? ''); }
    }).catch(() => { if (active) setError('Location options could not be loaded.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!location) { setWindows(null); return; }
    let active = true;
    setLoading(true); setWindows(null);
    fetchCapacityOverrides(location).then(data => { if (active) setWindows(data); })
      .catch(() => { if (active) setError('Capacity windows could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [location]);

  const reload = async () => {
    try { setWindows(await fetchCapacityOverrides(location)); }
    catch { setError('The change was saved, but the list could not refresh. Close and reopen to retry.'); }
  };
  const reset = () => { setEditing(null); setStart(''); setEnd(''); setCapacity(''); setReason(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const startsAt = editing?.starts_at ?? new Date(start).toISOString();
      const endsAt = editing?.ends_at ?? new Date(end).toISOString();
      const result = await saveCapacityOverride({ locationId: location, category, start: startsAt, end: endsAt, capacity: Number(capacity), reason });
      if (!result.ok) { setError(result.error); return; }
      reset(); setMessage('Dated capacity saved. Normal limits and other dates were not changed.');
      onChanged(); await reload();
    } catch { setError('The override could not be saved. Check the dates and try again.'); }
    finally { setBusy(false); }
  };
  const remove = async (row: Window) => {
    const explanation = window.prompt('Reason for restoring the normal capacity for this window');
    if (!explanation?.trim() || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await removeCapacityOverride(row.id, explanation);
      if (!result.ok) { setError(result.error); return; }
      reset(); setMessage('Normal capacity restored for this window. The audit history was retained.');
      onChanged(); await reload();
    } catch { setError('The override could not be removed.'); }
    finally { setBusy(false); }
  };

  const normal = options?.capacities.find(c => c.location_id === location);
  const field = { display: 'block', width: '100%', padding: 9, marginTop: 5, marginBottom: 14, border: '1px solid #bbb', borderRadius: 6 };
  return <div style={{ padding: 24 }}>
    <h2 style={{ fontSize: 20, marginBottom: 12 }}>Dated capacity override</h2>
    <p style={{ fontSize: 13, marginBottom: 16 }}>Change the lesson or rental limit for one dated window at one location.
      This affects all bookings of that category in the window, not just one athlete.
      It does not change normal limits or other recurring dates, and cannot bypass cage conflicts.</p>
    {error && <p role="alert" style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p>}
    {message && <p role="status" style={{ marginBottom: 12 }}>{message}</p>}
    {!options ? <p>{error ? 'Settings unavailable.' : 'Loading locations…'}</p> : <>
      <label>Location<select required disabled={busy || !!editing} style={field} value={location}
        onChange={e => { setWindows(null); setLocation(e.target.value); reset(); setError(''); setMessage(''); }}>
        <option value="">Select location</option>
        {options.locations.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      <p style={{ fontSize: 13, marginBottom: 14 }}>Normal lesson limit: {normal?.lesson_capacity ?? 'not configured'} · Normal rental limit: {normal?.rental_capacity ?? 'not configured'}</p>
      {options.canConfigureOverrides ? <form onSubmit={save}>
        <label>Category<select style={field} value={category} disabled={busy || !!editing}
          onChange={e => setCategory(e.target.value as 'lesson' | 'rental')}>
          <option value="lesson">Lessons</option><option value="rental">Rentals</option>
        </select></label>
        <label>Window start (device timezone)<input required type="datetime-local" style={field} disabled={busy || !!editing} value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Window end (device timezone)<input required type="datetime-local" style={field} disabled={busy || !!editing} value={end} onChange={e => setEnd(e.target.value)} /></label>
        <label>Simultaneous bookings<input required type="number" min="1" max="2147483647" step="1" style={field} disabled={busy} value={capacity} onChange={e => setCapacity(e.target.value)} /></label>
        <label>Reason<textarea required maxLength={2000} style={field} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <p style={{ fontSize: 12, marginBottom: 12 }}>Overlapping overrides are rejected. Reducing or removing a limit below existing reservations is rejected without changing any bookings.</p>
        <OButton type="submit" variant="gold" disabled={busy || !location}>{busy ? 'Saving…' : editing ? 'Update window' : 'Save window'}</OButton>
        {editing && <OButton disabled={busy} onClick={reset}>Cancel edit</OButton>}
      </form> : <p>Only owners and assigned location admins can change these windows.</p>}
      {loading && <p role="status">Loading capacity windows…</p>}
      {windows && <>
        <h3 style={{ marginTop: 20 }}>Upcoming active windows (first 100)</h3>
        {windows.overrides.length === 0 && <p>No upcoming overrides at this location.</p>}
        {windows.overrides.map(row => <div key={row.id} style={{ borderBottom: '1px solid #ddd', padding: '12px 0' }}>
          <p>{row.category === 'rental' ? 'Rentals' : 'Lessons'} · {new Date(row.starts_at).toLocaleString()} – {new Date(row.ends_at).toLocaleString()} · Limit {row.capacity}</p>
          <p>{row.reason}</p>
          {options.canConfigureOverrides && <>
            <OButton disabled={busy} onClick={() => {
              setEditing(row); setCategory(row.category as 'lesson' | 'rental'); setStart(localInput(row.starts_at));
              setEnd(localInput(row.ends_at)); setCapacity(String(row.capacity)); setReason(''); setError(''); setMessage('');
            }}>Edit limit</OButton>
            <OButton disabled={busy} onClick={() => { void remove(row); }}>Restore normal limit</OButton>
          </>}
        </div>)}
        <details style={{ marginTop: 16 }}><summary>Recent audit history (last 20 changes)</summary>
          {windows.history.length === 0 && <p>No changes recorded.</p>}
          {windows.history.map(row => <div key={row.id} style={{ padding: '10px 0' }}>
            <p>{new Date(row.changed_at).toLocaleString()} · {row.category} · {row.previous_capacity ?? 'normal'} → {row.new_capacity ?? 'normal'}</p>
            <p>{new Date(row.starts_at).toLocaleString()} – {new Date(row.ends_at).toLocaleString()}</p>
            <p>{row.reason} · Staff ID: {row.actor_id}</p>
          </div>)}
        </details>
      </>}
    </>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
      <OButton variant="secondary" disabled={busy} onClick={onClose}>Close</OButton>
    </div>
  </div>;
}
