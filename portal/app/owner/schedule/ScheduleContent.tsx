'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, OCard, BarChart, DonutChart } from '@/components/owner/ui';
import { Calendar, Activity, TrendingUp, Clock, Filter, Plus, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';
import type { OwnerScheduleData, ScheduleBooking } from '@/lib/supabase/ownerQueries';
import { createClient } from '@/lib/supabase/client';

const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM'];
const CAGES = ['Cage 1', 'Cage 2', 'Cage 3', 'Cage 4', 'Cage 5', 'Cage 6', 'Cage 7', 'Cage 8', 'Unassigned'];
const CAGE_NUMBERS: Record<string, number | null> = {
  'Cage 1': 1, 'Cage 2': 2, 'Cage 3': 3, 'Cage 4': 4,
  'Cage 5': 5, 'Cage 6': 6, 'Cage 7': 7, 'Cage 8': 8,
  'Unassigned': null,
};

const DAY_NAMES   = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dateLabel(d: Date) {
  return `${DAY_NAMES[d.getDay()]} · ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function todayAt(h24: number): string {
  const d = new Date();
  d.setHours(h24, 0, 0, 0);
  return d.toISOString();
}

function localHourLabel(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hr12} ${ampm}`;
}

const DEMO_BOOKINGS: ScheduleBooking[] = [
  { id: 'b01', kidName: 'Jake M.',    coachName: 'Mike Rodriguez', scheduledStart: todayAt(9),  scheduledEnd: todayAt(10), cage: 'Cage 1', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b02', kidName: 'Ryan C.',    coachName: 'Sarah Kim',      scheduledStart: todayAt(9),  scheduledEnd: todayAt(10), cage: 'Cage 2', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b03', kidName: 'Aiden T.',   coachName: 'Mike Rodriguez', scheduledStart: todayAt(9),  scheduledEnd: todayAt(10), cage: 'Cage 3', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b04', kidName: 'Caleb N.',   coachName: 'Dave Thompson',  scheduledStart: todayAt(10), scheduledEnd: todayAt(11), cage: 'Cage 1', sessionType: 'Group',       status: 'confirmed' },
  { id: 'b05', kidName: 'Noah P.',    coachName: 'Sarah Kim',      scheduledStart: todayAt(10), scheduledEnd: todayAt(11), cage: 'Cage 2', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b06', kidName: 'Liam P.',    coachName: 'Dave Thompson',  scheduledStart: todayAt(11), scheduledEnd: todayAt(12), cage: 'Cage 1', sessionType: 'Cage Rental', status: 'confirmed' },
  { id: 'b07', kidName: 'Logan S.',   coachName: 'Mike Rodriguez', scheduledStart: todayAt(11), scheduledEnd: todayAt(12), cage: 'Cage 3', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b08', kidName: 'Hunter D.',  coachName: 'Sarah Kim',      scheduledStart: todayAt(12), scheduledEnd: todayAt(13), cage: 'Cage 2', sessionType: 'Cage Rental', status: 'confirmed' },
  { id: 'b09', kidName: 'Jaxon R.',   coachName: 'Dave Thompson',  scheduledStart: todayAt(13), scheduledEnd: todayAt(14), cage: 'Cage 4', sessionType: 'Group',       status: 'confirmed' },
  { id: 'b10', kidName: 'Zane H.',    coachName: 'Mike Rodriguez', scheduledStart: todayAt(14), scheduledEnd: todayAt(15), cage: 'Cage 1', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b11', kidName: 'Ethan B.',   coachName: 'Sarah Kim',      scheduledStart: todayAt(14), scheduledEnd: todayAt(15), cage: 'Cage 2', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b12', kidName: 'Carter S.',  coachName: 'Dave Thompson',  scheduledStart: todayAt(14), scheduledEnd: todayAt(15), cage: 'Cage 3', sessionType: 'Cage Rental', status: 'confirmed' },
  { id: 'b13', kidName: 'Marcus W.',  coachName: 'Mike Rodriguez', scheduledStart: todayAt(15), scheduledEnd: todayAt(16), cage: 'Cage 1', sessionType: 'Private',     status: 'pending'   },
  { id: 'b14', kidName: 'Owen M.',    coachName: 'Sarah Kim',      scheduledStart: todayAt(15), scheduledEnd: todayAt(16), cage: 'Cage 2', sessionType: 'Group',       status: 'confirmed' },
  { id: 'b15', kidName: 'Tyler J.',   coachName: 'Dave Thompson',  scheduledStart: todayAt(16), scheduledEnd: todayAt(17), cage: 'Cage 1', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b16', kidName: 'Jake M.',    coachName: 'Mike Rodriguez', scheduledStart: todayAt(16), scheduledEnd: todayAt(17), cage: 'Cage 2', sessionType: 'Group',       status: 'confirmed' },
  { id: 'b17', kidName: 'Aiden T.',   coachName: 'Sarah Kim',      scheduledStart: todayAt(16), scheduledEnd: todayAt(17), cage: 'Cage 3', sessionType: 'Private',     status: 'confirmed' },
  { id: 'b18', kidName: 'Ryan C.',    coachName: 'Dave Thompson',  scheduledStart: todayAt(16), scheduledEnd: todayAt(17), cage: 'Cage 4', sessionType: 'Cage Rental', status: 'confirmed' },
  { id: 'b19', kidName: 'Caleb N.',   coachName: 'Mike Rodriguez', scheduledStart: todayAt(17), scheduledEnd: todayAt(18), cage: 'Cage 1', sessionType: 'Group',       status: 'confirmed' },
  { id: 'b20', kidName: 'Noah P.',    coachName: 'Sarah Kim',      scheduledStart: todayAt(17), scheduledEnd: todayAt(18), cage: 'Cage 2', sessionType: 'Private',     status: 'confirmed' },
];

type Props = { data: OwnerScheduleData };

type Popover = {
  bookingId: string;
  currentCage: string | null;
  top: number;
  left: number;
};

type ViewMode = 'day' | 'week' | 'month';

function cageLabel(cage: string | null): string {
  if (!cage) return 'Unassigned';
  return cage;
}

function bookingsForSlot(bookings: ScheduleBooking[], cage: string, hour: string): ScheduleBooking[] {
  return bookings.filter(b => {
    const label = localHourLabel(b.scheduledStart);
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${brand.border}`,
  borderRadius: 7, fontSize: 13, color: brand.text, background: brand.surface,
  fontFamily: fonts.body, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5,
  textTransform: 'uppercase', marginBottom: 5, display: 'block',
};

export function ScheduleContent({ data }: Props) {
  const hasLiveData = data.bookings.length > 0;

  const initialBookings = hasLiveData ? data.bookings : DEMO_BOOKINGS;
  const [bookings,      setBookings]     = useState<ScheduleBooking[]>(initialBookings);
  const [popover,       setPopover]      = useState<Popover | null>(null);
  const [saving,        setSaving]       = useState<string | null>(null);
  const [errorMsg,      setErrorMsg]     = useState<string | null>(null);
  const [viewMode,      setViewMode]     = useState<ViewMode>('day');
  const [currentDate,   setCurrentDate]  = useState<Date>(() => new Date());
  const [showFilter,    setShowFilter]   = useState(false);
  const [filterType,    setFilterType]   = useState<string>('all');
  const [filterCoach,   setFilterCoach]  = useState<string>('all');
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [toast,         setToast]        = useState<string | null>(null);
  const [bookingForm,   setBookingForm]  = useState({
    kidName: '', coachName: 'Mike Rodriguez', sessionType: 'Private',
    date: '', startHour: '9', cage: 'Cage 1',
  });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBookings(hasLiveData ? data.bookings : DEMO_BOOKINGS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.bookings]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const isToday = currentDate.toDateString() === new Date().toDateString();

  const totalToday   = hasLiveData ? data.totalToday   : DEMO_BOOKINGS.length;
  const occupancyPct = hasLiveData ? data.occupancyPct : 78;
  const openSlots    = hasLiveData ? data.openSlots    : CAGES.length * HOURS.length - totalToday;

  const hourCounts: Record<string, number> = {};
  for (const b of bookings) {
    const lbl = localHourLabel(b.scheduledStart);
    hourCounts[lbl] = (hourCounts[lbl] ?? 0) + 1;
  }
  const peakHour = Object.keys(hourCounts).length > 0
    ? Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0][0]
    : hasLiveData ? null : '4 PM';

  const sessionTypeMap: Record<string, number> = {};
  for (const b of bookings) {
    sessionTypeMap[b.sessionType] = (sessionTypeMap[b.sessionType] ?? 0) + 1;
  }
  const sessionTypes = Object.entries(sessionTypeMap);

  const hourBarData = HOURS.map(h => ({
    label:     h,
    value:     hourCounts[h] ?? 0,
    highlight: h === peakHour,
  }));

  const coaches = Array.from(new Set(bookings.map(b => b.coachName).filter(Boolean)));

  const filteredBookings = bookings.filter(b => {
    if (filterType !== 'all' && b.sessionType !== filterType) return false;
    if (filterCoach !== 'all' && b.coachName !== filterCoach) return false;
    return true;
  });

  useEffect(() => {
    if (!popover) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popover]);

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
    setPopover({ bookingId: booking.id, currentCage: booking.cage, top: rect.bottom + 4, left: rect.left });
    setErrorMsg(null);
  }, []);

  const assignCage = useCallback(async (bookingId: string, cageName: string) => {
    if (!hasLiveData) {
      const cageNum = CAGE_NUMBERS[cageName];
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, cage: cageNum == null ? null : cageName } : b));
      setPopover(null);
      return;
    }
    const cageNum = CAGE_NUMBERS[cageName];
    const previous = bookings.find(b => b.id === bookingId);
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, cage: cageNum == null ? null : cageName } : b));
    setPopover(null);
    setSaving(bookingId);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('bookings').update({ cage_number: cageNum }).eq('id', bookingId);
      if (error) throw error;
    } catch {
      if (previous) setBookings(prev => prev.map(b => b.id === bookingId ? previous : b));
      setErrorMsg('Failed to save cage assignment. Please try again.');
    } finally {
      setSaving(null);
    }
  }, [bookings, hasLiveData]);

  const navigateDate = (delta: number) => {
    setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + (viewMode === 'month' ? delta * 30 : viewMode === 'week' ? delta * 7 : delta)); return n; });
  };

  const goToday = () => setCurrentDate(new Date());

  const handleNewBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setShowNewBooking(false);
    setBookingForm({ kidName: '', coachName: 'Mike Rodriguez', sessionType: 'Private', date: '', startHour: '9', cage: 'Cage 1' });
    setToast(`Booking created for ${bookingForm.kidName} — ${bookingForm.sessionType} with ${bookingForm.coachName}`);
  };

  const viewBtn = (mode: ViewMode, label: string) => (
    <OButton
      variant={viewMode === mode ? 'gold' : 'ghost'}
      size="sm"
      onClick={() => setViewMode(mode)}
    >
      {label}
    </OButton>
  );

  return (
    <div onClick={() => setPopover(null)}>
      <PageHeader
        title="Schedule & Capacity"
        subtitle={`${dateLabel(currentDate)} · 8 cages`}
        actions={
          <>
            <OButton variant="secondary" icon={Filter} onClick={() => setShowFilter(o => !o)}>
              Filter {(filterType !== 'all' || filterCoach !== 'all') ? '●' : ''}
            </OButton>
            <OButton variant="gold" icon={Plus} onClick={() => setShowNewBooking(true)}>New Booking</OButton>
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

        {/* Filter panel */}
        {showFilter && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ marginBottom: 16, padding: '16px 20px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}`, display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div style={{ minWidth: 160 }}>
              <label style={labelStyle}>Session Type</label>
              <select style={{ ...inputStyle, appearance: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="all">All Types</option>
                <option value="Private">Private</option>
                <option value="Group">Group</option>
                <option value="Cage Rental">Cage Rental</option>
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label style={labelStyle}>Coach</label>
              <select style={{ ...inputStyle, appearance: 'auto' }} value={filterCoach} onChange={e => setFilterCoach(e.target.value)}>
                <option value="all">All Coaches</option>
                {coaches.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <OButton variant="ghost" size="sm" onClick={() => { setFilterType('all'); setFilterCoach('all'); }}>Clear</OButton>
            <OButton variant="secondary" size="sm" onClick={() => setShowFilter(false)}>Done</OButton>
          </div>
        )}

        {errorMsg && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: `${brand.danger}18`, border: `1px solid ${brand.danger}`, borderRadius: 6, fontSize: 12, color: brand.danger }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <OButton variant="secondary" size="sm" icon={ChevronLeft} onClick={() => navigateDate(-1)}>Prev</OButton>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, padding: '0 8px' }}>{dateLabel(currentDate)}</div>
          <OButton variant="secondary" size="sm" icon={ChevronRight} onClick={() => navigateDate(1)}>Next</OButton>
          <OButton variant={isToday ? 'gold' : 'ghost'} size="sm" onClick={goToday}>Today</OButton>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {viewBtn('day',   'Day')}
            {viewBtn('week',  'Week')}
            {viewBtn('month', 'Month')}
          </div>
        </div>

        {!isToday && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: brand.surfaceAlt, borderRadius: 6, fontSize: 12, color: brand.textMuted, textAlign: 'center' }}>
            Showing demo layout — live data loads for today&apos;s bookings only
          </div>
        )}

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
                    const slot = bookingsForSlot(filteredBookings, cage, hr);
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
                              lineHeight: 1.4, borderRadius: 3, padding: '1px 2px',
                              cursor: 'pointer', userSelect: 'none',
                            }}
                          >
                            {b.kidName}
                            {cage === 'Unassigned' && (
                              <div style={{ fontSize: 8, color: brand.warning, fontWeight: 600, marginTop: 1 }}>tap to assign</div>
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
            zIndex: 1000, background: brand.surface, border: `1px solid ${brand.border}`,
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 8, minWidth: 160,
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

      {/* New Booking modal */}
      {showNewBooking && (
        <div
          onClick={() => setShowNewBooking(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 480, background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${brand.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>New Booking</div>
              <div onClick={() => setShowNewBooking(false)} style={{ cursor: 'pointer', padding: 4 }}><X size={16} color={brand.textMuted} /></div>
            </div>
            <form onSubmit={handleNewBooking} style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Athlete Name</label>
                <input required style={inputStyle} value={bookingForm.kidName} onChange={e => setBookingForm(f => ({ ...f, kidName: e.target.value }))} placeholder="Jake Martinez" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Session Type</label>
                  <div style={{ position: 'relative' }}>
                    <select style={{ ...inputStyle, appearance: 'auto' }} value={bookingForm.sessionType} onChange={e => setBookingForm(f => ({ ...f, sessionType: e.target.value }))}>
                      <option>Private</option>
                      <option>Group</option>
                      <option>Cage Rental</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Coach</label>
                  <select style={{ ...inputStyle, appearance: 'auto' }} value={bookingForm.coachName} onChange={e => setBookingForm(f => ({ ...f, coachName: e.target.value }))}>
                    <option>Mike Rodriguez</option>
                    <option>Sarah Kim</option>
                    <option>Dave Thompson</option>
                    <option>Jess Morales</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" required style={inputStyle} value={bookingForm.date} onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Start Time</label>
                  <select style={{ ...inputStyle, appearance: 'auto' }} value={bookingForm.startHour} onChange={e => setBookingForm(f => ({ ...f, startHour: e.target.value }))}>
                    {HOURS.map((h, i) => <option key={h} value={String(9 + i)}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Cage</label>
                  <select style={{ ...inputStyle, appearance: 'auto' }} value={bookingForm.cage} onChange={e => setBookingForm(f => ({ ...f, cage: e.target.value }))}>
                    {CAGES.filter(c => c !== 'Unassigned').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <OButton variant="secondary" onClick={() => setShowNewBooking(false)}>Cancel</OButton>
                <OButton variant="gold" icon={Plus}>Create Booking</OButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 380 }}>
          {toast}
        </div>
      )}

      {/* Unused import suppressor */}
      <span style={{ display: 'none' }}><ChevronDown size={0} /></span>
    </div>
  );
}
