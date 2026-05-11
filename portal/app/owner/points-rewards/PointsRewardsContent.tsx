'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Plus, Sparkles, Edit2 } from 'lucide-react';
import type { PointsRewardsData, PointsProduct } from '@/lib/supabase/ownerQueries';

const POINTS_RULES = [
  { id: 1, action: 'Complete a booked session', points: 10 },
  { id: 2, action: 'Submit drill homework', points: 25 },
  { id: 3, action: 'Coach reviews homework (bonus)', points: 10 },
  { id: 4, action: 'Upload swing for coach feedback', points: 15 },
  { id: 5, action: 'Login streak (daily)', points: 5 },
  { id: 6, action: 'Unlock an achievement', points: 50 },
];

const rewardColumns: TableColumn<PointsProduct & Record<string, unknown>>[] = [
  {
    label: 'Reward', key: 'name',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={16} color={brand.goldDeep} />
        </div>
        <div style={{ fontWeight: 700 }}>{r.name as string}</div>
      </div>
    ),
  },
  { label: 'Category', key: 'category', render: (r) => <Chip color="gold">{r.category as string}</Chip> },
  { label: 'Cost', key: 'cost', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep }}>{r.cost as number} pts</span> },
  { label: 'Inventory', key: 'inventory', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.inventory !== null ? String(r.inventory) : '∞'}</span> },
  { label: 'Fulfilled', key: 'fulfilled', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, color: brand.success, fontWeight: 700 }}>{r.fulfilled as number}</span> },
  { label: 'Pending', key: 'pending', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, color: (r.pending as number) > 0 ? brand.warning : brand.textMuted, fontWeight: 700 }}>{r.pending as number}</span> },
];

type Props = { data: PointsRewardsData };

export function PointsRewardsContent({ data }: Props) {
  const [tab, setTab] = useState<'rules' | 'rewards'>('rules');
  const { products, totalPointsIssued, topEarners } = data;

  return (
    <div>
      <PageHeader
        title="Points & Rewards"
        subtitle="Configure the points system that drives athlete engagement"
        actions={
          <OButton variant="gold" icon={Plus}>{tab === 'rules' ? 'Add Rule' : 'Add Reward'}</OButton>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { id: 'rules' as const, label: 'Earning Rules', count: POINTS_RULES.length },
            { id: 'rewards' as const, label: 'Rewards Catalog', count: products.length },
          ].map(t => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: tab === t.id ? brand.dark : brand.surface,
                color: tab === t.id ? brand.gold : brand.textMuted,
                border: `1px solid ${tab === t.id ? brand.dark : brand.border}`,
                cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
              }}
            >
              {t.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{t.count}</span>
            </div>
          ))}
        </div>

        {tab === 'rules' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <OCard padding={0}>
              {POINTS_RULES.map((r, i, arr) => (
                <div key={r.id} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={16} color={brand.goldDeep} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.action}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Active · auto-awarded</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>POINTS</div>
                    <div style={{ padding: '6px 14px', background: brand.dark, color: brand.gold, borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: fonts.display, minWidth: 50, textAlign: 'center' }}>+{r.points}</div>
                  </div>
                  <div style={{ width: 44, height: 24, borderRadius: 12, background: brand.success, position: 'relative', cursor: 'pointer' }}>
                    <div style={{ position: 'absolute', top: 2, left: 22, width: 20, height: 20, borderRadius: 10, background: brand.white, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                  <Edit2 size={14} color={brand.textMuted} style={{ cursor: 'pointer' }} />
                </div>
              ))}
            </OCard>

            <div>
              <SectionHeader title="Impact Preview" />
              <OCard>
                <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>TOTAL POINTS ISSUED</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display }}>{totalPointsIssued.toLocaleString()}</div>
                <div style={{ marginTop: 16, padding: 12, background: brand.infoBg, borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>
                  <strong>Changes take effect immediately</strong> for all members. Historical points aren&apos;t affected.
                </div>
              </OCard>

              {topEarners.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <SectionHeader title="Top Earners" />
                  <OCard>
                    {topEarners.map((e, i) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: i < topEarners.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 11, background: i === 0 ? brand.gold : brand.dark, color: i === 0 ? brand.dark : brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: fonts.display }}>{i + 1}</div>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{e.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono }}>{e.points} pts</div>
                      </div>
                    ))}
                  </OCard>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'rewards' && (
          products.length === 0 ? (
            <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
              <Sparkles size={40} color={brand.goldDeep} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>No rewards yet</div>
              <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>Add rewards in the mobile app admin panel to see them here.</div>
            </div>
          ) : (
            <OTable
              columns={rewardColumns as TableColumn<Record<string, unknown>>[]}
              rows={products as unknown as Record<string, unknown>[]}
            />
          )
        )}
      </div>
    </div>
  );
}
