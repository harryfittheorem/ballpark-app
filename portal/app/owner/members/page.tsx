'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { OButton, PageHeader, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Download, Plus, Filter } from 'lucide-react';

type Member = typeof demoData.members[0];

const columns: TableColumn<Member & Record<string, unknown>>[] = [
  {
    label: 'Member', key: 'name', sortable: true,
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>{r.name.charAt(0)}</div>
        <div>
          <div style={{ fontWeight: 700 }}>{r.name}</div>
          <div style={{ fontSize: 11, color: brand.textMuted }}>{r.age}U · {r.parent}</div>
        </div>
      </div>
    ),
  },
  {
    label: 'Program', key: 'program', sortable: true,
    render: (r) => (
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.program}</div>
        <div style={{ fontSize: 10, color: brand.textMuted }}>${r.mrr}/mo</div>
      </div>
    ),
  },
  {
    label: 'Status', key: 'status', sortable: true,
    render: (r) => <Chip color={r.status === 'active' ? 'success' : r.status === 'at-risk' ? 'danger' : 'info'}>{r.status}</Chip>,
  },
  {
    label: 'Engagement', key: 'engagementScore', sortable: true,
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 60, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${r.engagementScore}%`, height: '100%', background: r.engagementScore >= 70 ? brand.success : r.engagementScore >= 50 ? brand.warning : brand.danger }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{r.engagementScore}</div>
      </div>
    ),
  },
  {
    label: 'Risk', key: 'churnRisk', sortable: true,
    render: (r) => <Chip color={r.churnRisk === 'low' ? 'success' : r.churnRisk === 'medium' ? 'warning' : 'danger'} size="sm">{r.churnRisk}</Chip>,
  },
  {
    label: 'Last Session', key: 'lastSession',
    render: (r) => {
      const isOld = r.lastSession.includes('d ago') && parseInt(r.lastSession) > 14;
      return <span style={{ fontSize: 11, color: isOld ? brand.danger : brand.textMuted, fontWeight: 600 }}>{r.lastSession}</span>;
    },
  },
  {
    label: 'LTV', key: 'lifetime', align: 'right', sortable: true,
    render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${r.lifetime.toLocaleString()}</span>,
  },
  {
    label: 'Next Charge', key: 'nextCharge',
    render: (r) => <span style={{ fontSize: 11, color: r.nextCharge === 'Overdue' ? brand.danger : brand.textMuted, fontWeight: 600 }}>{r.nextCharge}</span>,
  },
];

export default function MembersPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? demoData.members
    : filter === 'at-risk' ? demoData.members.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium')
    : demoData.members.filter(m => m.status === 'active');

  const tabs = [
    { id: 'all', label: 'All Members', count: demoData.members.length },
    { id: 'active', label: 'Active', count: demoData.members.filter(m => m.status === 'active').length },
    { id: 'at-risk', label: 'At Risk', count: demoData.members.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium').length },
  ];

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${demoData.members.length} total · ${demoData.members.filter(m => m.status === 'active').length} active · ${demoData.members.filter(m => m.churnRisk === 'high').length} at high risk`}
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={Plus}>Add Member</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(f => (
            <div
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: filter === f.id ? brand.dark : brand.surface,
                color: filter === f.id ? brand.gold : brand.textMuted,
                border: `1px solid ${filter === f.id ? brand.dark : brand.border}`,
                cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
              }}
            >
              {f.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{f.count}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <OButton variant="secondary" size="sm" icon={Filter}>More Filters</OButton>
        </div>

        <OTable
          columns={columns as TableColumn<Record<string, unknown>>[]}
          rows={filtered as unknown as Record<string, unknown>[]}
          onRowClick={(row) => router.push(`/owner/members/${(row as Member).id}`)}
        />
      </div>
    </div>
  );
}
