'use client';

import { useState } from 'react';
import { RetentionReportContent } from '@/components/owner/RetentionReportContent';
import type { RetentionDataset } from '@/lib/retention/types';
import type { LTVData } from '@/lib/supabase/ownerQueries';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { TrendingUp, Globe, MapPin, Info } from 'lucide-react';
import { PageHeader } from '@/components/owner/ui';

type Tab = 'location' | 'nationwide';

function LTVPanel({ ltv }: { ltv: LTVData }) {
  const fmtDollars = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);

  const tiles = [
    {
      label: 'Lifetime Value (LTV)',
      value: ltv.ltv != null ? `$${ltv.ltv.toLocaleString()}` : '—',
      sub: 'Avg tenure × avg MRR · cancelled members',
      accent: brand.goldDeep,
    },
    {
      label: 'Avg Tenure',
      value: ltv.avgTenureMonths != null ? `${ltv.avgTenureMonths} mo` : '—',
      sub: `Based on ${ltv.cancelledMemberCount} completed memberships`,
      accent: brand.info,
    },
    {
      label: 'Avg Monthly Revenue',
      value: ltv.avgMrrCents > 0 ? fmtDollars(ltv.avgMrrCents) : '—',
      sub: `Across ${ltv.activeMemberCount} active member${ltv.activeMemberCount !== 1 ? 's' : ''}`,
      accent: brand.success,
    },
  ];

  return (
    <section style={{ padding: '0 clamp(14px, 3vw, 30px)', maxWidth: 1500, margin: '0 auto 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        color: brand.gold, fontFamily: fonts.display, fontWeight: 700, fontSize: 12,
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        <TrendingUp size={15} />
        <span>Lifetime Value</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 8 }}>
        {tiles.map(t => (
          <div key={t.label} style={{
            background: brand.surface, border: `1px solid ${brand.border}`,
            borderTop: `2px solid ${t.accent}`, borderRadius: 12, padding: 18, minHeight: 110,
          }}>
            <div style={{ color: brand.textMuted, fontFamily: fonts.display, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{t.label}</div>
            <div style={{ color: brand.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 1.15, fontWeight: 700, marginTop: 12 }}>{t.value}</div>
            <div style={{ color: brand.textMuted, fontSize: 11, marginTop: 6 }}>{t.sub}</div>
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: brand.textMuted,
        background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, padding: '8px 12px',
      }}>
        <Info size={13} color={brand.info} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>LTV is calculated as average completed membership tenure (months) × average active member MRR. Only memberships with a recorded cancellation date are used for tenure. This is a gross revenue estimate, not net of fees.</span>
      </div>
    </section>
  );
}

type Props = {
  data: RetentionDataset;
  ltvData: LTVData;
  networkData: RetentionDataset | null;
};

export function RetentionContent({ data, ltvData, networkData }: Props) {
  const [tab, setTab] = useState<Tab>('location');

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
        letterSpacing: 0.5, textTransform: 'uppercase' as const,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader title="Member Retention" subtitle="Evidence-led lifecycle reporting" />

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 10, padding: '12px clamp(14px, 3vw, 30px) 0', maxWidth: 1500, margin: '0 auto' }}>
        {tabBtn('location', 'My Location', <MapPin size={13} />)}
        {tabBtn('nationwide', 'Nationwide', <Globe size={13} />)}
      </div>

      {tab === 'location' && (
        <>
          <LTVPanel ltv={ltvData} />
          <RetentionReportContent data={data} mode="retention" showHeader={false} />
        </>
      )}

      {tab === 'nationwide' && (
        networkData ? (
          <RetentionReportContent data={networkData} mode="network" showHeader={false} />
        ) : (
          <div style={{ padding: 'clamp(14px, 3vw, 30px)', maxWidth: 800, margin: '0 auto' }}>
            <div style={{
              background: brand.surface, border: `1px solid ${brand.border}`,
              borderRadius: 12, padding: 32, textAlign: 'center',
            }}>
              <Globe size={36} color={brand.goldDeep} style={{ marginBottom: 16 }} />
              <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: brand.text, marginBottom: 8 }}>
                Network Access Required
              </div>
              <div style={{ fontSize: 13, color: brand.textMuted, lineHeight: 1.65, maxWidth: 400, margin: '0 auto' }}>
                Nationwide churn and LTV analytics are available to network administrators. Contact Infinite Hitting corporate to request access.
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
