'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, DonutChart, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { DollarSign, CheckCircle2, Activity, AlertCircle, Download, FileText } from 'lucide-react';
import type { BillingData, RecentTransaction, MembershipPackage } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';

type Props = { data: BillingData };

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_PACKAGES: MembershipPackage[] = [
  { name: 'Unlimited Monthly',   planType: 'eft', price: 280, activeCount: 147, mrr: 41160, pctRevenue: 51, ltv: 3368 },
  { name: 'Team Training',       planType: 'eft', price: 450, activeCount: 12,  mrr: 5400,  pctRevenue: 7,  ltv: 5480 },
  { name: 'Cage Rental Monthly', planType: 'eft', price: 120, activeCount: 31,  mrr: 3720,  pctRevenue: 5,  ltv: 1440 },
  { name: '8-Pack Lessons',      planType: 'otc', price: 320, activeCount: 42,  mrr: 13440, pctRevenue: 17, ltv: 968  },
  { name: '4-Pack Lessons',      planType: 'otc', price: 180, activeCount: 38,  mrr: 6840,  pctRevenue: 9,  ltv: 548  },
];

const DEMO_TRANSACTIONS: RecentTransaction[] = [
  { id: 't01', date: 'May 12, 2026', member: 'Jake Martinez',   package: 'Unlimited Monthly',   amount: 280, method: 'EFT',  status: 'paid'   },
  { id: 't02', date: 'May 12, 2026', member: 'Aiden Torres',    package: 'Team Training',        amount: 450, method: 'EFT',  status: 'paid'   },
  { id: 't03', date: 'May 12, 2026', member: 'Caleb Nguyen',    package: 'Unlimited Monthly',   amount: 280, method: 'EFT',  status: 'paid'   },
  { id: 't04', date: 'May 11, 2026', member: 'Marcus Williams', package: 'Unlimited Monthly',   amount: 280, method: 'EFT',  status: 'failed' },
  { id: 't05', date: 'May 11, 2026', member: 'Jaxon Rivera',    package: 'Cage Rental Monthly',  amount: 120, method: 'EFT',  status: 'paid'   },
  { id: 't06', date: 'May 11, 2026', member: 'Ryan Chen',       package: '8-Pack Lessons',       amount: 320, method: 'CARD', status: 'paid'   },
  { id: 't07', date: 'May 10, 2026', member: 'Ethan Brooks',    package: 'Cage Rental Monthly',  amount: 120, method: 'EFT',  status: 'paid'   },
  { id: 't08', date: 'May 10, 2026', member: 'Zane Harris',     package: 'Unlimited Monthly',   amount: 280, method: 'EFT',  status: 'paid'   },
  { id: 't09', date: 'May 10, 2026', member: 'Owen Murphy',     package: 'Team Training',        amount: 450, method: 'EFT',  status: 'failed' },
  { id: 't10', date: 'May 9, 2026',  member: 'Noah Patel',      package: 'Unlimited Monthly',   amount: 280, method: 'EFT',  status: 'paid'   },
];

const txColumns: TableColumn<RecentTransaction & Record<string, unknown>>[] = [
  { label: 'Date',    key: 'date' },
  { label: 'Member',  key: 'member',  render: (r) => <span style={{ fontWeight: 700 }}>{r.member as string}</span> },
  { label: 'Package', key: 'package' },
  { label: 'Amount',  key: 'amount',  align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.amount as number).toLocaleString()}</span> },
  { label: 'Method',  key: 'method' },
  { label: 'Status',  key: 'status',  render: (r) => <Chip color={r.status === 'paid' ? 'success' : r.status === 'refunded' ? 'warning' : 'danger'}>{r.status as string}</Chip> },
];

// ── Component ──────────────────────────────────────────────────────────────

export function BillingContent({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const hasLiveData = data.kpis.mrr > 0 || data.packages.length > 0 || data.recentTransactions.length > 0;

  const packages           = hasLiveData ? data.packages           : DEMO_PACKAGES;
  const recentTransactions = hasLiveData ? data.recentTransactions : DEMO_TRANSACTIONS;
  const paidCount          = hasLiveData ? data.paidCount          : DEMO_TRANSACTIONS.filter(t => t.status === 'paid').length;
  const failedCount        = hasLiveData ? data.failedCount        : DEMO_TRANSACTIONS.filter(t => t.status === 'failed').length;

  const kpis = hasLiveData ? data.kpis : {
    ...data.kpis,
    mrr: 80400, collectedMtd: 75800, autoPayRate: 94.7, pastDue: 1240,
    failedPaymentsCount: 3, activeMembers: 147,
  };

  const totalMrr       = packages.reduce((s, p) => s + p.mrr, 0) || kpis.mrr;
  const totalAttempted = paidCount + failedCount;
  const successRate    = totalAttempted > 0 ? Math.round((paidCount / totalAttempted) * 100) : 100;

  const handleExport = () => {
    exportCsv(`billing-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      recentTransactions as unknown as Record<string, unknown>[],
      [
        { label: 'Date',    key: 'date' },
        { label: 'Member',  key: 'member' },
        { label: 'Package', key: 'package' },
        { label: 'Amount',  key: 'amount' },
        { label: 'Method',  key: 'method' },
        { label: 'Status',  key: 'status' },
      ],
    );
    setToast(`Exported ${recentTransactions.length} transactions as CSV`);
  };

  const handleGenerateStatement = () => {
    const rows = [
      { label: 'MRR',             value: `$${kpis.mrr.toLocaleString()}` },
      { label: 'Collected (MTD)', value: `$${kpis.collectedMtd.toLocaleString()}` },
      { label: 'Auto-Pay Rate',   value: `${kpis.autoPayRate}%` },
      { label: 'Past Due',        value: `$${kpis.pastDue.toLocaleString()}` },
      { label: 'Active Members',  value: String(kpis.activeMembers) },
      { label: 'Success Rate',    value: `${successRate}%` },
      { label: 'Failed Payments', value: String(kpis.failedPaymentsCount) },
    ] as { label: string; value: string }[];

    exportCsv(`billing-statement-${new Date().toISOString().slice(0, 10)}.csv`,
      rows as unknown as Record<string, unknown>[],
      [{ label: 'Metric', key: 'label' }, { label: 'Value', key: 'value' }],
    );
    setToast('Statement downloaded as CSV');
  };

  return (
    <div>
      <PageHeader
        title="Billing Overview"
        subtitle="Revenue, auto-collect health, and payment status"
        actions={
          <>
            <OButton variant="secondary" icon={Download} onClick={handleExport}>Export</OButton>
            <OButton variant="gold" icon={FileText} onClick={handleGenerateStatement}>Generate Statement</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="MRR"             value={`$${kpis.mrr.toLocaleString()}`}             icon={DollarSign}   color="gold" />
          <KPICard label="Collected (MTD)" value={`$${kpis.collectedMtd.toLocaleString()}`}    icon={CheckCircle2} color="success" />
          <KPICard label="Auto-Pay Rate"   value={`${kpis.autoPayRate}%`}                      icon={Activity}     color="success" />
          <KPICard label="Past Due"        value={`$${kpis.pastDue.toLocaleString()}`}          icon={AlertCircle}  color="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Package breakdown */}
          <div>
            <SectionHeader title="Revenue by Package" subtitle="Monthly recurring revenue breakdown" />
            <OCard>
              {packages.map((p, i) => (
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
              ))}
            </OCard>
          </div>

          {/* Auto-collect + MRR summary */}
          <div>
            <SectionHeader title="Auto-Collect Health" />
            <OCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DonutChart data={[
                    { value: Math.max(paidCount, 1), color: brand.success },
                    { value: Math.max(failedCount, 0.01), color: brand.danger },
                  ]} size={120} />
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, color: brand.success }}>{successRate}%</div>
                    <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>SUCCESS</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {[
                    { color: brand.success, label: 'Charged successfully', value: paidCount },
                    { color: brand.danger,  label: 'Failed',               value: failedCount },
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
                  variant="secondary" size="sm" icon={AlertCircle}
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
                    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fonts.display }}>${totalMrr.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>Active monthly recurring revenue</div>
                  </div>
                  <Chip color="success">LIVE</Chip>
                </div>
                <div style={{ padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                  {([
                    { label: 'Collected (MTD)', value: `$${kpis.collectedMtd.toLocaleString()}`, color: brand.success },
                    { label: 'Past due',         value: `$${kpis.pastDue.toLocaleString()}`,      color: kpis.pastDue > 0 ? brand.danger : undefined },
                    { label: 'Active members',   value: String(kpis.activeMembers),              color: undefined },
                  ] as Array<{ label: string; value: string; color?: string }>).map((row, i) => (
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

        <SectionHeader title="Recent Transactions" action={<OButton variant="ghost" size="sm" onClick={handleExport}>View All →</OButton>} />
        <OTable
          columns={txColumns as TableColumn<Record<string, unknown>>[]}
          rows={recentTransactions as unknown as Record<string, unknown>[]}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 380 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
