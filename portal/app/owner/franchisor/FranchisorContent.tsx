'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, PageHeader, SectionHeader, OCard, OButton, Chip } from '@/components/owner/ui';
import { DollarSign, Users, TrendingUp, UserPlus, BarChart2, Trophy, ArrowUpDown } from 'lucide-react';
import type { FranchisorNetworkSummary, FranchisorLocationRow } from '@/lib/supabase/hqQueries';

type Tab = 'performance' | 'rankings';
type SortKey = 'mrr' | 'memberCount' | 'newMembersMtd' | 'collectedMtd' | 'closingRate';
type RankCategory = 'mrr' | 'newMembersMtd' | 'collectedMtd' | 'closingRate';

const fmtMoney = (v: number) =>
  v >= 1000
    ? `$${(v / 1000).toFixed(1)}K`
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

function RankBadge({ rank }: { rank: number }) {
  const color = rank === 1 ? brand.goldDeep : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : brand.textMuted;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 14,
      background: rank <= 3 ? `${color}22` : brand.surfaceAlt,
      border: `1px solid ${rank <= 3 ? color : brand.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 800, fontFamily: fonts.display, color,
    }}>
      {rank}
    </div>
  );
}

function PerformanceTable({ rows }: { rows: FranchisorLocationRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('mrr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
  }), [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const thStyle = (key: SortKey): React.CSSProperties => ({
    textAlign: key === 'mrr' ? 'left' : 'right',
    padding: '10px 14px',
    background: brand.surfaceAlt,
    color: sortKey === key ? brand.gold : brand.textMuted,
    borderBottom: `1px solid ${brand.border}`,
    fontFamily: fonts.display, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
  });

  const tdStyle = (right = false): React.CSSProperties => ({
    padding: '10px 14px', fontSize: 12, color: brand.text,
    fontFamily: right ? fonts.mono : fonts.body,
    textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap',
    borderBottom: `1px solid ${brand.border}`,
  });

  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${brand.border}`, borderRadius: 9 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle('mrr'), width: 32, paddingRight: 0 }}>#</th>
            <th style={thStyle('mrr')}>Location</th>
            {(['mrr', 'memberCount', 'newMembersMtd', 'collectedMtd', 'closingRate'] as SortKey[]).map(k => (
              <th key={k} style={thStyle(k)} onClick={() => toggleSort(k)}>
                {k === 'mrr' ? 'MRR' : k === 'memberCount' ? 'Members' : k === 'newMembersMtd' ? 'New (MTD)' : k === 'collectedMtd' ? 'Collected (MTD)' : 'Close %'}
                <ArrowUpDown size={9} style={{ marginLeft: 4, opacity: 0.5, verticalAlign: 'middle' }} />
              </th>
            ))}
            <th style={{ ...thStyle('mrr'), textAlign: 'right' }}>Profile</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.locationId} style={{ background: i % 2 === 0 ? 'transparent' : `${brand.surfaceAlt}55` }}>
              <td style={{ ...tdStyle(), paddingRight: 0 }}><RankBadge rank={i + 1} /></td>
              <td style={tdStyle()}>
                <div style={{ fontWeight: 700 }}>{row.locationName}</div>
                <div style={{ fontSize: 10, color: brand.textMuted }}>{row.tenantName}</div>
              </td>
              <td style={tdStyle(true)}>{fmtMoney(row.mrr)}</td>
              <td style={tdStyle(true)}>{row.memberCount.toLocaleString()}</td>
              <td style={tdStyle(true)}>{row.newMembersMtd > 0 ? `+${row.newMembersMtd}` : '—'}</td>
              <td style={tdStyle(true)}>{fmtMoney(row.collectedMtd)}</td>
              <td style={tdStyle(true)}>
                {row.closingRate != null
                  ? <Chip color={row.closingRate >= 50 ? 'success' : row.closingRate >= 25 ? 'warning' : 'danger'} size="sm">{row.closingRate}%</Chip>
                  : <span style={{ color: brand.textMuted }}>—</span>}
              </td>
              <td style={{ ...tdStyle(true) }}>
                <Link href={`/owner/franchisor/${row.locationId}`}>
                  <OButton variant="ghost" size="sm">View</OButton>
                </Link>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: brand.textMuted, fontSize: 13 }}>No locations found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardSection({ rows }: { rows: FranchisorLocationRow[] }) {
  const [category, setCategory] = useState<RankCategory>('mrr');

  const categories: Array<{ key: RankCategory; label: string; fmt: (r: FranchisorLocationRow) => string }> = [
    { key: 'mrr', label: 'MRR', fmt: r => fmtMoney(r.mrr) },
    { key: 'newMembersMtd', label: 'New Members (MTD)', fmt: r => `+${r.newMembersMtd}` },
    { key: 'collectedMtd', label: 'Collected (MTD)', fmt: r => fmtMoney(r.collectedMtd) },
    { key: 'closingRate', label: 'Closing Rate', fmt: r => r.closingRate != null ? `${r.closingRate}%` : '—' },
  ];

  const ranked = useMemo(() =>
    [...rows]
      .filter(r => category !== 'closingRate' || r.closingRate != null)
      .sort((a, b) => {
        const av = (a[category] ?? 0) as number;
        const bv = (b[category] ?? 0) as number;
        return bv - av;
      })
      .slice(0, 10),
    [rows, category],
  );

  const cat = categories.find(c => c.key === category)!;
  const maxVal = ranked[0] ? (ranked[0][category] ?? 0) as number : 1;

  return (
    <div>
      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {categories.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            style={{
              padding: '6px 16px', borderRadius: 20,
              border: `1px solid ${category === c.key ? brand.goldDeep : brand.border}`,
              background: category === c.key ? brand.goldDeep : brand.surface,
              color: category === c.key ? brand.dark : brand.textMuted,
              fontFamily: fonts.display, fontWeight: 700, fontSize: 11,
              letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <OCard style={{ padding: 0 }}>
        {ranked.map((row, i) => {
          const val = (row[category] ?? 0) as number;
          const barPct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
          return (
            <Link key={row.locationId} href={`/owner/franchisor/${row.locationId}`} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px',
                borderBottom: i < ranked.length - 1 ? `1px solid ${brand.border}` : 'none',
                cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = brand.surfaceAlt)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <RankBadge rank={i + 1} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: brand.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.locationName}
                      <span style={{ fontSize: 10, color: brand.textMuted, fontWeight: 400, marginLeft: 6 }}>{row.tenantName}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.mono, color: i === 0 ? brand.goldDeep : brand.text, flexShrink: 0 }}>
                      {cat.fmt(row)}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, height: 4, background: brand.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: i === 0 ? brand.goldDeep : brand.info, borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        {ranked.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: brand.textMuted, fontSize: 13 }}>No data available for this category.</div>
        )}
      </OCard>
    </div>
  );
}

export function FranchisorContent({ data }: { data: FranchisorNetworkSummary }) {
  const [tab, setTab] = useState<Tab>('performance');

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 18px', borderRadius: 20,
        border: `1px solid ${tab === t ? brand.goldDeep : brand.border}`,
        background: tab === t ? brand.goldDeep : brand.surface,
        color: tab === t ? brand.dark : brand.textMuted,
        fontFamily: fonts.display, fontWeight: 700, fontSize: 12,
        letterSpacing: 0.5, textTransform: 'uppercase' as const, cursor: 'pointer',
      }}
    >
      {icon}{label}
    </button>
  );

  const networkMrrFormatted = data.totalMrr >= 1000000
    ? `$${(data.totalMrr / 1000000).toFixed(2)}M`
    : fmtMoney(data.totalMrr);

  return (
    <div>
      <PageHeader
        title="Franchisor Dashboard"
        subtitle={`${data.locations.length} location${data.locations.length !== 1 ? 's' : ''} · Network overview`}
      />

      <div style={{ padding: '0 24px 24px' }}>
        {/* Network KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Network MRR" value={networkMrrFormatted} icon={DollarSign} color="gold" />
          <KPICard label="Total Members" value={data.totalMembers.toLocaleString()} icon={Users} />
          <KPICard label="New (MTD)" value={`+${data.totalNewMtd}`} icon={UserPlus} color={data.totalNewMtd > 0 ? 'success' : 'default'} />
          <KPICard label="Collected (MTD)" value={fmtMoney(data.totalCollectedMtd)} icon={TrendingUp} />
          <KPICard label="Locations" value={String(data.locations.length)} icon={BarChart2} />
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {tabBtn('performance', 'Performance', <BarChart2 size={13} />)}
          {tabBtn('rankings', 'Rankings', <Trophy size={13} />)}
        </div>

        {tab === 'performance' && (
          <div>
            <SectionHeader title="Location Performance Tracker" subtitle="Sortable by any column · Click View to open a location profile" />
            <PerformanceTable rows={data.locations} />
          </div>
        )}

        {tab === 'rankings' && (
          <div>
            <SectionHeader title="Leaderboards" subtitle="Top 10 by category · Click any location to open its profile" />
            <LeaderboardSection rows={data.locations} />
          </div>
        )}
      </div>
    </div>
  );
}
