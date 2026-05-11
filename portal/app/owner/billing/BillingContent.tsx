'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, DonutChart, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { DollarSign, CheckCircle2, Activity, AlertCircle, Download, FileText } from 'lucide-react';
import type { BillingData, RecentTransaction } from '@/lib/supabase/ownerQueries';

type Props = { data: BillingData };

const txColumns: TableColumn<RecentTransaction & Record<string, unknown>>[] = [
  { label: 'Date', key: 'date' },
  { label: 'Member', key: 'member', render: (r) => <span style={{ fontWeight: 700 }}>{r.member as string}</span> },
  { label: 'Package', key: 'package' },
  { label: 'Amount', key: 'amount', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.amount as number).toLocaleString()}</span> },
  { label: 'Method', key: 'method' },
  { label: 'Status', key: 'status', render: (r) => <Chip color={r.status === 'paid' ? 'success' : 'danger'}>{r.status as string}</Chip> },
];

export function BillingContent({ data }: Props) {
  const router = useRouter();
  const { kpis, packages, recentTransactions, paidCount, failedCount } = data;
  const totalAttempted = paidCount + failedCount;
  const successRate = totalAttempted > 0 ? Math.round((paidCount / totalAttempted) * 100) : 100;

  return (
    <div>
      <PageHeader
        title="Billing Overview"
        subtitle="Revenue, auto-collect health, and payment status"
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={FileText}>Generate Statement</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="MRR" value={`$${kpis.mrr.toLocaleString()}`} icon={DollarSign} color="gold" />
          <KPICard label="Collected (MTD)" value={`$${kpis.collectedMtd.toLocaleString()}`} icon={CheckCircle2} color="success" />
          <KPICard label="Auto-Pay Rate" value={`${kpis.autoPayRate}%`} icon={Activity} color="success" />
          <KPICard label="Past Due" value={`$${kpis.pastDue.toLocaleString()}`} icon={AlertCircle} color="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <SectionHeader title="Revenue by Package" subtitle="Monthly recurring revenue breakdown" />
            <OCard>
              {packages.length === 0 ? (
                <div style={{ fontSize: 12, color: brand.textMuted, textAlign: 'center', padding: 20 }}>No membership data yet</div>
              ) : (
                packages.map((p, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: i < packages.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{p.activeCount} active · ${p.price}/mo · LTV ${p.ltv.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display }}>${p.mrr.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 600 }}>{p.pctRevenue}%</div>
                      </div>
                    </div>
                    <div style={{ height: 4, background: brand.border, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${p.pctRevenue}%`, height: '100%', background: brand.goldDeep }} />
                    </div>
                  </div>
                ))
              )}
            </OCard>
          </div>

          <div>
            <SectionHeader title="Auto-Collect Health" />
            <OCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DonutChart data={[
                    { value: Math.max(paidCount, 1), color: brand.success },
                    { value: Math.max(failedCount, 0), color: brand.danger },
                  ]} size={120} />
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, color: brand.success }}>{successRate}%</div>
                    <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>SUCCESS</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {[
                    { color: brand.success, label: 'Charged', value: paidCount },
                    { color: brand.danger, label: 'Failed', value: failedCount },
                  ].map((row, i) => (
                    <div key={i} style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: row.color }} />
                      <div style={{ fontSize: 12, flex: 1 }}>{row.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              {kpis.failedPaymentsCount > 0 && (
                <OButton
                  variant="secondary"
                  size="sm"
                  icon={AlertCircle}
                  onClick={() => router.push('/owner/failed-payments')}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Review {kpis.failedPaymentsCount} Failed Payment{kpis.failedPaymentsCount !== 1 ? 's' : ''} →
                </OButton>
              )}
            </OCard>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="MRR Summary" />
              <OCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fonts.display }}>${kpis.mrr.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>Active monthly recurring revenue</div>
                  </div>
                  <Chip color="success">LIVE</Chip>
                </div>
                <div style={{ padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                  {[
                    { label: 'Collected (MTD)', value: `$${kpis.collectedMtd.toLocaleString()}`, color: brand.success },
                    { label: 'Past due', value: `$${kpis.pastDue.toLocaleString()}`, color: kpis.pastDue > 0 ? brand.danger : undefined as string | undefined },
                    { label: 'Active members', value: String(kpis.activeMembers), color: undefined as string | undefined },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                      <span style={{ color: brand.textMuted }}>{row.label}</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </OCard>
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title="Recent Transactions" action={<OButton variant="ghost" size="sm">View All →</OButton>} />
          {recentTransactions.length === 0 ? (
            <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 30, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: brand.textMuted }}>No transactions yet</div>
            </div>
          ) : (
            <OTable
              columns={txColumns as TableColumn<Record<string, unknown>>[]}
              rows={recentTransactions as unknown as Record<string, unknown>[]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
