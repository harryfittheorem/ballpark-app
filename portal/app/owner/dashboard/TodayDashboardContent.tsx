'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, Chip } from '@/components/owner/ui';
import { Calendar, DollarSign, Users, Clock, ChevronRight, CheckSquare, Square, ClipboardList, AlertTriangle, Info, XCircle } from 'lucide-react';
import { PlayerLink } from '@/components/owner/PlayerLink';
import type { TodayAtAGlanceData, TodayBooking, UpcomingBooking, OwnerNotification } from '@/lib/supabase/ownerQueries';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m > 0 ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

function hourLabel(iso: string): string {
  const h = new Date(iso).getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12} ${ampm}`;
}

function groupByHour(bookings: TodayBooking[]): Array<{ hour: string; items: TodayBooking[] }> {
  const map = new Map<string, TodayBooking[]>();
  for (const b of bookings) {
    const key = hourLabel(b.scheduledStart);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  return Array.from(map.entries()).map(([hour, items]) => ({ hour, items }));
}

type StatusInfo = { label: string; chipColor: 'success' | 'gold' | 'warning' | 'danger' | 'default' };

function statusInfo(status: string): StatusInfo {
  switch (status) {
    case 'completed':  return { label: 'Completed',  chipColor: 'success' };
    case 'confirmed':  return { label: 'Upcoming',   chipColor: 'gold'    };
    case 'pending':    return { label: 'Pending',    chipColor: 'warning' };
    case 'cancelled':  return { label: 'Cancelled',  chipColor: 'danger'  };
    case 'no_show':    return { label: 'No Show',    chipColor: 'danger'  };
    default:           return { label: status,       chipColor: 'default' };
  }
}

const SESSION_TYPE_COLORS: Record<string, string> = {
  'Private':     brand.goldDeep,
  'Group':       brand.info,
  'Cage Rental': brand.textMuted,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function BookingRow({ b }: { b: TodayBooking }) {
  const si = statusInfo(b.status);
  const typeColor = SESSION_TYPE_COLORS[b.sessionType] ?? brand.textMuted;
  const isCancelled = b.status === 'cancelled' || b.status === 'no_show';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 0',
      borderBottom: `1px solid ${brand.border}`,
      opacity: isCancelled ? 0.55 : 1,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${typeColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: typeColor, fontFamily: fonts.display, letterSpacing: 0.5 }}>
          {b.sessionType === 'Private' ? 'PRV' : b.sessionType === 'Group' ? 'GRP' : 'CGE'}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: brand.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textDecoration: isCancelled ? 'line-through' : 'none',
        }}>
          <PlayerLink name={b.kidName} reference={b} />
        </div>
        <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 1 }}>
          {b.coachName}{b.cage ? ` · ${b.cage}` : ''}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <Chip color={si.chipColor} size="sm">{si.label}</Chip>
      </div>
    </div>
  );
}

function UpcomingRow({ b }: { b: UpcomingBooking }) {
  const si = statusInfo(b.status);
  const typeColor = SESSION_TYPE_COLORS[b.sessionType] ?? brand.textMuted;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: `1px solid ${brand.border}`,
    }}>
      <div style={{ width: 4, height: 32, borderRadius: 2, background: typeColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: brand.text }}><PlayerLink name={b.kidName} reference={b} /></div>
        <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 1 }}>
          {b.sessionType} · {b.coachName}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 600, marginBottom: 3 }}>
          {formatTime(b.scheduledStart)}
        </div>
        <Chip color={si.chipColor} size="sm">{si.label}</Chip>
      </div>
    </div>
  );
}

// ── Notification Banners ──────────────────────────────────────────────────────

function NotificationBanners({ notifications }: { notifications: OwnerNotification[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  if (notifications.length === 0) return null;
  const visible = notifications.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
      {visible.map(n => {
        const isWarning = n.severity === 'warning';
        const isCritical = n.severity === 'critical';
        const borderColor = isCritical ? brand.danger : isWarning ? brand.warning : brand.info;
        const bg = isCritical ? `${brand.danger}11` : isWarning ? `${brand.warning}11` : `${brand.info}11`;
        const Icon = isCritical || isWarning ? AlertTriangle : Info;
        const iconColor = isCritical ? brand.danger : isWarning ? brand.warning : brand.info;

        return (
          <div key={n.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '12px 16px', borderRadius: 10,
            border: `1px solid ${borderColor}44`,
            borderLeft: `4px solid ${borderColor}`,
            background: bg,
          }}>
            <Icon size={16} color={iconColor} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: brand.text, marginBottom: 2 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.5 }}>{n.body}</div>
              {n.ctaLabel && n.ctaHref && (
                <a href={n.ctaHref} style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700, color: iconColor, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  {n.ctaLabel} →
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDismissed(prev => new Set([...prev, n.id]))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
              title="Dismiss"
            >
              <XCircle size={15} color={brand.textMuted} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── GM Daily Checklist ────────────────────────────────────────────────────────

const BASE_CHECKLIST_ITEMS = [
  { key: 'review_schedule',    label: 'Review today\'s full schedule',      note: 'Confirm all sessions are staffed and cages are assigned' },
  { key: 'check_payments',     label: 'Check for failed payments',           note: 'Follow up with members on billing errors' },
  { key: 'review_at_risk',     label: 'Review at-risk members',              note: 'Reach out to anyone 14+ days without a session' },
  { key: 'send_reeval',        label: 'Send re-evaluation reminders',        note: '' },
  { key: 'google_reviews',     label: 'Respond to / request Google reviews', note: 'Reply to new reviews; ask recent completions to leave one' },
  { key: 'coach_checkin',      label: 'Coach check-in complete',             note: 'Confirm all coaches have reviewed their schedules' },
  { key: 'bank_deposit',       label: 'Verify EFT / bank deposits settled',  note: 'Confirm payment batch settled overnight' },
  { key: 'cancellation_queue', label: 'Review cancellation / pause queue',   note: 'Follow up on any pending cancellation requests' },
  { key: 'anniversaries',      label: 'Member anniversaries today / this week', note: '' },
] as const;

type ChecklistKey = typeof BASE_CHECKLIST_ITEMS[number]['key'];

function todayKey() {
  const d = new Date();
  return `gm_checklist_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function GMChecklist({ preChargeReevalCount, anniversaryCount }: { preChargeReevalCount: number; anniversaryCount: number }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(todayKey());
      if (stored) setChecked(JSON.parse(stored) as Record<string, boolean>);
    } catch { /* ignore */ }
  }, []);

  function toggle(key: ChecklistKey) {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(todayKey(), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const CHECKLIST_ITEMS = BASE_CHECKLIST_ITEMS.map(item => {
    if (item.key === 'send_reeval') {
      return { ...item, note: preChargeReevalCount > 0 ? `${preChargeReevalCount} member${preChargeReevalCount !== 1 ? 's' : ''} billing in ≤10 days with no recent re-eval` : 'No members due for re-eval before next billing' };
    }
    if (item.key === 'anniversaries') {
      return { ...item, note: anniversaryCount > 0 ? `${anniversaryCount} member${anniversaryCount !== 1 ? 's have' : ' has'} an anniversary this week — send a congratulations!` : 'No anniversaries this week' };
    }
    return item;
  });
  const doneCount = CHECKLIST_ITEMS.filter(i => checked[i.key]).length;
  const total = CHECKLIST_ITEMS.length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <OCard style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <ClipboardList size={15} color={brand.goldDeep} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: brand.text, fontFamily: fonts.display, letterSpacing: 0.3 }}>
            GM Daily Checklist
          </div>
          <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 1 }}>{doneCount} of {total} complete</div>
        </div>
        {/* Progress pill */}
        <div style={{
          fontSize: 11, fontWeight: 800, fontFamily: fonts.display,
          background: pct === 100 ? `${brand.success}22` : `${brand.gold}22`,
          color: pct === 100 ? brand.success : brand.goldDeep,
          border: `1px solid ${pct === 100 ? brand.success : brand.gold}44`,
          borderRadius: 20, padding: '2px 10px',
        }}>
          {pct}%
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 3, background: brand.border }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? brand.success : brand.gold, borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
      {/* Items */}
      {CHECKLIST_ITEMS.map((item, i) => {
        const done = !!checked[item.key];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => toggle(item.key)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '11px 20px',
              background: done ? `${brand.success}09` : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              border: 'none',
              borderBottom: i < CHECKLIST_ITEMS.length - 1 ? `1px solid ${brand.border}` : 'none',
            }}
          >
            {done
              ? <CheckSquare size={16} color={brand.success} style={{ flexShrink: 0, marginTop: 1 }} />
              : <Square size={16} color={brand.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />
            }
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: done ? brand.textMuted : brand.text, textDecoration: done ? 'line-through' : 'none' }}>
                {item.label}
              </div>
              <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 1 }}>{item.note}</div>
            </div>
          </button>
        );
      })}
    </OCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { data: TodayAtAGlanceData; tenantName: string; notifications?: OwnerNotification[] };

export function TodayDashboardContent({ data, tenantName, notifications = [] }: Props) {
  const router = useRouter();
  const { stats, todayBookings, upcomingBookings, preChargeReevalCount, anniversaryCount } = data;

  const now = new Date();
  const MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  const hourGroups = groupByHour(todayBookings);

  const completedCount = todayBookings.filter(b => b.status === 'completed').length;
  const upcomingCount  = todayBookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length;

  const upcomingByDate: Array<{ dateLabel: string; items: UpcomingBooking[] }> = [];
  const dateMap = new Map<string, UpcomingBooking[]>();
  for (const b of upcomingBookings) {
    if (!dateMap.has(b.dateLabel)) dateMap.set(b.dateLabel, []);
    dateMap.get(b.dateLabel)!.push(b);
  }
  for (const [dateLabel, items] of dateMap.entries()) {
    upcomingByDate.push({ dateLabel, items });
  }

  return (
    <div>
      <PageHeader
        title="Today at a Glance"
        subtitle={`${tenantName} · ${dateStr}`}
        actions={
          <OButton variant="secondary" icon={Calendar} onClick={() => router.push('/owner/schedule')}>
            Full Schedule
          </OButton>
        }
      />

      <div style={{ padding: 24 }}>

        {/* ── Automated Notifications (A5) ──────────────────────────────── */}
        <NotificationBanners notifications={notifications} />

        {/* ── Quick Stats bar ────────────────────────────────────────────── */}
        <div className="owner-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 28 }}>
          <KPICard
            label="Today's Sessions"
            value={stats.sessionsToday}
            deltaLabel={stats.sessionsToday > 0 ? `${completedCount} done · ${upcomingCount} ahead` : 'none scheduled'}
            icon={Calendar}
            color="gold"
          />
          <KPICard
            label="Revenue Today"
            value={stats.revenueToday > 0 ? `$${stats.revenueToday.toLocaleString()}` : '$0'}
            deltaLabel="Scheduled value of confirmed and completed sessions, not collected payments"
            icon={DollarSign}
            color={stats.revenueToday > 0 ? 'success' : 'default'}
          />
          <KPICard
            label="Active Members"
            value={stats.activeMembers}
            deltaLabel="Distinct families with an active membership"
            icon={Users}
          />
        </div>

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="owner-today-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'start' }}>

          {/* ── Left: Today's Schedule ──────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Today's Schedule"
              subtitle={`${todayBookings.length} booking${todayBookings.length !== 1 ? 's' : ''} · sorted by time`}
              action={
                <OButton variant="ghost" size="sm" onClick={() => router.push('/owner/schedule')}>
                  Full View →
                </OButton>
              }
            />
            <OCard style={{ padding: 0 }}>
              {hourGroups.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <Calendar size={28} color={brand.textMuted} style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 14, color: brand.textMuted, fontWeight: 600 }}>No sessions scheduled today</div>
                  <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>Bookings will appear here once they are created.</div>
                </div>
              ) : (
                hourGroups.map((group, gi) => (
                  <div key={gi} style={{ padding: '0 20px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 0 4px',
                    }}>
                      <Clock size={13} color={brand.goldDeep} />
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: brand.goldDeep,
                        fontFamily: fonts.display,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                      }}>
                        {group.hour}
                      </span>
                      <div style={{ flex: 1, height: 1, background: brand.border }} />
                      <span style={{ fontSize: 10, color: brand.textMuted, fontWeight: 600 }}>
                        {group.items.length} session{group.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {group.items.map((b, bi) => (
                      <div key={b.id} style={bi === group.items.length - 1 && gi === hourGroups.length - 1 ? { borderBottom: 'none' } : {}}>
                        <BookingRow b={b} />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </OCard>
          </div>

          {/* ── Right: GM Checklist + Upcoming 48h ──────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionHeader title="Daily Checklist" subtitle="Resets each morning" />
            <GMChecklist preChargeReevalCount={preChargeReevalCount} anniversaryCount={anniversaryCount} />

            <SectionHeader
              title="Next 48 Hours"
              subtitle={`${upcomingBookings.length} upcoming booking${upcomingBookings.length !== 1 ? 's' : ''}`}
              action={
                upcomingBookings.length > 0
                  ? <OButton variant="ghost" size="sm" onClick={() => router.push('/owner/schedule')}>
                      <ChevronRight size={13} />
                    </OButton>
                  : undefined
              }
            />
            <OCard style={{ padding: 0 }}>
              {upcomingByDate.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: brand.textMuted, fontWeight: 600 }}>No bookings in the next 48 hours</div>
                </div>
              ) : (
                upcomingByDate.map((group, gi) => (
                  <div key={gi} style={{ padding: '0 16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 0 2px',
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: brand.info,
                        fontFamily: fonts.display,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                      }}>
                        {group.dateLabel}
                      </span>
                      <div style={{ flex: 1, height: 1, background: brand.border }} />
                    </div>
                    {group.items.map((b, bi) => (
                      <div key={b.id} style={bi === group.items.length - 1 && gi === upcomingByDate.length - 1 ? { borderBottom: 'none' } : {}}>
                        <UpcomingRow b={b} />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </OCard>
          </div>

        </div>
      </div>
    </div>
  );
}
