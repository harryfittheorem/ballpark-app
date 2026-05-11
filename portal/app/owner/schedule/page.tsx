'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, OCard, BarChart, DonutChart } from '@/components/owner/ui';
import { Calendar, Activity, TrendingUp, Clock, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM'];
const cages = ['Cage 1', 'Cage 2', 'Cage 3', 'Cage 4', 'Cage 5', 'Cage 6', 'Cage 7', 'Cage 8'];

const now = new Date();
const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const todayLabel = `${dayNames[now.getDay()]} · ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

export default function SchedulePage() {
  return (
    <div>
      <PageHeader
        title="Schedule & Capacity"
        subtitle={`${todayLabel} · 8 cages`}
        actions={
          <>
            <OButton variant="secondary" icon={Filter}>Filter</OButton>
            <OButton variant="gold" icon={Plus}>New Booking</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Today's Sessions" value="0" deltaLabel="booked" icon={Calendar} color="gold" />
          <KPICard label="Today's Occupancy" value="0%" icon={Activity} color="success" />
          <KPICard label="Peak Hour" value="—" deltaLabel="no data yet" icon={TrendingUp} color="warning" />
          <KPICard label="Open Slots" value="96" deltaLabel="today" icon={Clock} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <OButton variant="secondary" size="sm" icon={ChevronLeft}>Prev</OButton>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, padding: '0 8px' }}>{todayLabel}</div>
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
                  {cages.map((_, ci) => (
                    <div key={ci} style={{
                      background: brand.creamLight,
                      borderRadius: 6, padding: 6,
                      border: `1px solid ${brand.border}`,
                      cursor: 'pointer',
                      minHeight: 42,
                    }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </OCard>

        <div style={{ marginTop: 16, padding: 14, background: brand.infoBg, borderRadius: 10, fontSize: 12, color: brand.text, lineHeight: 1.5 }}>
          <strong>No bookings today.</strong> The schedule will populate as bookings are created in the mobile app.
        </div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <OCard>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, color: brand.text, textTransform: 'uppercase' }}>Peak Hour Analysis</div>
              <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Average weekly utilization</div>
            </div>
            <BarChart data={[
              { label: '9 AM', value: 0 }, { label: '10 AM', value: 0 }, { label: '11 AM', value: 0 },
              { label: '12 PM', value: 0 }, { label: '1 PM', value: 0 }, { label: '2 PM', value: 0 },
              { label: '3 PM', value: 0 }, { label: '4 PM', value: 0 },
              { label: '5 PM', value: 0 }, { label: '6 PM', value: 0 },
              { label: '7 PM', value: 0 }, { label: '8 PM', value: 0 },
            ]} height={180} />
            <div style={{ marginTop: 14, padding: 10, background: brand.infoBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
              Peak hour data will appear as bookings are recorded.
            </div>
          </OCard>

          <OCard>
            <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, color: brand.text, textTransform: 'uppercase' }}>Session Type Breakdown</div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <DonutChart data={[
                { value: 1, color: brand.goldDeep },
              ]} size={140} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: brand.textMuted }}>No sessions booked yet.</div>
              </div>
            </div>
          </OCard>
        </div>
      </div>
    </div>
  );
}
