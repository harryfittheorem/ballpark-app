'use client';

import { useRef, useState } from 'react';
import { OButton } from '@/components/owner/ui';
import type { getSchedulingOptions } from '../actions';
import { fetchCampEvents, saveCampDraft } from './actions';

type Options = Awaited<ReturnType<typeof getSchedulingOptions>>;
type Event = Awaited<ReturnType<typeof fetchCampEvents>>[number];
type Day = { start: string; end: string; cage: string };
function local(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function CampDraftForm({ locationId, options, event, onSaved, onCancel }: {
  locationId: string; options: Options; event: Event | null;
  onSaved: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(event?.name ?? '');
  const [category, setCategory] = useState<'camp' | 'clinic'>(event?.offering_category === 'clinic' ? 'clinic' : 'camp');
  const [type, setType] = useState(event?.session_type_id ?? '');
  const [capacity, setCapacity] = useState(event?.capacity.toString() ?? '');
  const [days, setDays] = useState<Day[]>(event?.camp_event_days.map(day => ({ start: local(day.starts_at), end: local(day.ends_at), cage: day.cage_number ?? '' })) ?? [{ start: '', end: '', cage: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const receipt = useRef<{ payload: string; id: string } | null>(null);
  const changeDay = (index: number, change: Partial<Day>) => setDays(rows => rows.map((day, i) => i === index ? { ...day, ...change } : day));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const payload = {
        eventId: event?.id ?? null, locationId, name, category, sessionTypeId: type, capacity: Number(capacity),
        expectedVersion: event?.version ?? null,
        days: days.map(day => ({ starts_at: new Date(day.start).toISOString(), ends_at: new Date(day.end).toISOString(), cage_number: day.cage || null })),
      };
      const serialized = JSON.stringify(payload);
      if (receipt.current?.payload !== serialized) receipt.current = { payload: serialized, id: crypto.randomUUID() };
      const result = await saveCampDraft({ ...payload, requestId: receipt.current.id });
      if (!result.ok) { setError(result.error); return; }
      onSaved();
    } catch { setError('The draft was not saved. Check the dates and try again.'); }
    finally { setBusy(false); }
  };
  const field = { display: 'block', width: '100%', padding: 9, marginTop: 5, marginBottom: 14, border: '1px solid #bbb', borderRadius: 6 };
  return <form onSubmit={submit} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 20, margin: '16px 0' }}>
    <h2>{event ? 'Edit camp or clinic draft' : 'New camp or clinic draft'}</h2>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    <label>Name<input required maxLength={120} disabled={busy} style={field} value={name} onChange={e => setName(e.target.value)} /></label>
    <label>Offering<select disabled={busy} style={field} value={category} onChange={e => setCategory(e.target.value as 'camp' | 'clinic')}>
      <option value="camp">Camp</option><option value="clinic">Clinic</option>
    </select></label>
    <label>Existing group session type<select required disabled={busy} style={field} value={type} onChange={e => setType(e.target.value)}>
      <option value="">Select group event type</option>{options.types.filter(t => t.type_category === 'group').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select></label>
    {!options.types.some(t => t.type_category === 'group') && <p>No active group event type is configured. A camp draft cannot be saved until one exists.</p>}
    <label>Full-event athlete capacity<input required min="1" max="2147483647" step="1" type="number" disabled={busy} style={field} value={capacity} onChange={e => setCapacity(e.target.value)} /></label>
    <p>Define every attendance window in order (device timezone). Facility lesson limits and cage conflicts still apply; this event capacity does not override them.</p>
    {days.map((day, index) => <fieldset key={index} disabled={busy} style={{ border: '1px solid #ddd', padding: 12, margin: '12px 0' }}>
      <legend>Day/window {index + 1}</legend>
      <label>Start<input required type="datetime-local" style={field} value={day.start} onChange={e => changeDay(index, { start: e.target.value })} /></label>
      <label>End<input required type="datetime-local" style={field} value={day.end} onChange={e => changeDay(index, { end: e.target.value })} /></label>
      <label>Instruction resource<select style={field} value={day.cage} onChange={e => changeDay(index, { cage: e.target.value })}>
        <option value="">Unassigned</option>{options.resources.filter(r => r.location_id === locationId && ['instruction', 'both'].includes(r.purpose))
          .map(r => <option key={r.cage_number} value={r.cage_number}>Cage {r.cage_number}</option>)}
      </select></label>
      {days.length > 1 && <OButton onClick={() => setDays(rows => rows.filter((_, i) => i !== index))}>Remove draft day</OButton>}
    </fieldset>)}
    <OButton disabled={busy || days.length >= 60} onClick={() => setDays(rows => [...rows, { start: '', end: '', cage: '' }])}>Add day</OButton>
    <p>Saving only creates a draft. It takes no payment, adds no athletes and records no attendance. Paid sales remain disabled.</p>
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
      <OButton disabled={busy} variant="secondary" onClick={onCancel}>Cancel</OButton>
      <OButton disabled={busy} type="submit" variant="gold">{busy ? 'Saving…' : 'Save draft'}</OButton>
    </div>
  </form>;
}
