'use client';

import { useEffect, useState } from 'react';
import { OButton } from '@/components/owner/ui';
import { getSchedulingOptions } from './actions';
import { fetchSchedulingResources, saveSchedulingResource } from './resourceActions';

type Options = Awaited<ReturnType<typeof getSchedulingOptions>>;
type Inventory = Awaited<ReturnType<typeof fetchSchedulingResources>>;

export function ResourceSettings({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [location, setLocation] = useState('');
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [cage, setCage] = useState('');
  const [purpose, setPurpose] = useState('');
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let mounted = true;
    getSchedulingOptions().then(data => { if (mounted) { setOptions(data); setLocation(data.locations[0]?.id ?? ''); } })
      .catch(() => { if (mounted) setError('Location options could not be loaded.'); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!location) { setInventory(null); return; }
    let mounted = true;
    setInventory(null);
    fetchSchedulingResources(location).then(data => { if (mounted) setInventory(data); })
      .catch(() => { if (mounted) setError('Resources could not be loaded.'); });
    return () => { mounted = false; };
  }, [location]);
  const reset = () => { setCage(''); setPurpose(''); setActive(true); setEditing(false); setReason(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await saveSchedulingResource({ locationId: location, cage, purpose, active, reason });
      if (!result.ok) { setError(result.error); return; }
      reset(); setMessage('Resource saved. No inventory counts or booking limits were assumed.'); onChanged();
      try { setInventory(await fetchSchedulingResources(location)); }
      catch { setError('Saved, but the inventory could not refresh. Close and reopen to retry.'); }
    } catch { setError('The resource could not be saved.'); }
    finally { setBusy(false); }
  };
  const field = { display: 'block', width: '100%', padding: 9, marginTop: 5, marginBottom: 14, border: '1px solid #bbb', borderRadius: 6 };
  return <div style={{ padding: 24 }}>
    <h2 style={{ fontSize: 20, marginBottom: 12 }}>Location cages</h2>
    <p style={{ fontSize: 13, marginBottom: 16 }}>Enter the actual cages available at each location. Rentals require an assigned cage;
      lessons may be assigned later. Retire resources rather than deleting their history.</p>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {message && <p role="status">{message}</p>}
    {!options ? <p>{error ? 'Settings unavailable.' : 'Loading locations…'}</p> : <>
      <label>Location<select required style={field} disabled={busy || editing} value={location} onChange={e => {
        setInventory(null); setLocation(e.target.value); reset(); setError(''); setMessage('');
      }}><option value="">Select location</option>{options.locations.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {options.canConfigureCapacity ? <form onSubmit={save}>
        <label>Cage identifier<input required maxLength={40} style={field} disabled={busy || editing} value={cage} onChange={e => setCage(e.target.value)} placeholder="Example: 1 or A" /></label>
        <label>Purpose<select required style={field} disabled={busy} value={purpose} onChange={e => setPurpose(e.target.value)}>
          <option value="">Select purpose</option><option value="instruction">Instruction</option><option value="rental">Rental</option><option value="both">Shared instruction and rental</option>
        </select></label>
        <label><input type="checkbox" checked={active} disabled={busy} onChange={e => setActive(e.target.checked)} /> Available for bookings</label>
        <label>Reason<textarea required maxLength={2000} style={field} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <OButton type="submit" variant="gold" disabled={busy || !location}>{busy ? 'Saving…' : 'Save resource'}</OButton>
        {editing && <OButton disabled={busy} onClick={reset}>Cancel edit</OButton>}
      </form> : <p>Only tenant owners can configure the inventory.</p>}
      {location && !inventory && <p role="status">{error ? 'Inventory unavailable.' : 'Loading inventory…'}</p>}
      {inventory && <>
        <h3 style={{ marginTop: 18 }}>Configured cages</h3>
        {inventory.resources.length === 0 && <p>No cages configured. Rentals remain unavailable until a rental or shared cage is configured.</p>}
        {inventory.resources.map(row => <div key={row.id} style={{ borderBottom: '1px solid #ddd', padding: '10px 0' }}>
          <p>Cage {row.cage_number} · {row.purpose} · {row.is_active ? 'Available' : 'Retired'}</p>
          {options.canConfigureCapacity && <OButton disabled={busy} onClick={() => {
            setEditing(true); setCage(row.cage_number); setPurpose(row.purpose); setActive(row.is_active); setReason(''); setError(''); setMessage('');
          }}>Edit resource</OButton>}
        </div>)}
        <details style={{ marginTop: 16 }}><summary>Recent audit history (last 20 changes)</summary>
          {inventory.history.map(row => <p key={row.id}>{new Date(row.changed_at).toLocaleString()} · {row.purpose} · {row.is_active ? 'Available' : 'Retired'} · {row.reason} · Staff ID: {row.actor_id}</p>)}
          {inventory.history.length === 0 && <p>No changes recorded.</p>}
        </details>
      </>}
    </>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}><OButton variant="secondary" disabled={busy} onClick={onClose}>Close</OButton></div>
  </div>;
}
