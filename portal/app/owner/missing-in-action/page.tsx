'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, SectionHeader, OTable } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Clock, AlertCircle, AlertTriangle, DollarSign, Download, Send, Phone, Mail, MessageCircle, CheckCircle2 } from 'lucide-react';

type MiaEntry = {
  id: number;
  name: string;
  age: number;
  lastSession: string;
  lastDate: string;
  program: string;
  mrr: number;
  totalSessions: number;
  tenure: string;
  coach: string;
  engagementScore: number;
  [key: string]: unknown;
};

const columns: TableColumn<MiaEntry>[] = [
  {
    label: 'Member', key: 'name',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>{r.name.charAt(0)}</div>
        <div>
          <div style={{ fontWeight: 700 }}>{r.name}</div>
          <div style={{ fontSize: 11, color: brand.textMuted }}>{r.age}U · {r.coach}</div>
        </div>
      </div>
    ),
  },
  {
    label: 'Last Session', key: 'lastSession',
    render: (r) => (
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: parseInt(r.lastSession) >= 14 ? brand.danger : brand.warning }}>{r.lastSession}</div>
        <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 2 }}>{r.lastDate}</div>
      </div>
    ),
  },
  {
    label: 'Program', key: 'program',
    render: (r) => (
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.program}</div>
        <div style={{ fontSize: 10, color: brand.textMuted }}>${r.mrr}/mo</div>
      </div>
    ),
  },
  { label: 'Sessions Done', key: 'totalSessions', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{r.totalSessions}</span> },
  { label: 'Tenure', key: 'tenure', render: (r) => <span style={{ fontSize: 12 }}>{r.tenure}</span> },
  {
    label: 'Engagement', key: 'engagementScore',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 50, height: 5, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${r.engagementScore}%`, height: '100%', background: r.engagementScore >= 60 ? brand.warning : brand.danger }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{r.engagementScore}</div>
      </div>
    ),
  },
  {
    label: 'Actions', key: 'id',
    render: () => (
      <div style={{ display: 'flex', gap: 4 }}>
        <OButton variant="gold" size="sm" icon={Phone}>Call</OButton>
        <OButton variant="secondary" size="sm" icon={Mail}>Email</OButton>
        <OButton variant="ghost" size="sm" icon={MessageCircle} />
      </div>
    ),
  },
];

export default function MissingInActionPage() {
  const [tab, setTab] = useState<'7' | '14' | '30'>('7');

  const groups = {
    '7': demoData.missingInAction.sevenDay,
    '14': demoData.missingInAction.fourteenDay,
    '30': demoData.missingInAction.thirtyDay,
  };
  const current = groups[tab];

  const totalRevenueAtRisk = [
    ...demoData.missingInAction.sevenDay,
    ...demoData.missingInAction.fourteenDay,
    ...demoData.missingInAction.thirtyDay,
  ].reduce((s, m) => s + m.mrr, 0);

  const tabDefs = [
    { id: '7' as const, label: '7+ Days', count: demoData.missingInAction.sevenDay.length, color: brand.warning },
    { id: '14' as const, label: '14+ Days', count: demoData.missingInAction.fourteenDay.length, color: brand.warning },
    { id: '30' as const, label: '30+ Days', count: demoData.missingInAction.thirtyDay.length, color: brand.danger },
  ];

  return (
    <div>
      <PageHeader
        title="Missing in Action"
        subtitle="Attendance-based early warning · Early intervention dramatically improves retention"
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={Send}>Send Group Email</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Missing 7+ Days" value={demoData.missingInAction.sevenDay.length} icon={Clock} color="warning" />
          <KPICard label="Missing 14+ Days" value={demoData.missingInAction.fourteenDay.length} icon={AlertCircle} color="warning" />
          <KPICard label="Missing 30+ Days" value={demoData.missingInAction.thirtyDay.length} icon={AlertTriangle} color="danger" />
          <KPICard label="Revenue at Risk" value={`$${totalRevenueAtRisk.toLocaleString()}`} deltaLabel="monthly" icon={DollarSign} color="danger" />
        </div>

        <div style={{ padding: 14, background: brand.infoBg, borderRadius: 10, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.info, color: brand.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} />
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: brand.text, flex: 1 }}>
            <strong>Why this matters:</strong> Youth sports members who miss 14+ days have a 68% probability of churning within the next 30 days. Members who miss 30+ days churn 82% of the time. <strong>A single outreach call recovers roughly 1 in 3.</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {tabDefs.map(t => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: tab === t.id ? brand.dark : brand.surface,
                color: tab === t.id ? brand.gold : brand.textMuted,
                border: `1px solid ${tab === t.id ? brand.dark : brand.border}`,
                cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {t.label}
              <div style={{ padding: '2px 8px', borderRadius: 10, background: tab === t.id ? brand.gold : `${t.color}22`, color: tab === t.id ? brand.dark : t.color, fontSize: 11, fontWeight: 800, fontFamily: fonts.display }}>{t.count}</div>
            </div>
          ))}
        </div>

        <SectionHeader title={`Members missing ${tab}+ days`} subtitle="Sorted by last session date — oldest first" />

        {current.length > 0 ? (
          <OTable
            columns={columns as TableColumn<Record<string, unknown>>[]}
            rows={current as unknown as Record<string, unknown>[]}
          />
        ) : (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <CheckCircle2 size={48} color={brand.success} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>No members in this group</div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>Great attendance. Keep it up.</div>
          </div>
        )}
      </div>
    </div>
  );
}
