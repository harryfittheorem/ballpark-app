'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, OCard, BarChart, DonutChart } from '@/components/owner/ui';
import { Calendar, Activity, TrendingUp, Clock, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { OwnerScheduleData, ScheduleBooking } from '@/lib/supabase/ownerQueries';
import { createClient } from '@/lib/supabase/client';

const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM'];
const CAGES = ['Cage 1', 'Cage 2', 'Cage 3', 'Cage 4', 'Cage 5', 'Cage 6', 'Cage 7', 'Cage 8', 'Unassigned'];
const CAGE_NUMBERS: Record<string, number | null> = {
  'Cage 1': 1, 'Cage 2': 2, 'Cage 3': 3, 'Cage 4': 4,
  'Cage 5': 5, 'Cage 6': 6, 'Cage 7': 7, 'Cage 8': 8,
  'Unassigned': null,
};

const now = new Date();
const DAY_NAMES   = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TODAY_LABEL = `${DAY_NAMES[now.getDay()]} · ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

// ── Demo bookings ──────────────────────────────────────────────────────────

function todayAt(h24: number): string {
  const d = new Date();
  d.setHours(h24, 0, 0, 0);
  return d.toISOString();
}

const DEMO_BOOKINGS: ScheduleBooking[] = [
  { id: 'b01', kidName: 'Jake M.',    coachName: 'Mike Rodriguez', scheduledStart: todayAt(9),  scheduledEnd: todayAt(10), cage: 'Cage 1', sessionType: 'Private',     status: 'confirmed', hourLabel: '9 AM' },
  { id: 'b02', kidName: 'Ryan C.',    coachName: 'Sarah Kim',      scheduledStart: todayAt(9),  scheduledEnd: todayAt(10), cage: 'Cage 2', sessionType: 'Private',     status: 'confirmed', hourLabel: '9 AM' },
  { id: 'b03', kidName: 'Aiden T.',   coachName: 'Mike Rodriguez', scheduledStart: todayAt(9),  scheduledEnd: todayAt(10), cage: 'Cage 3', sessionType: 'Private',     status: 'confirmed', hourLabel: '9 AM' },
  { id: 'b04', kidName: 'Caleb N.',   coachName: 'Dave Thompson',  scheduledStart: todayAt(10), scheduledEnd: todayAt(11), cage: 'Cage 1', sessionType: 'Group',       status: 'confirmed', hourLabel: '10 AM' },
  { id: 'b05', kidName: 'Noah P.',    coachName: 'Sarah Kim',      scheduledStart: todayAt(10), scheduledEnd: todayAt(11), cage: 'Cage 2', sessionType: 'Private',     status: 'confirmed', hourLabel: '10 AM' },
  { id: 'b06', kidName: 'Liam P.',    coachName: 'Dave Thompson',  scheduledStart: todayAt(11), scheduledEnd: todayAt(12), cage: 'Cage 1', sessionType: 'Cage Rental', status: 'confirmed', hourLabel: '11 AM' },
  { id: 'b07', kidName: 'Logan S.',   coachName: 'Mike Rodriguez', scheduledStart: todayAt(11), scheduledEnd: todayAt(12), cage: 'Cage 3', sessionType: 'Private',     status: 'confirmed', hourLabel: '11 AM' },
  { id: 'b08', kidName: 'Hunter D.',  coachName: 'Sarah Kim',      scheduledStart: todayAt(12), scheduledEnd: todayAt(13), cage: 'Cage 2', sessionType: 'Cage Rental', status: 'confirmed', hourLabel: '12 PM' },
  { id: 'b09', kidName: 'Jaxon R.',   coachName: 'Dave Thompson',  scheduledStart: todayAt(13), scheduledEnd: todayAt(14), cage: 'Cage 4', sessionType: 'Group',       status: 'confirmed', hourLabel: '1 PM' },
  { id: 'b10', kidName: 'Zane H.',    coachName: 'Mike Rodriguez', scheduledStart: todayAt(14), scheduledEnd: todayAt(15), cage: 'Cage 1', sessionType: 'Private',     status: 'confirmed', hourLabel: '2 PM' },
  { id: 'b11', kidName: 'Ethan B.',   coachName: 'Sarah Kim',      scheduledStart: todayAt(14), scheduledEnd: todayAt(15), cage: 'Cage 2', sessionType: 'Private',     status: 'confirmed', hourLabel: '2 PM' },
  { id: 'b12', kidName: 'Carter S.',  coachName: 'Dave Thompson',  scheduledStart: todayAt(14), scheduledEnd: todayAt(15), cage: 'Cage 3', sessionType: 'Cage Rental', status: 'confirmed', hourLabel: '2 PM' },
  { id: 'b13', kidName: 'Marcus W.',  coachName: 'Mike Rodriguez', scheduledStart: todayAt(15), scheduledEnd: todayAt(16), cage: 'Cage 1', sessionType: 'Private',     status: 'pending',   hourLabel: '3 PM' },
  { id: 'b14', kidName: 'Owen M.',    coachName: 'Sarah Kim',      scheduledStart: todayAt(15), scheduledEnd: todayAt(16), cage: 'Cage 2', sessionType: 'Group',       status: 'confirmed', hourLabel: '3 PM' },
  { id: 'b15', kidName: 'Tyler J.',   coachName: 'Dave Thompson',  scheduledStart: todayAt(16), scheduledEnd: todayAt(17), cage: 'Cage 1', sessionType: 'Private',     status: 'confirmed', hourLabel: '4 PM' },
  { id: 'b16', kidName: 'Jake M.',    coachName: 'Mike Rodriguez', scheduledStart: todayAt(16), scheduledEnd: todayAt(17), cage: 'Cage 2', sessionType: 'Group',       status: 'confirmed', hourLabel: '4 PM' },
  { id: 'b17', kidName: 'Aiden T.',   coachName: 'Sarah Kim',      scheduledStart: todayAt(16), scheduledEnd: todayAt(17), cage: 'Cage 3', sessionType: 'Private',     status: 'confirmed', hourLabel: '4 PM' },
  { id: 'b18', kidName: 'Ryan C.',    coachName: 'Dave Thompson',  scheduledStart: todayAt(16), scheduledEnd: todayAt(17), cage: 'Cage 4', sessionType: 'Cage Rental', status: 'confirmed', hourLabel: '4 PM' },
  { id: 'b19', kidName: 'Caleb N.',   coachName: 'Mike Rodriguez', scheduledStart: todayAt(17), scheduledEnd: todayAt(18), cage: 'Cage 1', sessionType: 'Group',       status: 'confirmed', hourLabel: '5 PM' },
  { id: 'b20', kidName: 'Noah P.',    coachName: 'Sarah Kim',      scheduledStart: todayAt(17), scheduledEnd: todayAt(18), cage: 'Cage 2', sessionType: 'Private',     status: 'confirmed', hourLabel: '5 PM' },
];

type Props = { data: OwnerScheduleData };

type Popover = {
  bookingId: string;
  currentCage: string | null;
  top: number;
  left: number;
};

function cageLabel(cage: string | null): string {
  if (!cage) return 'Unassigned';
  return cage;
}

function bookingsForSlot(bookings: ScheduleBooking[], cage: string, hour: string): ScheduleBooking[] {
  return bookings.filter(b => {
    const h = new Date(b.scheduledStart).getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const label = `${hr12} ${ampm}`;
    if (cage === 'Unassigned') return label === hour && b.cage === null;
    return label === hour && b.cage === cage;
  });
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: brand.success,
  pending:   brand.warning,
  completed: brand.info,
  cancelled: brand.danger,
};

export function ScheduleContent({ data }: Props) {
  const hasLiveData = data.bookings.length > 0;

  const initialBookings = hasLiveData ? data.bookings : DEMO_BOOKINGS;
  const [bookings, setBookings] = useState<ScheduleBooking[]>(initialBookings);
  const [popover, setPopover]   = useState<Popover | null>(null);
  const [saving, setSaving]     = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const totalToday   = hasLiveData ? data.totalToday   : DEMO_BOOKINGS.length;
  const occupancyPct = hasLiveData ? data.occupancyPct : 78;
  const peakHour     = hasLiveData ? data.peakHour     : '4 PM';
  const openSlots    = hasLiveData ? data.openSlots    : CAGES.length * HOURS.length - totalToday;

  const sessionTypeMap: Record<string, number> = {};
  for (const b of bookings) {
    sessionTypeMap[b.sessionType] = (sessionTypeMap[b.sessionType] ?? 0) + 1;
  }
  const sessionTypes = Object.entries(sessionTypeMap);

  const hourBarData = HOURS.map(h => ({
    label:     h,
    value:     bookings.filter(b => b.hourLabel === h).length,
    highlight: h === peakHour,
  }));

  // Close popover on outside click
  useEffect(() => {
    if (!popover) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popover]);

  // Close popover on Escape
  useEffect(() => {
    if (!popover) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopover(null);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [popover]);

  const openPopover = useCallback((booking: ScheduleBooking, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      bookingId:   booking.id,
      currentCage: booking.cage,
      top:         rect.bottom + window.scrollY + 4,
      left:        rect.left + window.scrollX,
    });
    setErrorMsg(null);
  }, []);

  const assignCage = useCallback(async (bookingId: string, cageName: string) => {
    if (!hasLiveData) {
      // Demo mode — just update local state, no DB call
      const cageNum = CAGE_NUMBERS[cageName];
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, cage: cageNum == null ? null : cageName } : b
      ));
      setPopover(null);
      return;
    }

    const cageNum = CAGE_NUMBERS[cageName];
    const previous = bookings.find(b => b.id === bookingId);

    // Optimistic update
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, cage: cageNum == null ? null : cageName } : b
    ));
    setPopover(null);
    setSaving(bookingId);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('bookings')
        .update({ cage_number: cageNum })
        .eq('id', bookingId);

      if (error) throw error;
    } catch {
      // Roll back
      if (previous) {
        setBookings(prev => prev.map(b =>
          b.id === bookingId ? previous : b
        ));
      }
      setErrorMsg('Failed to save cage assignment. Please try again.');
    } finally {
      setSaving(null);
    }
  }, [bookings, hasLiveData]);

  return (
    <div onClick={() => setPopover(null)}>
      <PageHeader
        title="Schedule & Capacity"
        subtitle={`${TODAY_LABEL} · 8 cages`}
        actions={
          <>
            <OButton variant="secondary" icon={Filter}>Filter</OButton>
            <OButton variant="gold" icon={Plus}>New Booking</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Today's Sessions" value={totalToday}              deltaLabel="booked"        icon={Calendar} color="gold" />
          <KPICard label="Today's Occupancy" value={`${occupancyPct}%`}    icon={Activity}             color="success" />
          <KPICard label="Peak Hour"         value={peakHour ?? '—'}        deltaLabel="busiest slot"  icon={TrendingUp} color="warning" />
          <KPICard label="Open Slots"        value={openSlots}              deltaLabel="today"         icon={Clock} />
        </div>

        {errorMsg && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: `${brand.danger}18`, border: `1px solid ${brand.danger}`, borderRadius: 6, fontSize: 12, color: brand.danger }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <OButton variant="secondary" size="sm" icon={ChevronLeft}>Prev</OButton>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, padding: '0 8px' }}>{TODAY_LABEL}</div>
          <OButton variant="secondary" size="sm" icon={ChevronRight}>Next</OButton>
          <OButton variant="ghost" size="sm">Today</OButton>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <OButton variant="gold"  size="sm">Day</OButton>
            <OButton variant="ghost" size="sm">Week</OButton>
            <OButton variant="ghost" size="sm">Month</OButton>
          </div>
        </div>

        <OCard padding={0}>
          <div style={{ overflow: 'auto' }}>
            <div style={{ minWidth: 900, padding: 16 }}>
              {/* Cage headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, 1fr) minmax(80px, 0.8fr)', gap: 4, marginBottom: 8 }}>
                <div />
                {CAGES.map(c => (
                  <div key={c} style={{
                    fontSize: 10, fontWeight: 700,
                    color: c === 'Unassigned' ? brand.warning : brand.textMuted,
                    textAlign: 'center', letterSpacing: 0.5, padding: '6px 0',
                    background: brand.surfaceAlt, borderRadius: 4,
                    fontStyle: c === 'Unassigned' ? 'italic' : 'normal',
                  }}>
                    {c.toUpperCase()}
                  </div>
                ))}
              </div>

              {/* Hour rows */}
              {HOURS.map((hr, hi) => (
                <div key={hi} style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, 1fr) minmax(80px, 0.8fr)', gap: 4, marginBottom: 4, minHeight: 48 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, padding: '14px 0', textAlign: 'right', paddingRight: 8 }}>{hr}</div>
                  {CAGES.map((cage, ci) => {
                    const slot = bookingsForSlot(bookings, cage, hr);
                    return (
                      <div
                        key={ci}
                        style={{
                          background: slot.length > 0 ? `${STATUS_COLOR[slot[0].status] ?? brand.info}22` : brand.creamLight,
                          borderRadius: 6, padding: 6,
                          border: `1px solid ${slot.length > 0 ? (STATUS_COLOR[slot[0].status] ?? brand.info) : brand.border}`,
                          cursor: slot.length > 0 ? 'pointer' : 'default',
                          minHeight: 42,
                        }}
                      >
                        {slot.map((b, si) => (
                          <div
                            key={si}
                            title={`${b.kidName} · ${b.sessionType}${b.coachName ? ` · ${b.coachName}` : ''}\nClick to assign cage`}
                            onClick={e => openPopover(b, e)}
                            style={{
                              fontSize: 9, fontWeight: 700,
                              color: saving === b.id ? brand.textMuted : (STATUS_COLOR[b.status] ?? brand.info),
                              lineHeight: 1.4,
                              borderRadius: 3,
                              padding: '1px 2px',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            {b.kidName}
                            {cage === 'Unassigned' && (
                              <div style={{ fontSize: 8, color: brand.warning, fontWeight: 600, marginTop: 1 }}>
                                tap to assign
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </OCard>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <OCard>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, color: brand.text, textTransform: 'uppercase' }}>Peak Hour Analysis</div>
              <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Today&apos;s hourly booking distribution</div>
            </div>
            <BarChart data={hourBarData} height={180} />
          </OCard>

          <OCard>
            <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, color: brand.text, textTransform: 'uppercase' }}>Session Type Breakdown</div>
            {sessionTypes.length > 0 ? (
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <DonutChart
                  data={sessionTypes.map(([, v], i) => ({ value: v, color: [brand.goldDeep, brand.info, brand.success, brand.warning][i % 4] }))}
                  size={140}
                />
                <div style={{ flex: 1 }}>
                  {sessionTypes.map(([type, count], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < sessionTypes.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: [brand.goldDeep, brand.info, brand.success, brand.warning][i % 4] }} />
                        <span style={{ fontSize: 12 }}>{type}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: brand.textMuted }}>No sessions booked yet.</div>
            )}
          </OCard>
        </div>
      </div>

      {/* Cage assignment popover */}
      {popover && (
        <div
          ref={popoverRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: Math.min(popover.top, window.innerHeight - 260),
            left: Math.min(popover.left, window.innerWidth - 180),
            zIndex: 1000,
            background: brand.surface,
            border: `1px solid ${brand.border}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: 8,
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: `1px solid ${brand.border}`, marginBottom: 4 }}>
            Assign Cage
          </div>
          {CAGES.map(cage => {
            const isCurrent = cageLabel(popover.currentCage) === cage;
            return (
              <button
                key={cage}
                onClick={() => assignCage(popover.bookingId, cage)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 10px', border: 'none', borderRadius: 5,
                  cursor: 'pointer', fontSize: 12, fontWeight: isCurrent ? 700 : 400,
                  background: isCurrent ? `${brand.goldDeep}22` : 'transparent',
                  color: cage === 'Unassigned' ? brand.warning : (isCurrent ? brand.goldDeep : brand.text),
                  fontStyle: cage === 'Unassigned' ? 'italic' : 'normal',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${brand.goldDeep}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isCurrent ? `${brand.goldDeep}22` : 'transparent'; }}
              >
                {isCurrent ? `✓ ${cage}` : cage}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
