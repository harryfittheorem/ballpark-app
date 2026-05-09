'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, OCard, BarChart, DonutChart } from '@/components/owner/ui';
import { Calendar, Activity, TrendingUp, Clock, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM'];
const cages = ['Cage 1', 'Cage 2', 'Cage 3', 'Cage 4', 'Cage 5', 'Cage 6', 'Cage 7', 'Cage 8'];

const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  Private: { bg: `${brand.goldDeep}22`, border: brand.goldDeep, text: brand.text },
  Assessment: { bg: `${brand.info}22`, border: brand.info, text: brand.text },
  Group: { bg: `${brand.success}22`, border: brand.success, text: brand.text },
  Team: { bg: `${brand.warning}22`, border: brand.warning, text: brand.text },
};

export default function SchedulePage() {
  return (
    <div>
      <PageHeader
        title="Schedule & Capacity"
        subtitle="Tuesday, October 22 · 8 cages · 6 coaches · 78% utilization today"
        actions={
          <>
            <OButton variant="secondary" icon={Filter}>Filter</OButton>
            <OButton variant="gold" icon={Plus}>New Booking</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Today's Sessions" value="42" deltaLabel="booked" icon={Calendar} color="gold" />
          <KPICard label="Today's Occupancy" value="78%" delta={4.2} icon={Activity} color="success" />
          <KPICard label="Peak Hour" value="5 PM" deltaLabel="100% full" icon={TrendingUp} color="warning" />
          <KPICard label="Open Slots" value="14" deltaLabel="today" icon={Clock} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <OButton variant="secondary" size="sm" icon={ChevronLeft}>Prev</OButton>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, padding: '0 8px' }}>TUE · OCT 22, 2025</div>
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
                {cages.map(c => (
                  <div key={c} style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, textAlign: 'center', letterSpacing: 0.5, padding: '6px 0', background: brand.surfaceAlt, borderRadius: 4 }}>{c.toUpperCase()}</div>
                ))}
              </div>
              {hours.map((hr, hi) => (
                <div key={hi} style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, 1fr)', gap: 4, marginBottom: 4, minHeight: 48 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, padding: '14px 0', textAlign: 'right', paddingRight: 8 }}>{hr}</div>
                  {cages.map((_, ci) => {
                    const booking = demoData.scheduleSlots.find(b => b.time === hi && b.cage === ci);
                    const tc = booking ? typeColors[booking.type] : null;
                    return (
                      <div key={ci} style={{
                        background: booking && tc ? tc.bg : brand.creamLight,
                        borderRadius: 6, padding: 6,
                        border: `1px solid ${booking && tc ? tc.border : brand.border}`,
                        cursor: 'pointer',
                        minHeight: 42,
                      }}>
                        {booking && tc && (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 700, color: tc.text }}>{booking.name}</div>
                            <div style={{ fontSize: 9, color: brand.textMuted, marginTop: 2 }}>{booking.coach}</div>
                            <div style={{ fontSize: 8, color: tc.border, fontWeight: 800, marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: fonts.display }}>{booking.type}</div>
                          </>
                        )}
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
              <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Average weekly utilization</div>
            </div>
            <BarChart data={[
              { label: '9 AM', value: 32 }, { label: '10 AM', value: 48 }, { label: '11 AM', value: 56 },
              { label: '12 PM', value: 42 }, { label: '1 PM', value: 38 }, { label: '2 PM', value: 52 },
              { label: '3 PM', value: 74 }, { label: '4 PM', value: 92, highlight: true },
              { label: '5 PM', value: 100, highlight: true }, { label: '6 PM', value: 96, highlight: true },
              { label: '7 PM', value: 78 }, { label: '8 PM', value: 48 },
            ]} height={180} />
            <div style={{ marginTop: 14, padding: 10, background: brand.warningBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
              <strong>4-7 PM is near capacity.</strong> Consider adding staff or incentivizing off-peak bookings.
            </div>
          </OCard>

          <OCard>
            <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, color: brand.text, textTransform: 'uppercase' }}>Session Type Breakdown</div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <DonutChart data={[
                { value: 11, color: brand.goldDeep },
                { value: 1, color: brand.info },
                { value: 2, color: brand.success },
                { value: 2, color: brand.warning },
              ]} size={140} />
              <div style={{ flex: 1 }}>
                {[
                  { label: 'Private Lessons', count: 11, color: brand.goldDeep },
                  { label: 'Assessments', count: 1, color: brand.info },
                  { label: 'Group Classes', count: 2, color: brand.success },
                  { label: 'Team Training', count: 2, color: brand.warning },
                ].map((t, i) => (
                  <div key={i} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color }} />
                    <div style={{ flex: 1 }}>{t.label}</div>
                    <div style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{t.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </OCard>
        </div>
      </div>
    </div>
  );
}
