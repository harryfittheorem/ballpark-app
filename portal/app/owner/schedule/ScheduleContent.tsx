'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, OCard, BarChart, DonutChart } from '@/components/owner/ui';
import { Calendar, Activity, TrendingUp, Clock, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { OwnerScheduleData, ScheduleBooking } from '@/lib/supabase/ownerQueries';

const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM'];
const CAGES = ['Cage 1', 'Cage 2', 'Cage 3', 'Cage 4', 'Cage 5', 'Cage 6', 'Cage 7', 'Cage 8'];

const now = new Date();
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TODAY_LABEL = `${DAY_NAMES[now.getDay()]} · ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

type Props = { data: OwnerScheduleData };

function bookingsForSlot(bookings: ScheduleBooking[], cage: string, hour: string): ScheduleBooking[] {
  return bookings.filter(b => {
    const h = new Date(b.scheduledStart).getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const label = `${hr12} ${ampm}`;
    return label === hour && (b.cage === cage || b.cage === null);
  });
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: brand.success,
  pending: brand.warning,
  completed: brand.info,
  cancelled: brand.danger,
};

export function ScheduleContent({ data }: Props) {
  const { bookings, totalToday, occupancyPct, peakHour, openSlots } = data;

  const sessionTypeMap: Record<string, number> = {};
  for (const b of bookings) {
    sessionTypeMap[b.sessionType] = (sessionTypeMap[b.sessionType] ?? 0) + 1;
  }
  const sessionTypes = Object.entries(sessionTypeMap);

  const hourBarData = HOURS.map(h => ({
    label: h,
    value: bookings.filter(b => b.hourLabel === h).length,
    highlight: h === peakHour,
  }));

  return (
    <div>
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
          <KPICard label="Today's Sessions" value={totalToday} deltaLabel="booked" icon={Calendar} color="gold" />
          <KPICard label="Today's Occupancy" value={`${occupancyPct}%`} icon={Activity} color={occupancyPct > 50 ? 'success' : 'warning'} />
          <KPICard label="Peak Hour" value={peakHour ?? '—'} deltaLabel={peakHour ? 'busiest slot' : 'no data yet'} icon={TrendingUp} color="warning" />
          <KPICard label="Open Slots" value={openSlots} deltaLabel="today" icon={Clock} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <OButton variant="secondary" size="sm" icon={ChevronLeft}>Prev</OButton>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, padding: '0 8px' }}>{TODAY_LABEL}</div>
          <OButton variant="secondary" size="sm" icon={ChevronRight}>Next</OButton>
          <OButton variant="ghost" size="sm">Today</OButton>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <OButton variant="gold" size="sm">Day</OButton>
            <OButton variant="ghost" size="sm">Week</OButton>
            <OButton variant="ghost" size="sm">Month</OButton>
          </div>
        </div>

        <OCard padding={0}>
          <div style={{ overflow: 'auto' }}>
            <div style={{ minWidth: 900, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, 1fr)', gap: 4, marginBottom: 8 }}>
                <div />
                {CAGES.map(c => (
                  <div key={c} style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, textAlign: 'center', letterSpacing: 0.5, padding: '6px 0', background: brand.surfaceAlt, borderRadius: 4 }}>{c.toUpperCase()}</div>
                ))}
              </div>
              {HOURS.map((hr, hi) => (
                <div key={hi} style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, 1fr)', gap: 4, marginBottom: 4, minHeight: 48 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, padding: '14px 0', textAlign: 'right', paddingRight: 8 }}>{hr}</div>
                  {CAGES.map((cage, ci) => {
                    const slot = bookingsForSlot(bookings, cage, hr);
                    return (
                      <div key={ci} style={{
                        background: slot.length > 0 ? `${STATUS_COLOR[slot[0].status] ?? brand.info}22` : brand.creamLight,
                        borderRadius: 6, padding: 6,
                        border: `1px solid ${slot.length > 0 ? (STATUS_COLOR[slot[0].status] ?? brand.info) : brand.border}`,
                        cursor: 'pointer',
                        minHeight: 42,
                      }}>
                        {slot.map((b, si) => (
                          <div key={si} style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[b.status] ?? brand.info, lineHeight: 1.3 }}>
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

        {totalToday === 0 && (
          <div style={{ marginTop: 16, padding: 14, background: brand.infoBg, borderRadius: 10, fontSize: 12, color: brand.text, lineHeight: 1.5 }}>
            <strong>No bookings today.</strong> The schedule will populate as bookings are created in the mobile app.
          </div>
        )}

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <OCard>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, color: brand.text, textTransform: 'uppercase' }}>Peak Hour Analysis</div>
              <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Today&apos;s hourly booking distribution</div>
            </div>
            <BarChart data={hourBarData} height={180} />
            {totalToday === 0 && (
              <div style={{ marginTop: 14, padding: 10, background: brand.infoBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
                Peak hour data will appear as bookings are recorded.
              </div>
            )}
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
    </div>
  );
}
