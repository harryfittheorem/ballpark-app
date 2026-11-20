'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, OCard, BarChart, DonutChart } from '@/components/owner/ui';
import { Calendar, Activity, TrendingUp, Clock, Filter, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { OwnerScheduleData, ScheduleBooking } from '@/lib/supabase/ownerQueries';
import { fetchScheduleRange, assignCageAction, getSchedulingOptions } from './actions';
import { NewBookingForm } from './NewBookingForm';
import { CapacitySettings } from './CapacitySettings';
import { CapacityOverrides } from './CapacityOverrides';
import { ResourceSettings } from './ResourceSettings';

// ── Constants ─────────────────────────────────────────────────────────────────

const HOURS = ['9 AM','10 AM','11 AM','12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM'];
const DAY_NAMES        = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MONTH_NAMES      = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_NAMES_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAY_LABELS  = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

// ── Pure helpers ──────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekStart(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  const dow = n.getDay();
  n.setDate(n.getDate() + (dow === 0 ? -6 : 1 - dow));
  return n;
}

function getWeekDays(d: Date): Date[] {
  const start = getWeekStart(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function getMonthGrid(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const dow = first.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  const start = new Date(first);
  start.setDate(1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function navLabel(d: Date, mode: ViewMode): string {
  if (mode === 'day') {
    return `${DAY_NAMES[d.getDay()]} · ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  if (mode === 'week') {
    const days = getWeekDays(d);
    const s = days[0]; const e = days[6];
    if (s.getFullYear() !== e.getFullYear())
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
    if (s.getMonth() === e.getMonth())
      return `${MONTH_NAMES_LONG[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${MONTH_NAMES_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function localHourLabel(iso: string): string {
  const h = new Date(iso).getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hr12} ${ampm}`;
}

function cageLabel(cage: string | null): string { return cage ?? 'Unassigned'; }

function slotsForDayHourCage(bookings: ScheduleBooking[], cage: string, hour: string): ScheduleBooking[] {
  return bookings.filter(b => {
    const lbl = localHourLabel(b.scheduledStart);
    return cage === 'Unassigned'
      ? lbl === hour && b.cage === null
      : lbl === hour && b.cage === cage;
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'day' | 'week' | 'month';

type Popover = { bookingId: string; currentCage: string | null; top: number; left: number };

type Props = { data: OwnerScheduleData; tenantId: string; basePath?: string };

// ── Style constants ───────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export function ScheduleContent({ data, tenantId, basePath = '/owner/schedule' }: Props) {
  const todayDate   = useMemo(() => new Date(), []);

  const [bookings,       setBookings]      = useState<ScheduleBooking[]>(data.bookings);
  const [waitlistByHour, setWaitlistByHour] = useState<Map<string, number>>(new Map());
  const [loading,        setLoading]       = useState(false);
  const [popover,        setPopover]       = useState<Popover | null>(null);
  const [saving,         setSaving]        = useState<string | null>(null);
  const [cancelling,     setCancelling]    = useState<string | null>(null);
  const [errorMsg,       setErrorMsg]      = useState<string | null>(null);
  const [viewMode,       setViewMode]      = useState<ViewMode>('day');
  const [currentDate,    setCurrentDate]   = useState<Date>(() => new Date());
  const [showFilter,     setShowFilter]    = useState(false);
  const [filterType,     setFilterType]    = useState<string>('all');
  const [filterCoach,    setFilterCoach]   = useState<string>('all');
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showCapacity, setShowCapacity] = useState(false);
  const [showCapacityOverrides, setShowCapacityOverrides] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [toast,          setToast]         = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [resources, setResources] = useState<{ location_id: string; cage_number: string; purpose: string }[]>([]);
  const [canSchedule, setCanSchedule] = useState(false);
  const [canSetCapacity, setCanSetCapacity] = useState(false);
  const CAGES = useMemo(() => [...new Set([...resources.map(r => `Cage ${r.cage_number}`), ...bookings.map(b => b.cage).filter((c): c is string => !!c)])].sort().concat('Unassigned'), [resources, bookings]);

  useEffect(() => {
    let active = true;
    getSchedulingOptions().then(result => {
      if (active) { setResources(result.resources); setCanSchedule(result.canConfigureOverrides); setCanSetCapacity(result.canConfigureCapacity); }
    }).catch(error => { if (active) setErrorMsg(error instanceof Error ? error.message : 'Resources unavailable.'); });
    return () => { active = false; };
  }, [revision, tenantId]);

  const popoverRef     = useRef<HTMLDivElement>(null);
  const dateInputRef   = useRef<HTMLInputElement>(null);

  // ── Sync initial server data ─────────────────────────────────────────────
  useEffect(() => {
    setBookings(data.bookings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.bookings]);

  // ── Live reload when date / view changes ─────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;

    let cancelled = false;

    let rangeStart: Date, rangeEnd: Date;
    if (viewMode === 'month') {
      rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
      rangeEnd   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (viewMode === 'week') {
      rangeStart = getWeekStart(currentDate);
      rangeEnd   = new Date(rangeStart.getTime() + 7 * 86_400_000 - 1);
    } else {
      rangeStart = new Date(currentDate); rangeStart.setHours(0, 0, 0, 0);
      rangeEnd   = new Date(currentDate); rangeEnd.setHours(23, 59, 59, 999);
    }

    setLoading(true);
    (async () => {
      try {
        const result = await fetchScheduleRange(
          rangeStart.toISOString(),
          rangeEnd.toISOString(),
        );
        if (cancelled) return;
        setBookings(result.bookings);
        setWaitlistByHour(new Map(Object.entries(result.waitlistByHour)));
      } catch (err) {
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : 'Schedule unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId, currentDate, viewMode, revision]);

  useEffect(() => {
    const refresh = () => setRevision(n => n + 1);
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, []);

  // ── Toast auto-clear ─────────────────────────────────────────────────────
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const isToday = isSameDay(currentDate, todayDate);

  // Bookings for the currently viewed day (or all loaded bookings in week/month mode)
  const currentViewBookings = useMemo(
    () => viewMode === 'day'
      ? bookings.filter(b => isSameDay(new Date(b.scheduledStart), currentDate))
      : bookings,
    [bookings, currentDate, viewMode],
  );

  const totalToday   = currentViewBookings.length;

  const hourCounts: Record<string, number> = {};
  const hourSource = currentViewBookings;
  for (const b of hourSource) {
    const lbl = localHourLabel(b.scheduledStart);
    hourCounts[lbl] = (hourCounts[lbl] ?? 0) + 1;
  }
  const peakHour = Object.keys(hourCounts).length > 0
    ? Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0][0]
    : null;

  const hourBarData = HOURS.map(h => ({ label: h, value: hourCounts[h] ?? 0, highlight: h === peakHour }));

  const coaches = useMemo(
    () => Array.from(new Set(bookings.map(b => b.coachName).filter(Boolean))),
    [bookings],
  );

  const weekDays  = useMemo(() => getWeekDays(currentDate),  [currentDate]);
  const monthGrid = useMemo(() => getMonthGrid(currentDate), [currentDate]);

  const viewBookings = viewMode === 'day'
    ? bookings.filter(b => isSameDay(new Date(b.scheduledStart), currentDate))
    : bookings;

  const filteredViewBookings = useMemo(() => viewBookings.filter(b => {
    if (filterType  !== 'all' && b.sessionType !== filterType)  return false;
    if (filterCoach !== 'all' && b.coachName   !== filterCoach) return false;
    return true;
  }), [viewBookings, filterType, filterCoach]);

  const sessionTypeMap: Record<string, number> = {};
  for (const b of filteredViewBookings) {
    sessionTypeMap[b.sessionType] = (sessionTypeMap[b.sessionType] ?? 0) + 1;
  }
  const sessionTypes = Object.entries(sessionTypeMap);

  // ── Popover ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopover(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [popover]);

  const openPopover = useCallback((booking: ScheduleBooking, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (booking.isCampBooking) {
      setErrorMsg('Camp roster dates and resources use the camp workflow. Record daily attendance in Check-In; cancellation and refund policies remain gated.');
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      bookingId: booking.id,
      currentCage: booking.cage,
      top: rect.bottom + 4,
      left: rect.left,
    });
    setErrorMsg(null);
  }, []);

  const cancelBookingOverride = useCallback(async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!confirm(booking?.seriesId
      ? 'Cancel only this occurrence? Other bookings in the series will not change. This uses the existing staff cancellation override.'
      : 'Cancel this booking immediately? This bypasses the cancellation policy.')) return;
    setPopover(null);
    setCancelling(bookingId);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, reason: 'Staff override' }),
      });
      const resData = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !resData.ok) {
        setErrorMsg(resData.error ?? `Cancel failed (${res.status})`);
        return;
      }
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
      setToast('Booking cancelled.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCancelling(null);
    }
  }, [bookings]);

  const assignCage = useCallback(async (bookingId: string, cageName: string) => {
    const cageNum = cageName === 'Unassigned' ? null : cageName.replace(/^Cage /, '');
    const previous = bookings.find(b => b.id === bookingId);
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, cage: cageNum == null ? null : cageName } : b));
    setPopover(null);
    setSaving(bookingId);
    setErrorMsg(null);
    try {
      const result = await assignCageAction(bookingId, cageNum ?? null);
      if (result.error) throw new Error(result.error);
    } catch (error) {
      if (previous) setBookings(prev => prev.map(b => b.id === bookingId ? previous : b));
      setErrorMsg(error instanceof Error ? error.message : 'Failed to save cage assignment.');
    } finally {
      setSaving(null);
    }
  }, [bookings, tenantId]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const navigateDate = (delta: number) => {
    setCurrentDate(d => {
      const n = new Date(d);
      if      (viewMode === 'month') n.setMonth(n.getMonth() + delta);
      else if (viewMode === 'week')  n.setDate(n.getDate() + delta * 7);
      else                           n.setDate(n.getDate() + delta);
      return n;
    });
  };

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try { (input as HTMLInputElement & { showPicker: () => void }).showPicker(); }
    catch { input.focus(); }
  };

  const viewBtn = (mode: ViewMode, label: string) => (
    <OButton variant={viewMode === mode ? 'gold' : 'ghost'} size="sm" onClick={() => setViewMode(mode)}>
      {label}
    </OButton>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div onClick={() => setPopover(null)}>
      <PageHeader
        title="Schedule & Capacity"
        subtitle={`${navLabel(currentDate, viewMode)} · configured resources only`}
        actions={
          <>
            <OButton variant="secondary" icon={Filter} onClick={() => setShowFilter(o => !o)}>
              Filter{(filterType !== 'all' || filterCoach !== 'all') ? ' ●' : ''}
            </OButton>
            {canSetCapacity && <OButton variant="secondary" onClick={() => setShowCapacity(true)}>Location capacity</OButton>}
            {canSchedule && <OButton variant="secondary" onClick={() => setShowCapacityOverrides(true)}>Dated capacity</OButton>}
            {canSchedule && <OButton variant="gold" icon={Plus} onClick={() => setShowNewBooking(true)}>New Booking</OButton>}
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <OButton variant="secondary" onClick={() => setShowResources(true)}>Location cages</OButton>
          <a href={`${basePath}/camps`} style={{ color: brand.goldDeep, alignSelf: 'center' }}>Camps & clinics</a>
        </div>

        {/* ── KPI row ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label={isToday ? "Today's Sessions" : `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()} Sessions`} value={totalToday} deltaLabel="booked" icon={Calendar} color="gold" />
          <KPICard label="Occupancy" value="—" deltaLabel="varies by location and time" icon={Activity} color="success" />
          <KPICard label="Peak Hour"  value={peakHour ?? '—'} deltaLabel="busiest slot" icon={TrendingUp} color="warning" />
          <KPICard label="Open Slots" value="—" deltaLabel="varies by location and time" icon={Clock} />
        </div>

        {/* ── Filter panel ─────────────────────────────────────────────── */}
        {showFilter && (
          <div onClick={e => e.stopPropagation()} style={{ marginBottom: 16, padding: '16px 20px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}`, display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
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

        {/* ── Navigation bar ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <OButton variant="secondary" size="sm" icon={ChevronLeft} onClick={() => navigateDate(-1)}>Prev</OButton>

          {/* Clickable date with hidden native date-picker */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={openDatePicker}
              title="Click to jump to a date"
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = brand.border; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
              style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, padding: '5px 10px', background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', color: brand.text, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {navLabel(currentDate, viewMode)}
              <Calendar size={13} color={brand.textMuted} />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={toInputDate(currentDate)}
              onChange={e => {
                if (!e.target.value) return;
                const [y, m, d] = e.target.value.split('-').map(Number);
                setCurrentDate(new Date(y, m - 1, d));
              }}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, padding: 0, border: 0 }}
            />
          </div>

          <OButton variant="secondary" size="sm" icon={ChevronRight} onClick={() => navigateDate(1)}>Next</OButton>
          <OButton variant={isToday ? 'gold' : 'ghost'} size="sm" onClick={() => setCurrentDate(new Date())}>Today</OButton>
          <div style={{ flex: 1 }} />
          {loading && <span style={{ fontSize: 11, color: brand.textMuted, fontStyle: 'italic' }}>Loading…</span>}
          <div style={{ display: 'flex', gap: 6 }}>
            {viewBtn('day',   'Day')}
            {viewBtn('week',  'Week')}
            {viewBtn('month', 'Month')}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DAY VIEW — cage × hour grid
        ═══════════════════════════════════════════════════════════════ */}
        {viewMode === 'day' && (
          <OCard padding={0}>
            <div style={{ overflow: 'auto' }}>
              <div style={{ minWidth: 900, padding: 16 }}>
                {/* Cage column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${CAGES.length}, minmax(80px, 1fr))`, gap: 4, marginBottom: 8 }}>
                  <div />
                  {CAGES.map(c => (
                    <div key={c} style={{ fontSize: 10, fontWeight: 700, color: c === 'Unassigned' ? brand.warning : brand.textMuted, textAlign: 'center', letterSpacing: 0.5, padding: '6px 0', background: brand.surfaceAlt, borderRadius: 4, fontStyle: c === 'Unassigned' ? 'italic' : 'normal' }}>
                      {c.toUpperCase()}
                    </div>
                  ))}
                </div>
                {/* Hour rows */}
                {HOURS.map((hr, hi) => (
                  <div key={hi} style={{ display: 'grid', gridTemplateColumns: `60px repeat(${CAGES.length}, minmax(80px, 1fr))`, gap: 4, marginBottom: 4, minHeight: 48 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, padding: '14px 0', textAlign: 'right', paddingRight: 8 }}>
                      {hr}
                      {waitlistByHour.get(hr) ? (
                        <div style={{ marginTop: 2, fontSize: 8, fontWeight: 800, color: '#f59e0b', letterSpacing: 0, whiteSpace: 'nowrap' }}>
                          +{waitlistByHour.get(hr)} waitlist
                        </div>
                      ) : null}
                    </div>
                    {CAGES.map((cage, ci) => {
                      const slot = slotsForDayHourCage(filteredViewBookings, cage, hr);
                      const statusColor = slot[0] ? (STATUS_COLOR[slot[0].status] ?? brand.info) : null;
                      return (
                        <div key={ci} style={{ background: statusColor ? `${statusColor}22` : brand.creamLight, borderRadius: 6, padding: 6, border: `1px solid ${statusColor ?? brand.border}`, minHeight: 42 }}>
                          {slot.map((b, si) => (
                            <div
                              key={si}
                              onClick={e => openPopover(b, e)}
                              title={`${b.kidName} · ${b.sessionType}${b.coachName ? ` · ${b.coachName}` : ''}${b.occurrenceNumber ? ` · Recurring occurrence ${b.occurrenceNumber}` : ''}\nClick to assign cage to this booking only`}
                              style={{ fontSize: 9, fontWeight: 700, color: saving === b.id ? brand.textMuted : (STATUS_COLOR[b.status] ?? brand.info), lineHeight: 1.4, borderRadius: 3, padding: '1px 2px', cursor: 'pointer', userSelect: 'none' }}
                            >
                              {b.kidName}
                              {cage === 'Unassigned' && <div style={{ fontSize: 8, color: brand.warning, fontWeight: 600, marginTop: 1 }}>tap to assign</div>}
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
        )}

        {/* ═══════════════════════════════════════════════════════════════
            WEEK VIEW — day × hour grid (Mon–Sun)
        ═══════════════════════════════════════════════════════════════ */}
        {viewMode === 'week' && (
          <OCard padding={0}>
            <div style={{ overflow: 'auto' }}>
              <div style={{ minWidth: 720, padding: 16 }}>
                {/* Day column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
                  <div />
                  {weekDays.map((day, i) => {
                    const isDayToday = isSameDay(day, todayDate);
                    return (
                      <div
                        key={i}
                        onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                        title="Click to open day view"
                        style={{ textAlign: 'center', padding: '8px 4px', background: isDayToday ? `${brand.goldDeep}22` : brand.surfaceAlt, border: `1px solid ${isDayToday ? brand.goldDeep : 'transparent'}`, borderRadius: 6, cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5 }}>{WEEK_DAY_LABELS[i]}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: isDayToday ? brand.goldDeep : brand.text, marginTop: 2 }}>{day.getDate()}</div>
                        <div style={{ fontSize: 9, color: brand.textMuted }}>{MONTH_NAMES[day.getMonth()]}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Hour rows */}
                {HOURS.map((hr, hi) => (
                  <div key={hi} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: 4, marginBottom: 4, minHeight: 44 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, padding: '12px 0', textAlign: 'right', paddingRight: 8 }}>{hr}</div>
                    {weekDays.map((day, di) => {
                      const slot = filteredViewBookings.filter(b =>
                        isSameDay(new Date(b.scheduledStart), day) && localHourLabel(b.scheduledStart) === hr,
                      );
                      const statusColor = slot[0] ? (STATUS_COLOR[slot[0].status] ?? brand.info) : null;
                      return (
                        <div
                          key={di}
                          onClick={() => slot.length > 0 && (() => { setCurrentDate(day); setViewMode('day'); })()}
                          style={{ background: statusColor ? `${statusColor}22` : brand.creamLight, borderRadius: 6, padding: '4px 6px', border: `1px solid ${statusColor ?? brand.border}`, minHeight: 40, cursor: slot.length > 0 ? 'pointer' : 'default' }}
                        >
                          {slot.map((b, si) => (
                            <div key={si} style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[b.status] ?? brand.info, lineHeight: 1.4, padding: '1px 2px', userSelect: 'none' }}>
                              {b.kidName}
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
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MONTH VIEW — calendar grid with booking counts
        ═══════════════════════════════════════════════════════════════ */}
        {viewMode === 'month' && (
          <OCard padding={0}>
            <div style={{ padding: 16 }}>
              {/* Day-of-week headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
                {WEEK_DAY_LABELS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, padding: '6px 0' }}>{d}</div>
                ))}
              </div>
              {/* 6 × 7 calendar cells */}
              {Array.from({ length: 6 }, (_, row) => (
                <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                  {monthGrid.slice(row * 7, row * 7 + 7).map((day, col) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const isDayToday     = isSameDay(day, todayDate);
                    const dayCount       = filteredViewBookings.filter(b => isSameDay(new Date(b.scheduledStart), day)).length;
                    return (
                      <div
                        key={col}
                        onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.filter = 'brightness(0.95)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = 'none'; }}
                        style={{ minHeight: 68, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: isDayToday ? `${brand.goldDeep}18` : (isCurrentMonth ? brand.creamLight : brand.surfaceAlt), border: `1px solid ${isDayToday ? brand.goldDeep : brand.border}`, opacity: isCurrentMonth ? 1 : 0.45, transition: 'opacity 0.1s' }}
                      >
                        <div style={{ fontSize: 12, fontWeight: isDayToday ? 700 : 400, color: isDayToday ? brand.goldDeep : brand.text, marginBottom: 4 }}>
                          {day.getDate()}
                        </div>
                        {dayCount > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: brand.success, background: `${brand.success}22`, borderRadius: 4, padding: '2px 6px' }}>
                            {dayCount}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </OCard>
        )}

        {/* ── Charts ───────────────────────────────────────────────────── */}
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
                <DonutChart data={sessionTypes.map(([, v], i) => ({ value: v, color: [brand.goldDeep, brand.info, brand.success, brand.warning][i % 4] }))} size={140} />
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

      {/* ── Cage assignment + actions popover ───────────────────────────── */}
      {popover && (
        <div
          ref={popoverRef}
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: Math.min(popover.top, window.innerHeight - 320), left: Math.min(popover.left, window.innerWidth - 180), zIndex: 1000, background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 8, minWidth: 160 }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: `1px solid ${brand.border}`, marginBottom: 4 }}>
            Assign Cage
          </div>
          {!canSchedule && <p style={{ padding: 8, fontSize: 12 }}>Only owners and location admins can reassign cages.</p>}
          {canSchedule && CAGES.map(cage => {
            const isCurrent = cageLabel(popover.currentCage) === cage;
            return (
              <button
                key={cage}
                type="button"
                onClick={() => assignCage(popover.bookingId, cage)}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${brand.goldDeep}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isCurrent ? `${brand.goldDeep}22` : 'transparent'; }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: isCurrent ? 700 : 400, background: isCurrent ? `${brand.goldDeep}22` : 'transparent', color: cage === 'Unassigned' ? brand.warning : (isCurrent ? brand.goldDeep : brand.text), fontStyle: cage === 'Unassigned' ? 'italic' : 'normal' }}
              >
                {isCurrent ? `✓ ${cage}` : cage}
              </button>
            );
          })}

          {/* Staff actions */}
          <div style={{ borderTop: `1px solid ${brand.border}`, marginTop: 6, paddingTop: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 8px 5px' }}>
              Actions
            </div>
            <button
              type="button"
              disabled={cancelling === popover.bookingId}
              onClick={() => void cancelBookingOverride(popover.bookingId)}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${brand.danger}18`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderRadius: 5, cursor: cancelling === popover.bookingId ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, background: 'transparent', color: brand.danger, opacity: cancelling === popover.bookingId ? 0.6 : 1 }}
            >
              {cancelling === popover.bookingId ? 'Cancelling…' : 'Cancel (Staff Override)'}
            </button>
          </div>
        </div>
      )}

      {/* ── New Booking modal ────────────────────────────────────────────── */}
      {showResources && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="dialog" aria-modal="true" aria-label="Location cages" style={{ background: 'white', borderRadius: 12, width: 'min(640px,95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <ResourceSettings onClose={() => setShowResources(false)} onChanged={() => setRevision(n => n + 1)} />
          </div>
        </div>
      )}
      {showCapacityOverrides && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="dialog" aria-modal="true" aria-label="Dated capacity override" style={{ background: 'white', borderRadius: 12, width: 'min(640px,95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <CapacityOverrides onClose={() => setShowCapacityOverrides(false)} onChanged={() => setRevision(n => n + 1)} />
          </div>
        </div>
      )}
      {showCapacity && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="dialog" aria-modal="true" aria-label="Location capacity" style={{ background: 'white', borderRadius: 12, width: 'min(520px,95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <CapacitySettings onClose={() => setShowCapacity(false)} onSaved={() => {
              setShowCapacity(false); setRevision(n => n + 1); setToast('Location capacity saved.');
            }} />
          </div>
        </div>
      )}
      {showNewBooking && (
        <div onClick={() => setShowNewBooking(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 480, background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${brand.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>New Booking</div>
              <button type="button" onClick={() => setShowNewBooking(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={16} color={brand.textMuted} /></button>
            </div>
            <NewBookingForm onClose={() => setShowNewBooking(false)} onSaved={(date, count = 1) => {
              setCurrentDate(date); setViewMode('day'); setRevision(n => n + 1);
              setShowNewBooking(false); setToast(count > 1 ? `${count} recurring bookings saved.` : 'Booking saved.');
            }} />
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 380 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
