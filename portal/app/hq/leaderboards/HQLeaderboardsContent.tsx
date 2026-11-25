'use client';

import { useState, type ElementType } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { TrendingUp, Users, DollarSign, Star, CheckSquare, MessageSquare } from 'lucide-react';

type Metric = 'mrr' | 'members' | 'newMembers' | 'closingRate' | 'retention' | 'checklist' | 'reviews';

interface Location {
  rank: number;
  name: string;
  region: string;
  mrr: number;
  members: number;
  newMembers: number;
  closingRate: number;
  retention: number;
  checklist: number;
  reviews: number;
}

const LOCATIONS: Location[] = [
  { rank: 1,  name: 'Chicago — Lincoln Park',   region: 'Midwest',   mrr: 97400,  members: 162, newMembers: 14, closingRate: 74, retention: 94, checklist: 98, reviews: 4.9 },
  { rank: 2,  name: 'Dallas — Frisco',           region: 'South',     mrr: 88200,  members: 148, newMembers: 11, closingRate: 68, retention: 91, checklist: 95, reviews: 4.8 },
  { rank: 3,  name: 'Atlanta — Alpharetta',      region: 'Southeast', mrr: 76500,  members: 134, newMembers: 9,  closingRate: 65, retention: 90, checklist: 92, reviews: 4.7 },
  { rank: 4,  name: 'Houston — Sugar Land',      region: 'South',     mrr: 71200,  members: 126, newMembers: 8,  closingRate: 62, retention: 88, checklist: 89, reviews: 4.6 },
  { rank: 5,  name: 'Phoenix — Scottsdale',      region: 'West',      mrr: 65800,  members: 118, newMembers: 7,  closingRate: 59, retention: 87, checklist: 91, reviews: 4.8 },
  { rank: 6,  name: 'Nashville — Brentwood',     region: 'South',     mrr: 61400,  members: 109, newMembers: 6,  closingRate: 57, retention: 85, checklist: 86, reviews: 4.5 },
  { rank: 7,  name: 'Denver — Highlands Ranch',  region: 'West',      mrr: 58900,  members: 103, newMembers: 6,  closingRate: 55, retention: 84, checklist: 88, reviews: 4.6 },
  { rank: 8,  name: 'Tampa — Westchase',         region: 'Southeast', mrr: 54300,  members: 97,  newMembers: 5,  closingRate: 52, retention: 82, checklist: 83, reviews: 4.4 },
  { rank: 9,  name: 'Charlotte — Ballantyne',    region: 'Southeast', mrr: 49800,  members: 89,  newMembers: 4,  closingRate: 50, retention: 81, checklist: 79, reviews: 4.3 },
  { rank: 10, name: 'Columbus — Dublin',         region: 'Midwest',   mrr: 44200,  members: 82,  newMembers: 3,  closingRate: 48, retention: 79, checklist: 76, reviews: 4.2 },
  { rank: 11, name: 'Raleigh — Cary',            region: 'Southeast', mrr: 39600,  members: 74,  newMembers: 3,  closingRate: 44, retention: 77, checklist: 74, reviews: 4.1 },
  { rank: 12, name: 'Indianapolis — Carmel',     region: 'Midwest',   mrr: 35100,  members: 66,  newMembers: 2,  closingRate: 41, retention: 74, checklist: 70, reviews: 4.0 },
];

const METRICS: { key: Metric; label: string; icon: ElementType; fmt: (v: number) => string }[] = [
  { key: 'mrr',         label: 'Monthly Revenue (MRR)',       icon: DollarSign,  fmt: v => `$${v.toLocaleString()}` },
  { key: 'members',     label: 'Active Members',              icon: Users,       fmt: v => String(v) },
  { key: 'newMembers',  label: 'New Members MTD',             icon: TrendingUp,  fmt: v => String(v) },
  { key: 'closingRate', label: 'Eval Closing Rate (%)',        icon: TrendingUp,  fmt: v => `${v}%` },
  { key: 'retention',   label: 'Retention Rate (%)',          icon: Star,        fmt: v => `${v}%` },
  { key: 'checklist',   label: 'Daily Checklist Completion (%)', icon: CheckSquare, fmt: v => `${v}%` },
  { key: 'reviews',     label: 'Avg Google Rating',           icon: MessageSquare, fmt: v => v.toFixed(1) },
];

function medal(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

export function HQLeaderboardsContent() {
  const [metric, setMetric] = useState<Metric>('mrr');

  const metaObj = METRICS.find(m => m.key === metric)!;

  const sorted = [...LOCATIONS].sort((a, b) => b[metric] - a[metric]).map((l, i) => ({ ...l, rank: i + 1 }));

  const networkAvg = {
    mrr: Math.round(LOCATIONS.reduce((s, l) => s + l.mrr, 0) / LOCATIONS.length),
    members: Math.round(LOCATIONS.reduce((s, l) => s + l.members, 0) / LOCATIONS.length),
    newMembers: Math.round(LOCATIONS.reduce((s, l) => s + l.newMembers, 0) / LOCATIONS.length),
    closingRate: Math.round(LOCATIONS.reduce((s, l) => s + l.closingRate, 0) / LOCATIONS.length),
    retention: Math.round(LOCATIONS.reduce((s, l) => s + l.retention, 0) / LOCATIONS.length),
    checklist: Math.round(LOCATIONS.reduce((s, l) => s + l.checklist, 0) / LOCATIONS.length),
    reviews: parseFloat((LOCATIONS.reduce((s, l) => s + l.reviews, 0) / LOCATIONS.length).toFixed(1)),
  };

  return (
    <div style={{ padding: 28, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 800, color: brand.text, margin: '0 0 4px' }}>
          Network Leaderboards
        </h1>
        <p style={{ color: brand.textMuted, fontSize: 13, margin: 0 }}>
          {LOCATIONS.length} locations ranked by performance metric
        </p>
      </div>

      {/* KPI summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {([
          { label: 'Network MRR', value: `$${LOCATIONS.reduce((s, l) => s + l.mrr, 0).toLocaleString()}`, icon: DollarSign as ElementType },
          { label: 'Total Members', value: String(LOCATIONS.reduce((s, l) => s + l.members, 0)), icon: Users as ElementType },
          { label: 'Avg Retention', value: `${networkAvg.retention}%`, icon: Star as ElementType },
          { label: 'Avg Closing Rate', value: `${networkAvg.closingRate}%`, icon: TrendingUp as ElementType },
        ] as { label: string; value: string; icon: ElementType }[]).map(k => (
          <div key={k.label} style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.gold}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={16} color={brand.goldDeep} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display, color: brand.text }}>{k.value}</div>
              <div style={{ fontSize: 11, color: brand.textMuted }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              fontFamily: fonts.display, letterSpacing: 0.4, cursor: 'pointer',
              background: metric === m.key ? brand.goldDeep : brand.surface,
              color: metric === m.key ? brand.darker : brand.textMuted,
              border: `1px solid ${metric === m.key ? brand.goldDeep : brand.border}`,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div style={{ background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, overflow: 'hidden' }}>
        {/* Network avg banner */}
        <div style={{ padding: '10px 20px', background: `${brand.gold}10`, borderBottom: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: brand.textMuted }}>
          <Star size={13} color={brand.goldDeep} />
          <span>Network average — <strong style={{ color: brand.gold }}>{metaObj.fmt(networkAvg[metric])}</strong></span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
              {['Rank', 'Location', 'Region', metaObj.label, 'vs Avg'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: fonts.display }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((loc, i) => {
              const val = loc[metric];
              const avg = networkAvg[metric];
              const diff = val - avg;
              const pct = avg > 0 ? Math.round((diff / avg) * 100) : 0;
              const isAbove = diff >= 0;
              return (
                <tr key={loc.name} style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${brand.border}` : 'none', background: loc.rank <= 3 ? `${brand.gold}06` : 'transparent' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 15, width: 60, textAlign: 'center' }}>{medal(loc.rank)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: brand.text }}>{loc.name}</td>
                  <td style={{ padding: '12px 16px', color: brand.textMuted, fontSize: 12 }}>{loc.region}</td>
                  <td style={{ padding: '12px 16px', fontFamily: fonts.mono, fontWeight: 700, color: brand.gold }}>{metaObj.fmt(val)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isAbove ? brand.success : brand.danger }}>
                      {isAbove ? '+' : ''}{pct}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
