'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { PageHeader, SectionHeader, OCard, KPICard, Chip, OTable } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Activity, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';
import { playerHref } from '@/lib/playerLinks';

type InactivityBucket = 'active' | 'warn7' | 'warn14' | 'warn30' | 'inactive';

function getBucket(score: number): InactivityBucket {
  if (score >= 72) return 'active';    // last session ≤ 7 days
  if (score >= 44) return 'warn7';     // 7–14 days
  if (score >= 16) return 'warn14';    // 14–21 days
  if (score >= 0)  return 'warn30';    // 21–25 days
  return 'inactive';
}

const BUCKET_LABEL: Record<InactivityBucket, string> = {
  active: 'Active (≤7d)',
  warn7:  'Warning (7–14d)',
  warn14: 'Alert (14–21d)',
  warn30: 'At Risk (21–25d)',
  inactive: 'Inactive (25d+)',
};

const BUCKET_COLOR: Record<InactivityBucket, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  warn7: 'default',
  warn14: 'warning',
  warn30: 'danger',
  inactive: 'danger',
};

type Filter = 'all' | InactivityBucket;

type Row = {
  id: string;
  name: string;
  age: string;
  engagement: number;
  lastSession: string;
  status: string;
  bucket: InactivityBucket;
  href: string | null;
};

export function EngagementContent({ members }: { members: OwnerMember[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  const rows: Row[] = useMemo(() =>
    members
      .filter(m => m.status !== 'cancelled')
      .map(m => ({
        id: m.id,
        name: m.name,
        age: m.age,
        engagement: m.engagementScore,
        lastSession: m.lastSession,
        status: m.status,
        bucket: getBucket(m.engagementScore),
        href: playerHref({ kidId: m.kidId }),
      })),
    [members],
  );

  const counts = useMemo(() => {
    const c: Record<InactivityBucket, number> = { active: 0, warn7: 0, warn14: 0, warn30: 0, inactive: 0 };
    rows.forEach(r => { c[r.bucket]++; });
    return c;
  }, [rows]);

  const filtered = filter === 'all' ? rows : rows.filter(r => r.bucket === filter);
  const avgEngagement = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.engagement, 0) / rows.length)
    : 0;
  const inactiveCount = counts.warn14 + counts.warn30 + counts.inactive;
  const alertCount = counts.warn30 + counts.inactive;

  const columns: TableColumn<Row>[] = [
    {
      key: 'name',
      label: 'Member',
      render: (row) => row.href
        ? <Link href={row.href} style={{ color: brand.gold, textDecoration: 'underline', textUnderlineOffset: 3 }}>{row.name}</Link>
        : <span>{row.name}</span>,
    },
    { key: 'age', label: 'Division' },
    {
      key: 'engagement',
      label: 'Engagement',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 60, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${row.engagement}%`, height: '100%', borderRadius: 3, background: row.engagement >= 70 ? brand.success : row.engagement >= 50 ? brand.warning : brand.danger }} />
          </div>
          <span style={{ fontFamily: fonts.mono, fontSize: 11 }}>{row.engagement}</span>
        </div>
      ),
    },
    { key: 'lastSession', label: 'Last Session' },
    {
      key: 'bucket',
      label: 'Status',
      render: (row) => <Chip color={BUCKET_COLOR[row.bucket]} size="sm">{BUCKET_LABEL[row.bucket]}</Chip>,
    },
  ];

  const filterBtns: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'warn7', label: '7–14d', count: counts.warn7 },
    { key: 'warn14', label: '14–21d', count: counts.warn14 },
    { key: 'warn30', label: '21–25d', count: counts.warn30 },
    { key: 'inactive', label: '25d+', count: counts.inactive },
  ];

  return (
    <div>
      <PageHeader title="App Activity & Engagement" subtitle="Member activity levels and inactivity alerts" />

      <div style={{ padding: '0 24px 24px' }}>
        {/* Engagement score definition */}
        <OCard style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(180,148,42,0.07)', borderLeft: `4px solid ${brand.gold}` }}>
          <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: brand.gold, fontSize: 13 }}>How engagement is measured</strong><br />
            Each member receives a score (0–100) based on days since their last session:&nbsp;
            <strong style={{ color: brand.success }}>Active</strong> (≤7 days) ·&nbsp;
            <strong style={{ color: brand.textMuted }}>Warning</strong> (7–14 days) ·&nbsp;
            <strong style={{ color: brand.warning }}>Alert</strong> (14–21 days) ·&nbsp;
            <strong style={{ color: brand.danger }}>At Risk</strong> (21–25 days) ·&nbsp;
            <strong style={{ color: brand.danger }}>Inactive</strong> (25+ days).
            Members at Alert or At Risk are flagged for outreach.
          </div>
        </OCard>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Avg Engagement" value={`${avgEngagement}/100`} icon={Activity} color={avgEngagement >= 70 ? 'success' : avgEngagement >= 50 ? 'warning' : 'danger'} />
          <KPICard label="Active (≤7d)" value={String(counts.active)} icon={Users} color="success" />
          <KPICard label="Needs Outreach" value={String(inactiveCount)} icon={AlertTriangle} color={inactiveCount > 0 ? 'warning' : 'default'} />
          <KPICard label="Urgent Alerts" value={String(alertCount)} icon={TrendingUp} color={alertCount > 0 ? 'danger' : 'default'} />
        </div>

        {/* Inactivity alert callout */}
        {alertCount > 0 && (
          <OCard style={{ marginBottom: 20, borderLeft: `4px solid ${brand.danger}`, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={16} color={brand.danger} />
              <div style={{ flex: 1, fontSize: 13, color: brand.text }}>
                <strong style={{ color: brand.danger }}>{alertCount} member{alertCount !== 1 ? 's' : ''}</strong> {alertCount === 1 ? 'has' : 'have'} not been seen in 21+ days. Consider a personal call or re-engagement message.
              </div>
              <a href="/owner/at-risk" style={{ color: brand.goldDeep, fontSize: 12, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>View At-Risk →</a>
            </div>
          </OCard>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {filterBtns.map(b => (
            <button
              key={b.key}
              onClick={() => setFilter(b.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 20,
                border: `1px solid ${filter === b.key ? brand.goldDeep : brand.border}`,
                background: filter === b.key ? brand.goldDeep : brand.surface,
                color: filter === b.key ? brand.dark : brand.textMuted,
                fontFamily: fonts.display, fontWeight: 700, fontSize: 11,
                letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {b.label}
              <span style={{ background: filter === b.key ? `${brand.dark}33` : brand.surfaceAlt, borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                {b.count}
              </span>
            </button>
          ))}
        </div>

        <SectionHeader title={`Member Engagement (${filtered.length})`} />
        <OTable
          columns={columns}
          rows={filtered}
          onRowClick={row => row.href && (window.location.href = row.href)}
        />
      </div>
    </div>
  );
}
