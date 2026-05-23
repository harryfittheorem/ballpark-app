'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, UserCircle, ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export type CoachSession = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  cage_number: string | null;
  status: string;
  attended_at: string | null;
  kid_first_name: string | null;
  kid_last_name: string | null;
  kid_age_group: string | null;
  session_type_name: string | null;
  pending_assignments: number;
  last_session_notes: string | null;
};

type GroupedSession = {
  slot: string;
  bookings: CoachSession[];
};

function statusChip(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed:  { label: 'Not Yet',   cls: 'border-border-gold text-gold bg-gold/10' },
    pending:    { label: 'Pending',   cls: 'border-yellow-600 text-yellow-400 bg-yellow-900/20' },
    completed:  { label: 'Arrived',  cls: 'border-emerald-600 text-emerald-400 bg-emerald-900/20' },
    no_show:    { label: 'No Show',  cls: 'border-red-700 text-red-400 bg-red-900/20' },
    cancelled:  { label: 'Cancelled', cls: 'border-gray-600 text-gray-400 bg-gray-900/20' },
  };
  const s = map[status] ?? { label: status, cls: 'border-border-gold text-text-light' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

function kidName(b: CoachSession): string {
  return [b.kid_first_name, b.kid_last_name].filter(Boolean).join(' ') || 'Unknown';
}

function groupBySlot(bookings: CoachSession[]): GroupedSession[] {
  const map = new Map<string, CoachSession[]>();
  for (const b of bookings) {
    const slot = b.scheduled_start.slice(0, 16);
    if (!map.has(slot)) map.set(slot, []);
    map.get(slot)!.push(b);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, bks]) => ({ slot, bookings: bks }));
}

function slotLabel(iso: string): string {
  const start = new Date(iso);
  const hs = start.getHours();
  const ms = start.getMinutes();
  const ampm = hs >= 12 ? 'PM' : 'AM';
  const h12s = hs > 12 ? hs - 12 : hs === 0 ? 12 : hs;
  return ms === 0 ? `${h12s}:00 ${ampm}` : `${h12s}:${String(ms).padStart(2, '0')} ${ampm}`;
}

export function CoachSessionsBoard({ sessions }: { sessions: CoachSession[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (slot: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });

  const groups = groupBySlot(sessions);

  if (groups.length === 0) {
    return (
      <Card padding="lg" className="border-dashed">
        <p className="text-center text-sm text-text-light">
          No sessions scheduled for you today.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ slot, bookings }) => {
        const isOpen = expanded.has(slot);
        const arrivedCount = bookings.filter((b) => b.status === 'completed').length;

        return (
          <Card key={slot} padding="none" accent>
            {/* Session header — click to expand */}
            <button
              type="button"
              onClick={() => toggle(slot)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
            >
              <div>
                <p className="font-display text-lg font-semibold uppercase tracking-wide text-cream-light">
                  {slotLabel(slot)}
                </p>
                <p className="mt-0.5 text-xs text-text-light">
                  {bookings[0]?.session_type_name ?? 'Session'} ·{' '}
                  {bookings.length} athlete{bookings.length !== 1 ? 's' : ''} ·{' '}
                  {arrivedCount} arrived
                  {bookings[0]?.cage_number ? ` · Cage ${bookings[0].cage_number}` : ''}
                </p>
              </div>
              {isOpen ? (
                <ChevronUp size={18} className="flex-shrink-0 text-text-light" />
              ) : (
                <ChevronDown size={18} className="flex-shrink-0 text-text-light" />
              )}
            </button>

            {/* Roster */}
            {isOpen && (
              <div className="border-t border-border-gold divide-y divide-border-gold/40">
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center gap-4 px-6 py-4"
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border-gold bg-darkest text-gold">
                      <UserCircle size={24} strokeWidth={1.5} />
                    </div>

                    {/* Kid info */}
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-display text-base font-semibold text-cream-light">
                        {kidName(b)}
                      </p>
                      {b.kid_age_group && (
                        <p className="mt-0.5 text-xs text-text-light">
                          {b.kid_age_group}
                        </p>
                      )}
                      {b.last_session_notes && (
                        <p className="mt-1 text-xs text-text-light/70 italic line-clamp-2">
                          Last session: {b.last_session_notes}
                        </p>
                      )}
                    </div>

                    {/* Pending assignments */}
                    {b.pending_assignments > 0 && (
                      <div className="flex items-center gap-1.5 rounded-full border border-yellow-700 bg-yellow-900/20 px-2.5 py-1 text-[11px] font-semibold text-yellow-400">
                        <ClipboardList size={11} />
                        {b.pending_assignments} pending drill{b.pending_assignments !== 1 ? 's' : ''}
                      </div>
                    )}

                    {/* Check-in status */}
                    <div className="flex-shrink-0">
                      {statusChip(b.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
