'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OTable } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Clock, AlertCircle, AlertTriangle, DollarSign, Download, Send, Phone, Mail, MessageCircle, CheckCircle2 } from 'lucide-react';
import type { MiaGroups, OwnerMember } from '@/lib/supabase/ownerQueries';

type Props = { groups: MiaGroups };

const columns: TableColumn<OwnerMember & Record<string, unknown>>[] = [
  {
    label: 'Member', key: 'name',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>{(r.name as string).charAt(0)}</div>
        <div>
          <div style={{ fontWeight: 700 }}>{r.name as string}</div>
          <div style={{ fontSize: 11, color: brand.textMuted }}>{r.age as string} · {r.parent as string}</div>
        </div>
      </div>
    ),
  },
  {
    label: 'Last Session', key: 'lastSession',
    render: (r) => {
      const s = r.lastSession as string;
      const days = s.match(/^(\d+)d ago$/);
      const n = days ? parseInt(days[1]) : 0;
      return (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: n >= 14 ? brand.danger : brand.warning }}>{s}</div>
        </div>
      );
    },
  },
  {
    label: 'Program', key: 'program',
    render: (r) => (
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.program as string}</div>
        <div style={{ fontSize: 10, color: brand.textMuted }}>${r.mrr as number}/mo</div>
      </div>
    ),
  },
  {
    label: 'LTV', key: 'lifetime', align: 'right',
    render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.lifetime as number).toLocaleString()}</span>,
  },
  {
    label: 'Joined', key: 'joinedDate',
    render: (r) => <span style={{ fontSize: 12 }}>{r.joinedDate as string}</span>,
  },
  {
    label: 'Engagement', key: 'engagementScore',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 50, height: 5, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${r.engagementScore as number}%`, height: '100%', background: (r.engagementScore as number) >= 60 ? brand.warning : brand.danger }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{r.engagementScore as number}</div>
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

export function MissingInActionContent({ groups }: Props) {
  const [tab, setTab] = useState<'7' | '14' | '30'>('7');

  const current = groups[tab === '7' ? 'sevenDay' : tab === '14' ? 'fourteenDay' : 'thirtyDay'];

  const totalRevenueAtRisk = [
    ...groups.sevenDay,
    ...groups.fourteenDay,
    ...groups.thirtyDay,
  ].reduce((s, m) => s + m.mrr, 0);

  const tabDefs = [
    { id: '7' as const, label: '7+ Days', count: groups.sevenDay.length, color: brand.warning },
    { id: '14' as const, label: '14+ Days', count: groups.fourteenDay.length, color: brand.warning },
    { id: '30' as const, label: '30+ Days', count: groups.thirtyDay.length, color: brand.danger },
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
          <KPICard label="Missing 7+ Days" value={groups.sevenDay.length} icon={Clock} color="warning" />
          <KPICard label="Missing 14+ Days" value={groups.fourteenDay.length} icon={AlertCircle} color="warning" />
          <KPICard label="Missing 30+ Days" value={groups.thirtyDay.length} icon={AlertTriangle} color="danger" />
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
