'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, DonutChart, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { DollarSign, CheckCircle2, Activity, AlertCircle, Download, FileText } from 'lucide-react';

type Transaction = typeof demoData.recentTransactions[0];

const txColumns: TableColumn<Transaction & Record<string, unknown>>[] = [
  { label: 'Date', key: 'date' },
  { label: 'Member', key: 'member', render: (r) => <span style={{ fontWeight: 700 }}>{r.member}</span> },
  { label: 'Package', key: 'package' },
  { label: 'Amount', key: 'amount', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${r.amount}</span> },
  { label: 'Method', key: 'method' },
  { label: 'Status', key: 'status', render: (r) => <Chip color={r.status === 'paid' ? 'success' : 'danger'}>{r.status}</Chip> },
];

export default function BillingPage() {
  const router = useRouter();

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
          <KPICard label="MRR" value="$80,360" delta={8.2} icon={DollarSign} color="gold" />
          <KPICard label="Collected (MTD)" value="$62,420" delta={5.1} icon={CheckCircle2} color="success" />
          <KPICard label="Auto-Pay Rate" value="94.3%" delta={0.6} icon={Activity} color="success" />
          <KPICard label="Past Due" value="$1,020" delta={-12.8} icon={AlertCircle} color="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <SectionHeader title="Revenue by Package" subtitle="Monthly recurring revenue breakdown" />
            <OCard>
              {demoData.revenueByPackage.map((p, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: i < demoData.revenueByPackage.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{p.activeCount} active · ${p.price}/mo · LTV ${p.ltv.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display }}>${(p.mrr / 1000).toFixed(1)}K</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 600 }}>{p.pctRevenue}%</div>
                    </div>
                  </div>
                  <div style={{ height: 4, background: brand.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${p.pctRevenue}%`, height: '100%', background: brand.goldDeep }} />
                  </div>
                </div>
              ))}
            </OCard>
          </div>

          <div>
            <SectionHeader title="Auto-Collect Health" />
            <OCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DonutChart data={[
                    { value: 269, color: brand.success },
                    { value: 15, color: brand.warning },
                    { value: 3, color: brand.danger },
                  ]} size={120} />
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, color: brand.success }}>94.3%</div>
                    <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>SUCCESS</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {[
                    { color: brand.success, label: 'Charged', value: 269 },
                    { color: brand.warning, label: 'Retry pending', value: 15 },
                    { color: brand.danger, label: 'Failed', value: 3 },
                  ].map((row, i) => (
                    <div key={i} style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: row.color }} />
                      <div style={{ fontSize: 12, flex: 1 }}>{row.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <OButton
                variant="secondary"
                size="sm"
                icon={AlertCircle}
                onClick={() => router.push('/owner/failed-payments')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Review 3 Failed Payments →
              </OButton>
            </OCard>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Projected This Month" subtitle="October forecast" />
              <OCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fonts.display }}>${demoData.forecast.thisMonth.netProjected.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>Net projected total</div>
                  </div>
                  <Chip color="success">ON TRACK</Chip>
                </div>
                <div style={{ padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                  {[
                    { label: 'Collected so far', value: `$${demoData.forecast.thisMonth.collectedSoFar.toLocaleString()}`, color: brand.success },
                    { label: 'Remaining to collect', value: `$${demoData.forecast.thisMonth.remainingToCollect.toLocaleString()}`, color: undefined as string | undefined },
                    { label: 'Declines & cancellations', value: `−$${(demoData.forecast.thisMonth.projectedDeclines + demoData.forecast.thisMonth.projectedCancellations).toLocaleString()}`, color: brand.danger },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                      <span style={{ color: brand.textMuted }}>{row.label}</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </OCard>
            </div>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Projected Next Month" subtitle="November forecast" />
              <OCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fonts.display, color: brand.info }}>${demoData.forecast.nextMonth.projectedNet.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>Net forecast · {demoData.forecast.nextMonth.confidence}% confidence</div>
                  </div>
                  <Chip color="info">FORECAST</Chip>
                </div>
                <div style={{ padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                  {[
                    { label: 'Opening MRR', value: `$${demoData.forecast.nextMonth.openingMRR.toLocaleString()}`, color: undefined as string | undefined },
                    { label: 'Expected new signups', value: `+$${demoData.forecast.nextMonth.expectedNewSignups.toLocaleString()}`, color: brand.success },
                    { label: 'Expected churn + declines', value: `−$${(demoData.forecast.nextMonth.expectedChurn + demoData.forecast.nextMonth.expectedDeclines).toLocaleString()}`, color: brand.danger },
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
          <OTable
            columns={txColumns as TableColumn<Record<string, unknown>>[]}
            rows={demoData.recentTransactions as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>
    </div>
  );
}
