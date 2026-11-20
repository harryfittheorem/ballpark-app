'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, Chip } from '@/components/owner/ui';
import { Calendar, DollarSign, Users, Clock, ChevronRight } from 'lucide-react';
import { PlayerLink } from '@/components/owner/PlayerLink';
import type { TodayAtAGlanceData, TodayBooking, UpcomingBooking } from '@/lib/supabase/ownerQueries';

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

// ── Main component ────────────────────────────────────────────────────────────

type Props = { data: TodayAtAGlanceData; tenantName: string };

export function TodayDashboardContent({ data, tenantName }: Props) {
  const router = useRouter();
  const { stats, todayBookings, upcomingBookings } = data;

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

          {/* ── Right: Upcoming 48h ─────────────────────────────────────── */}
          <div>
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
