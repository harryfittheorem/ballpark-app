'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { checkInBookingAction, markNoShowAction, undoCheckInAction, fetchCheckInRoster, fetchCheckInInstructors, correctInstructorAction, fetchCheckInWaitlistCounts } from './actions';
import { CheckCircle, XCircle, RotateCcw, Clock, UserCircle, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export type CheckInBooking = {
  id: string;
  location_id: string;
  actual_coach_id: string | null;
  actual_coach_first_name: string | null;
  actual_coach_last_name: string | null;
  type_category: string;
  can_correct_instructor: boolean;
  scheduled_start: string;
  scheduled_end: string;
  cage_number: string | null;
  status: string;
  attended_at: string | null;
  kid_first_name: string | null;
  kid_last_name: string | null;
  coach_first_name: string | null;
  coach_last_name: string | null;
  session_type_name: string | null;
};

export type WaitlistCount = {
  hour_label: string;
  count: number;
};

type BookingState = CheckInBooking & { pending?: 'checkin' | 'noshow' | 'undo' };

function statusChip(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed:  { label: 'Confirmed',  cls: 'border-border-gold text-gold bg-gold/10' },
    pending:    { label: 'Pending',    cls: 'border-yellow-600 text-yellow-400 bg-yellow-900/20' },
    completed:  { label: 'Arrived',   cls: 'border-emerald-600 text-emerald-400 bg-emerald-900/20' },
    no_show:    { label: 'No Show',   cls: 'border-red-700 text-red-400 bg-red-900/20' },
    cancelled:  { label: 'Cancelled', cls: 'border-gray-600 text-gray-400 bg-gray-900/20' },
  };
  const s = map[status] ?? { label: status, cls: 'border-border-gold text-text-light' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const min = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return min === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

function kidName(b: CheckInBooking): string {
  return [b.kid_first_name, b.kid_last_name].filter(Boolean).join(' ') || 'Unknown';
}
function coachName(b: CheckInBooking): string {
  return [b.coach_first_name, b.coach_last_name].filter(Boolean).join(' ') || '—';
}

function isWithinUndo(b: CheckInBooking): boolean {
  if (!b.attended_at || b.status !== 'completed') return false;
  return Date.now() - new Date(b.attended_at).getTime() < 5 * 60 * 1000;
}

type Props = { initialBookings: CheckInBooking[]; waitlistCounts: WaitlistCount[]; tenantId: string };

export function CheckInBoard({ initialBookings, waitlistCounts, tenantId }: Props) {
  const [bookings, setBookings] = useState<BookingState[]>(initialBookings);
  const [liveWaitlist, setLiveWaitlist] = useState(waitlistCounts);
  const waitlistByHour = new Map(liveWaitlist.map((w) => [w.hour_label, w.count]));
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [instructors, setInstructors] = useState<Record<string, {id: string; first_name: string; last_name: string | null}[]>>({});
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const rosterVersion = useRef(0);

  useEffect(() => { setBookings(initialBookings); }, [initialBookings]);

  const reload = useCallback(async () => {
    const version = ++rosterVersion.current;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    try {
      const [rows, counts] = await Promise.all([
        fetchCheckInRoster(today.toISOString(), tomorrow.toISOString()),
        fetchCheckInWaitlistCounts(today.toISOString(), tomorrow.toISOString()),
      ]);
      if (version !== rosterVersion.current) return;
      setLiveWaitlist(counts);
      setBookings(rows); setRosterError(null);
      const locations = [...new Set(rows.map(row => row.location_id))];
      const pairs = await Promise.all(locations.map(async id => [id, await fetchCheckInInstructors(id)] as const));
      if (version !== rosterVersion.current) return;
      setInstructors(Object.fromEntries(pairs));
    } catch (error) { if (version === rosterVersion.current) setRosterError(error instanceof Error ? error.message : 'Roster unavailable.'); }
  }, []);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('checkin-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => { void reload(); },
      )
      .subscribe(status => { if (status === 'SUBSCRIBED') void reload(); });
    void reload();
    const timer = setInterval(() => { void reload(); }, 30000);
    const refresh = () => { void reload(); };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, reload]);

  const callRpc = useCallback(
    async (
      rpc: 'check_in_booking' | 'mark_no_show' | 'undo_check_in',
      bookingId: string,
      pendingState: 'checkin' | 'noshow' | 'undo',
    ) => {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, pending: pendingState } : b)),
      );

      const actionMap = {
        check_in_booking: checkInBookingAction,
        mark_no_show: markNoShowAction,
        undo_check_in: undoCheckInAction,
      };
      const result = await (rpc === 'check_in_booking'
        ? checkInBookingAction(bookingId, chosen[bookingId])
        : actionMap[rpc](bookingId))
        .catch(error => ({ ok: false as const, message: error instanceof Error ? error.message : 'Attendance was not saved. Retry safely.' }));

      if (!result.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, pending: undefined } : b)),
        );
        showToast(result.message, false);
        return;
      }

      const updated = result.data;
      ++rosterVersion.current;
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: updated.status, attended_at: updated.attended_at, pending: undefined }
            : b,
        ),
      );

      const labels: Record<string, string> = {
        check_in_booking: 'Checked in!',
        mark_no_show: 'Marked no-show.',
        undo_check_in: 'Check-in undone.',
      };
      showToast(labels[rpc] ?? 'Done.');
      void reload();
    },
    [showToast, chosen, reload],
  );

  // Group by hour slot
  const groups = new Map<string, BookingState[]>();
  for (const b of bookings) {
    const label = hourLabel(b.scheduled_start);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(b);
  }
  const sortedHours = Array.from(groups.keys()).sort((a, b) => {
    const toMin = (s: string) => {
      const [time, ampm] = s.split(' ');
      const [h, m] = time.split(':').map(Number);
      return (ampm === 'PM' && h !== 12 ? h + 12 : ampm === 'AM' && h === 12 ? 0 : h) * 60 + m;
    };
    return toMin(a) - toMin(b);
  });

  return (
    <div className="space-y-8">
      {rosterError && <p role="alert" className="text-red-400">Roster refresh failed: {rosterError} <button onClick={() => void reload()}>Retry</button></p>}
      {/* Toast */}
      {toast && (
        <div
          className={[
            'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl transition-all',
            toast.ok
              ? 'border-emerald-600 bg-emerald-900/80 text-emerald-300'
              : 'border-red-700 bg-red-900/80 text-red-300',
          ].join(' ')}
        >
          {toast.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {bookings.length === 0 && (
        <Card padding="lg" className="border-dashed">
          <p className="text-center text-sm text-text-light">
            No bookings scheduled for today.
          </p>
        </Card>
      )}

      {sortedHours.map((hour) => {
        const slots = groups.get(hour)!;
        return (
          <section key={hour}>
            <div className="mb-3 flex items-center gap-3">
              <Clock size={14} className="text-gold" />
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-gold">
                {hour}
              </h2>
              <span className="text-xs text-text-light">
                {slots.length} session{slots.length !== 1 ? 's' : ''}
              </span>
              {waitlistByHour.get(hour) ? (
                <span className="flex items-center gap-1 rounded-full border border-amber-600 bg-amber-900/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  <Users size={10} />
                  Waitlist: {waitlistByHour.get(hour)}
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              {slots.map((b) => {
                const isLoading = !!b.pending || correcting === b.id;
                const canUndo = isWithinUndo(b);

                return (
                  <Card key={b.id} padding="md">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Avatar */}
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border-gold bg-darkest text-gold">
                        <UserCircle size={24} strokeWidth={1.5} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-[160px]">
                        <p className="font-display text-base font-semibold text-cream-light">
                          {kidName(b)}
                        </p>
                        <p className="mt-0.5 text-xs text-text-light">
                          {b.session_type_name ?? 'Session'}
                          {b.cage_number ? ` · Cage ${b.cage_number}` : ''}
                           {' · Scheduled: '}{coachName(b)}
                           {' · Actual: '}{[b.actual_coach_first_name,b.actual_coach_last_name].filter(Boolean).join(' ') || 'Not recorded'}
                        </p>
                      </div>

                      {/* Status chip */}
                      <div className="flex-shrink-0">
                        {statusChip(b.status)}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {b.type_category !== 'cage' && (b.status === 'pending' || b.status === 'confirmed' || (b.status === 'completed' && b.can_correct_instructor)) && (
                          <select aria-label={`Actual instructor for ${kidName(b)}`} className="rounded border p-2 bg-darkest text-cream-light"
                            value={chosen[b.id] ?? ''} onChange={e => setChosen(prev => ({...prev, [b.id]: e.target.value}))}>
                            <option value="">Choose actual instructor</option>
                            {(instructors[b.location_id] ?? []).map(c => <option key={c.id} value={c.id}>{[c.first_name,c.last_name].filter(Boolean).join(' ')}</option>)}
                          </select>
                        )}
                        {b.status === 'completed' && b.can_correct_instructor && b.type_category !== 'cage' && <button disabled={!chosen[b.id] || chosen[b.id] === b.actual_coach_id || isLoading}
                          onClick={async () => {
                            const reason = window.prompt('Reason for instructor correction');
                            if (!reason?.trim()) return;
                            setCorrecting(b.id);
                            try {
                              const result = await correctInstructorAction(b.id, chosen[b.id], reason);
                              showToast(result.ok ? 'Instructor corrected.' : result.message, result.ok);
                              if (result.ok) { ++rosterVersion.current; void reload(); }
                            } catch (error) {
                              showToast(error instanceof Error ? error.message : 'Instructor correction failed.', false);
                            } finally { setCorrecting(null); }
                          }}>Correct instructor</button>}
                        {(b.status === 'confirmed' || b.status === 'pending') && (
                          <>
                            <button
                              type="button"
                               disabled={isLoading || (b.type_category !== 'cage' && !chosen[b.id])}
                              onClick={() => callRpc('check_in_booking', b.id, 'checkin')}
                              className="flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-900/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-800/50 disabled:opacity-50"
                            >
                              {b.pending === 'checkin' ? '…' : <><CheckCircle size={13} /> Check In</>}
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => callRpc('mark_no_show', b.id, 'noshow')}
                              className="flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-900/20 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-900/40 disabled:opacity-50"
                            >
                              {b.pending === 'noshow' ? '…' : <><XCircle size={13} /> No Show</>}
                            </button>
                          </>
                        )}

                        {b.status === 'completed' && canUndo && (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => callRpc('undo_check_in', b.id, 'undo')}
                            className="flex items-center gap-1.5 rounded-lg border border-border-gold bg-darkest px-3 py-1.5 text-xs font-semibold text-text-light transition hover:border-gold hover:text-cream-light disabled:opacity-50"
                          >
                            {b.pending === 'undo' ? '…' : <><RotateCcw size={13} /> Undo</>}
                          </button>
                        )}

                        {b.status === 'completed' && !canUndo && (
                          <span className="text-xs text-text-light/60 italic">Arrived</span>
                        )}
                        {b.status === 'no_show' && (
                          <span className="text-xs text-text-light/60 italic">No show recorded</span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
