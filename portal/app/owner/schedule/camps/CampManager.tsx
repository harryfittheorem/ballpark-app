'use client';

import { useEffect, useRef, useState } from 'react';
import { OButton } from '@/components/owner/ui';
import { getSchedulingOptions } from '../actions';
import { archiveCampDraft, fetchCampEvents } from './actions';
import { CampDraftForm } from './CampDraftForm';
import { CampRoster } from './CampRoster';

type Options = Awaited<ReturnType<typeof getSchedulingOptions>>;
type Event = Awaited<ReturnType<typeof fetchCampEvents>>[number];

export function CampManager({ basePath = '/owner/schedule', checkInHref = '/admin/check-in' }: { basePath?: string; checkInHref?: string }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [location, setLocation] = useState('');
  const [events, setEvents] = useState<Event[] | null>(null);
  const [editing, setEditing] = useState<Event | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [roster, setRoster] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const locationRef = useRef(location);
  locationRef.current = location;
  useEffect(() => {
    let active = true;
    getSchedulingOptions().then(data => { if (active) { setOptions(data); setLocation(data.locations[0]?.id ?? ''); } })
      .catch(() => { if (active) setError('Camp options could not be loaded.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    setEvents(null);
    if (!location) return;
    let active = true;
    fetchCampEvents(location).then(data => { if (active) setEvents(data); })
      .catch(() => { if (active) setError('Camp events could not be loaded.'); });
    return () => { active = false; };
  }, [location]);
  const reload = async () => {
    const requestedLocation = location;
    try {
      const data = await fetchCampEvents(requestedLocation);
      if (locationRef.current === requestedLocation) setEvents(data);
    } catch { if (locationRef.current === requestedLocation) setError('The change was saved, but the event list could not refresh. Select the location again to retry.'); }
  };
  const archive = async (event: Event) => {
    if (!confirm('Archive this draft? Its dates remain in history. No enrollment or payment will be cancelled.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await archiveCampDraft(event.id);
      if (!result.ok) { setError(result.error); return; }
      setMessage('Draft archived. No payments or attendance were changed.'); await reload();
    } catch { setError('The draft could not be archived.'); }
    finally { setBusy(false); }
  };
  return <div style={{ padding: 24, maxWidth: 980 }}>
    <h1>Camps & clinics</h1>
    <p role="status"><strong>Paid camp sales are disabled.</strong> Drafts do not collect money, enroll athletes or mark attendance.
      Refund, cancellation, partial-attendance and payment/capacity-failure policies still need approval.</p>
    <p><a href={basePath}>Back to Schedule</a></p>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {message && <p role="status">{message}</p>}
    {!options ? <p>{error ? 'Options unavailable.' : 'Loading locations…'}</p> : <>
      <label>Location<select disabled={busy || showForm} value={location} style={{ margin: 12, padding: 8 }} onChange={e => {
        setLocation(e.target.value); setEvents(null); setRoster(null); setEditing(null); setError(''); setMessage('');
      }}><option value="">Select location</option>{options.locations.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {options.canConfigureOverrides && !showForm && <OButton disabled={!location || busy} variant="gold" onClick={() => { setEditing(null); setShowForm(true); }}>New event draft</OButton>}
      {showForm && <CampDraftForm key={editing?.id ?? 'new'} locationId={location} options={options} event={editing}
        onCancel={() => { setShowForm(false); setEditing(null); }} onSaved={() => {
          setShowForm(false); setEditing(null); setMessage('Event draft saved. Paid sales remain disabled.'); void reload();
        }} />}
      {location && !events && <p>{error ? 'Events unavailable.' : 'Loading events…'}</p>}
      {events?.length === 0 && <p>No camp or clinic drafts at this location.</p>}
      {events && <p>Showing the latest 100 events, including archived drafts.</p>}
      {events?.map(event => <section key={event.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 18, marginTop: 16 }}>
        <h2>{event.name} · {event.offering_category}</h2>
        <p>{event.status} · {event.enrolled}/{event.capacity} enrolled · {event.camp_event_days.length} day windows · Sales disabled in this release</p>
        <ol>{event.camp_event_days.map(day => <li key={day.id}>{new Date(day.starts_at).toLocaleString()} – {new Date(day.ends_at).toLocaleString()} · {day.cage_number ? `Cage ${day.cage_number}` : 'Resource unassigned'}</li>)}</ol>
        {options.canConfigureOverrides && event.status === 'draft' && !event.sales_enabled && event.enrolled === 0 && !showForm && <>
          <OButton disabled={busy} onClick={() => { setEditing(event); setShowForm(true); }}>Edit draft</OButton>
          <OButton disabled={busy} onClick={() => { void archive(event); }}>Archive draft</OButton>
        </>}
        <OButton disabled={busy} onClick={() => setRoster(current => current === event.id ? null : event.id)}>Daily roster</OButton>
        {roster === event.id && <CampRoster eventId={event.id} locationId={location} checkInHref={checkInHref} />}
      </section>)}
    </>}
  </div>;
}
