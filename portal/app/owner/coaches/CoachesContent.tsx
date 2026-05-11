'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, BarChart } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { UserCog, Activity, TrendingUp, DollarSign, Download, Plus, Star } from 'lucide-react';
import type { OwnerCoach } from '@/lib/supabase/ownerQueries';

type Props = { coaches: OwnerCoach[] };

const columns: TableColumn<OwnerCoach & Record<string, unknown>>[] = [
  {
    label: 'Coach', key: 'name',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>
          {(r.name as string).split(' ').pop()?.charAt(0) ?? '?'}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>{r.name as string}</div>
          <div style={{ fontSize: 11, color: brand.textMuted }}>{r.specialty as string}</div>
        </div>
      </div>
    ),
  },
  { label: 'Students', key: 'students', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{r.students as number}</span> },
  {
    label: 'Utilization', key: 'utilization',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 80, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${r.utilization as number}%`, height: '100%', background: (r.utilization as number) >= 80 ? brand.success : (r.utilization as number) >= 70 ? brand.warning : brand.danger }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{r.utilization as number}%</span>
      </div>
    ),
  },
  { label: 'Retention', key: 'retention', align: 'right', render: (r) => <span style={{ color: (r.retention as number) >= 90 ? brand.success : brand.warning, fontWeight: 700 }}>{r.retention as number}%</span> },
  {
    label: 'Rating', key: 'avgRating', align: 'right',
    render: (r) => (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Star size={12} color={brand.goldDeep} fill={brand.goldDeep} />
        <span style={{ fontWeight: 700, fontFamily: fonts.display }}>{r.avgRating as number}</span>
      </div>
    ),
  },
  { label: 'Hours/wk', key: 'weeklyHours', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.weeklyHours as number}</span> },
  { label: 'Joined', key: 'joinedDate', render: (r) => <span style={{ fontSize: 11, color: brand.textMuted }}>{r.joinedDate as string}</span> },
];

export function CoachesContent({ coaches }: Props) {
  const totalStudents = coaches.reduce((s, c) => s + c.students, 0);
  const avgUtil = coaches.length > 0 ? Math.round(coaches.reduce((s, c) => s + c.utilization, 0) / coaches.length) : 0;
  const avgRet = coaches.length > 0 ? Math.round(coaches.reduce((s, c) => s + c.retention, 0) / coaches.length * 10) / 10 : 0;

  return (
    <div>
      <PageHeader
        title="Coach Management"
        subtitle={`${coaches.length} coach${coaches.length !== 1 ? 'es' : ''} on staff · ${totalStudents} total students`}
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={Plus}>Hire Coach</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Staff Size" value={coaches.length} icon={UserCog} />
          <KPICard label="Avg Utilization" value={`${avgUtil}%`} icon={Activity} color="success" />
          <KPICard label="Avg Retention" value={`${avgRet}%`} icon={TrendingUp} color="success" />
          <KPICard label="Total Students" value={totalStudents} icon={DollarSign} color="gold" />
        </div>

        {coaches.length === 0 ? (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>No coaches yet</div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>Coaches will appear here once provisioned via the admin panel.</div>
          </div>
        ) : (
          <>
            <SectionHeader title="Coach Roster — Performance" />
            <OTable
              columns={columns as TableColumn<Record<string, unknown>>[]}
              rows={coaches as unknown as Record<string, unknown>[]}
            />

            {coaches.length > 1 && (
              <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <OCard>
                  <SectionHeader title="Utilization Distribution" />
                  <BarChart
                    data={coaches.map(c => ({
                      label: c.name.split(' ').pop()?.substring(0, 6) ?? c.name.substring(0, 6),
                      value: c.utilization,
                      highlight: c.utilization >= 85,
                    }))}
                    height={180}
                  />
                </OCard>

                <OCard>
                  <SectionHeader title="Retention by Coach" subtitle="Student retention per coach" />
                  {[...coaches].sort((a, b) => b.retention - a.retention).map((c, i, arr) => (
                    <div key={c.id} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ flex: 1, height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${c.retention}%`, height: '100%', background: c.retention >= 90 ? brand.success : brand.warning }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, color: c.retention >= 90 ? brand.success : brand.warning, width: 50, textAlign: 'right' }}>{c.retention}%</div>
                    </div>
                  ))}
                </OCard>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
