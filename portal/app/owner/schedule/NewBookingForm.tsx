'use client';

import { useEffect, useRef, useState } from 'react';
import { getSchedulingOptions, searchSchedulingAthletes } from './actions';
import { OButton } from '@/components/owner/ui';
import { weeklyRecurrenceStarts } from '@/lib/weeklyRecurrence';

type Options = Awaited<ReturnType<typeof getSchedulingOptions>>;

export function NewBookingForm({ onSaved, onClose, initialAthleteId, showNotes = false }: {
  onSaved: (date: Date, count?: number) => void;
  onClose: () => void;
  initialAthleteId?: string;
  showNotes?: boolean;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [athletes, setAthletes] = useState<{ id: string; name: string }[]>([]);
  const [athlete, setAthlete] = useState<{ id: string; name: string } | null>(null);
  const [when, setWhen] = useState('');
  const [walkIn, setWalkIn] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [occurrences, setOccurrences] = useState('');
  const [cage, setCage] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<{ payload: string; id: string } | null>(null);

  useEffect(() => {
    let active = true;
    getSchedulingOptions(initialAthleteId).then(result => {
      if (!active) return;
      setOptions(result);
      setLocation(result.initialAthlete?.locationId ?? result.locations[0]?.id ?? '');
      setAthlete(result.initialAthlete);
      setSearch(result.initialAthlete?.name ?? '');
      setType(result.types.find(t => t.type_category === 'private')?.id ?? '');
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [initialAthleteId]);

  useEffect(() => {
    let active = true;
    setAthletes([]);
    if (!location || search.trim().length < 2 || athlete) { setSearching(false); return; }
    setError('');
    setSearching(true);
    const timer = setTimeout(() => {
      searchSchedulingAthletes(location, search).then(rows => {
        if (active) setAthletes(rows);
      }).catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [location, search, athlete]);

  const selectedType = options?.types.find(t => t.id === type);
  const locationCapacity = options?.capacities.find(c => c.location_id === location);
  const capacityReady = locationCapacity?.capacity_source === 'manual' && !!locationCapacity.approved_at
    && (selectedType?.type_category === 'cage' ? locationCapacity.rental_capacity : locationCapacity.lesson_capacity) != null;
  let recurringStarts: string[] = [];
  if (recurring && when && Number(occurrences) >= 2 && Number(occurrences) <= 52) {
    try { recurringStarts = weeklyRecurrenceStarts(when, Number(occurrences)); } catch { /* Validated again on submission. */ }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !athlete || !selectedType || !capacityReady) return;
    if (selectedType.type_category === 'cage' && !cage) { setError('Select a configured rental cage.'); return; }
    const start = walkIn ? null : new Date(when);
    if (start && (!Number.isFinite(start.getTime()) || start <= new Date())) { setError('Choose a future date and time.'); return; }
    if (recurring && recurringStarts.length < 2) { setError('Choose 2–52 weekly occurrences.'); return; }
    const payload = {
      kid_id: athlete.id, location_id: location, session_type_id: type,
      walk_in: walkIn,
      ...(recurring ? { scheduled_starts: recurringStarts } : start ? {
        scheduled_start: start.toISOString(),
        scheduled_end: new Date(start.getTime() + selectedType.duration_minutes * 60000).toISOString(),
      } : {}),
      cage_number: cage || null,
      notes: notes.trim() || null,
    };
    const serialized = JSON.stringify(payload);
    if (request.current?.payload !== serialized) request.current = { payload: serialized, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const response = await fetch(recurring ? '/api/owner/bookings/series' : '/api/owner/bookings/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, request_id: request.current.id }),
      });
      const result = await response.json();
      const saved = recurring ? result.series?.bookings : result.booking ? [result.booking] : [];
      if (!response.ok || !result.ok || !Array.isArray(saved) || saved.length !== (recurring ? recurringStarts.length : 1)
        || saved.some((b: { id?: string; scheduled_start?: string } | null) => !b?.id || typeof b.scheduled_start !== 'string' || !Number.isFinite(Date.parse(b.scheduled_start)))) {
        throw new Error(result.error ?? 'Booking was not saved.');
      }
      onSaved(new Date(saved[0].scheduled_start), saved.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking was not saved. Retry uses the same request.');
    } finally { setBusy(false); }
  };

  const field = { display: 'block', width: '100%', padding: 9, marginTop: 5, marginBottom: 14, border: '1px solid #bbb', borderRadius: 6 };
  return (
    <form onSubmit={submit} style={{ padding: 24 }}>
      <p style={{ fontSize: 13, marginBottom: 16 }}>Book Infinite Hitting. Staff records the actual instructor at check-in.</p>
      {error && <p role="alert" style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p>}
      {!options ? <p>{error ? 'Booking options unavailable.' : 'Loading booking options…'}</p> : <>
        <label>Location<select required disabled={!!initialAthleteId} style={field} value={location} onChange={e => { setLocation(e.target.value); setAthlete(null); setSearch(''); setCage(''); }}>
          <option value="">Select location</option>
          {options.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select></label>
        <label>Resource<select required={selectedType?.type_category === 'cage'} style={field} value={cage} onChange={e => setCage(e.target.value)}>
          <option value="">{selectedType?.type_category === 'cage' ? 'Select rental cage' : 'Unassigned'}</option>
          {options.resources.filter(r => r.location_id === location && (r.purpose === 'both' || r.purpose === (selectedType?.type_category === 'cage' ? 'rental' : 'instruction')))
            .map(r => <option key={r.cage_number} value={r.cage_number}>Cage {r.cage_number}</option>)}
        </select></label>
        {options.locations.length === 0 && <p>No authorized locations available.</p>}
        {location && !capacityReady && <p role="status" style={{ marginBottom: 14 }}>
          A tenant owner must configure the manual capacity for this location and booking category before saving.
          Use Location capacity on the Schedule page.
        </p>}
        {!initialAthleteId && <label>Find existing athlete<input style={field} value={search} disabled={!location || busy}
          onChange={e => { setSearch(e.target.value); setAthlete(null); }} placeholder="Search first or last name" /></label>}
        {searching && <p role="status">Searching athletes…</p>}
        {!athlete && !searching && !error && search.trim().length >= 2 && athletes.length === 0 && <p>No matching athletes at this location.</p>}
        {!athlete && athletes.map(k => <button type="button" key={k.id} onClick={() => { setAthlete(k); setSearch(k.name); }} style={{ ...field, textAlign: 'left' }}>{k.name}</button>)}
        {athlete && <p role="status">Selected athlete: {athlete.name}</p>}
        {showNotes && <label>Notes (optional)<textarea style={field} maxLength={2000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>}
        <label>Session type<select required style={field} value={type} onChange={e => { setType(e.target.value); setCage(''); }}>
          <option value="">Select type</option>
          {options.types.filter(t => ['private', 'cage'].includes(t.type_category)).map(t => <option key={t.id} value={t.id}>
            {t.type_category === 'cage' ? 'Cage Rental' : 'Hitting Lesson'} · {t.name} ({t.duration_minutes} min)
          </option>)}
        </select></label>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <input type="checkbox" checked={walkIn} disabled={busy} onChange={e => { setWalkIn(e.target.checked); setRecurring(false); }} /> Walk-in starting now
        </label>
        {walkIn ? <p style={{ fontSize: 13, marginBottom: 14 }}>
          Starts at the server time when saved and lasts {selectedType?.duration_minutes ?? '—'} minutes.
          Normal capacity, cage and credit checks apply. After saving, open Check-In to record attendance and the actual instructor.
        </p> : <label>Date and time (device timezone)<input type="datetime-local" required style={field} value={when} onChange={e => setWhen(e.target.value)} /></label>}
        {!walkIn && <>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <input type="checkbox" checked={recurring} disabled={busy} onChange={e => setRecurring(e.target.checked)} /> Repeat weekly
          </label>
          {recurring && <>
            <label>Total occurrences (including the first)<input style={field} type="number" required min="2" max="52" step="1"
              disabled={busy} value={occurrences} onChange={e => setOccurrences(e.target.value)} /></label>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              Existing credits are deducted for every occurrence now. Future renewals are not borrowed.
              If any date fails capacity, cage or credit checks, none are saved and no credits are deducted.
              Later cage changes or cancellation apply only to the selected occurrence.
            </p>
            {recurringStarts.length > 0 && <details style={{ marginBottom: 14 }}>
              <summary>Preview {recurringStarts.length} dates (device timezone)</summary>
              <ul>{recurringStarts.map(date => <li key={date}>{new Date(date).toLocaleString()}</li>)}</ul>
            </details>}
          </>}
        </>}
        <p style={{ fontSize: 12, marginBottom: 16 }}>Camps, clinics, evaluations and appointments use separate workflows. Manual limits apply per location; no capacity is assumed.</p>
      </>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <OButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</OButton>
        <OButton type="submit" variant="gold" disabled={busy || !options || !athlete || !type || (!walkIn && !when) || !capacityReady || (recurring && recurringStarts.length < 2) || (selectedType?.type_category === 'cage' && !cage)}>
          {busy ? 'Saving…' : walkIn ? 'Create Walk-In' : recurring ? 'Create Series' : 'Create Booking'}
        </OButton>
      </div>
    </form>
  );
}
