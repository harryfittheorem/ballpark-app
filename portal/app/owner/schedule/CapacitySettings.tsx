'use client';

import { useEffect, useState } from 'react';
import { OButton } from '@/components/owner/ui';
import { getSchedulingOptions, saveManualLocationCapacity } from './actions';

type Options = Awaited<ReturnType<typeof getSchedulingOptions>>;

export function CapacitySettings({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [location, setLocation] = useState('');
  const [lessons, setLessons] = useState('');
  const [rentals, setRentals] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getSchedulingOptions().then(result => {
      if (!active) return;
      setOptions(result);
      setLocation(result.locations[0]?.id ?? '');
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load capacity settings.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const current = options?.capacities.find(c => c.location_id === location);
    setLessons(current?.lesson_capacity?.toString() ?? '');
    setRentals(current?.rental_capacity?.toString() ?? '');
  }, [options, location]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await saveManualLocationCapacity(location, Number(lessons), Number(rentals));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capacity was not saved.');
    } finally { setBusy(false); }
  };
  const field = { display: 'block', width: '100%', padding: 9, marginTop: 5, marginBottom: 14, border: '1px solid #bbb', borderRadius: 6 };
  return <form onSubmit={save} style={{ padding: 24 }}>
    <h2 style={{ fontSize: 20, marginBottom: 12 }}>Location capacity</h2>
    <p style={{ fontSize: 13, marginBottom: 16 }}>
      Set the maximum number of simultaneous lesson bookings and rental bookings at this location.
      These are booking limits, not cage counts or daily totals. No numbers are assumed.
      Existing cage conflict checks still apply.
    </p>
    {error && <p role="alert" style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p>}
    {!options ? <p>{error ? 'Settings unavailable.' : 'Loading settings…'}</p> : !options.canConfigureCapacity
      ? <p>Capacity is visible to staff but can only be configured by a tenant owner.</p>
      : <>
        <label>Location<select required disabled={busy} style={field} value={location} onChange={e => setLocation(e.target.value)}>
          <option value="">Select location</option>
          {options.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select></label>
        {options.locations.length === 0 && <p>No authorized locations available.</p>}
        <label>Simultaneous lessons<input required disabled={busy} style={field} type="number" min="1" max="2147483647" step="1" value={lessons} onChange={e => setLessons(e.target.value)} /></label>
        <label>Simultaneous rentals<input required disabled={busy} style={field} type="number" min="1" max="2147483647" step="1" value={rentals} onChange={e => setRentals(e.target.value)} /></label>
        <p style={{ fontSize: 12, marginBottom: 16 }}>
          Saving records who set these limits. A limit below existing reservations is rejected;
          no existing bookings are cancelled. This does not enable walk-in exceptions, recurring charges or camp sales.
        </p>
      </>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
      <OButton variant="secondary" disabled={busy} onClick={onClose}>Close</OButton>
      {options?.canConfigureCapacity && <OButton type="submit" variant="gold" disabled={busy || !location || !lessons || !rentals}>
        {busy ? 'Saving…' : 'Save limits'}
      </OButton>}
    </div>
  </form>;
}
