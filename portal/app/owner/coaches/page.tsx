'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, BarChart } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { UserCog, Activity, TrendingUp, DollarSign, Download, Plus, Star } from 'lucide-react';

type Coach = typeof demoData.coaches[0];

const columns: TableColumn<Coach & Record<string, unknown>>[] = [
  {
    label: 'Coach', key: 'name',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>
          {r.name.split(' ')[1].charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>{r.name}</div>
          <div style={{ fontSize: 11, color: brand.textMuted }}>{r.specialty}</div>
        </div>
      </div>
    ),
  },
  { label: 'Students', key: 'students', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{r.students}</span> },
  {
    label: 'Utilization', key: 'utilization',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 80, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${r.utilization}%`, height: '100%', background: r.utilization >= 80 ? brand.success : r.utilization >= 70 ? brand.warning : brand.danger }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{r.utilization}%</span>
      </div>
    ),
  },
  { label: 'Retention', key: 'retention', align: 'right', render: (r) => <span style={{ color: r.retention >= 90 ? brand.success : brand.warning, fontWeight: 700 }}>{r.retention}%</span> },
  {
    label: 'Rating', key: 'avgRating', align: 'right',
    render: (r) => (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Star size={12} color={brand.goldDeep} fill={brand.goldDeep} />
        <span style={{ fontWeight: 700, fontFamily: fonts.display }}>{r.avgRating}</span>
      </div>
    ),
  },
  { label: 'Revenue', key: 'revenue', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.revenue / 1000).toFixed(1)}K</span> },
  { label: 'Hours/wk', key: 'weeklyHours', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.weeklyHours}</span> },
  { label: 'Joined', key: 'joinedDate', render: (r) => <span style={{ fontSize: 11, color: brand.textMuted }}>{r.joinedDate}</span> },
];

export default function CoachesPage() {
  const totalStudents = demoData.coaches.reduce((s, c) => s + c.students, 0);
  const totalRevenue = demoData.coaches.reduce((s, c) => s + c.revenue, 0);

  return (
    <div>
      <PageHeader
        title="Coach Management"
        subtitle={`${demoData.coaches.length} coaches on staff · ${totalStudents} total students · Avg utilization 81%`}
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={Plus}>Hire Coach</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Staff Size" value={demoData.coaches.length} icon={UserCog} />
          <KPICard label="Avg Utilization" value="81%" delta={3.2} icon={Activity} color="success" />
          <KPICard label="Avg Retention" value="89.9%" delta={1.4} icon={TrendingUp} color="success" />
          <KPICard label="Total Revenue" value={`$${(totalRevenue / 1000).toFixed(1)}K`} delta={8.7} icon={DollarSign} color="gold" />
        </div>

        <SectionHeader title="Coach Roster — Performance" />
        <OTable
          columns={columns as TableColumn<Record<string, unknown>>[]}
          rows={demoData.coaches as unknown as Record<string, unknown>[]}
        />

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <OCard>
            <SectionHeader title="Utilization Distribution" />
            <BarChart
              data={demoData.coaches.map(c => ({ label: c.name.split(' ')[1].substring(0, 6), value: c.utilization, highlight: c.utilization >= 85 }))}
              height={180}
            />
            <div style={{ marginTop: 14, padding: 10, background: brand.successBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
              <strong>Derek Ross</strong> has highest utilization at 91%. Consider adding capacity to avoid burnout.
            </div>
          </OCard>

          <OCard>
            <SectionHeader title="Coach Retention Impact" subtitle="Student retention by coach" />
            {[...demoData.coaches].sort((a, b) => b.retention - a.retention).map((c, i, arr) => (
              <div key={c.id} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.name.replace('Coach ', '')}</div>
                <div style={{ flex: 1, height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${c.retention}%`, height: '100%', background: c.retention >= 90 ? brand.success : brand.warning }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, color: c.retention >= 90 ? brand.success : brand.warning, width: 50, textAlign: 'right' }}>{c.retention}%</div>
              </div>
            ))}
          </OCard>
        </div>
      </div>
    </div>
  );
}
