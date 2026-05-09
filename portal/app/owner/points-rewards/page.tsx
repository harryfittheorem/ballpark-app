'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { OButton, PageHeader, SectionHeader, OCard, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Plus, Sparkles, Edit2 } from 'lucide-react';

type Reward = typeof demoData.rewardsCatalog[0];

const rewardColumns: TableColumn<Reward & Record<string, unknown>>[] = [
  {
    label: 'Reward', key: 'name',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={16} color={brand.goldDeep} />
        </div>
        <div style={{ fontWeight: 700 }}>{r.name}</div>
      </div>
    ),
  },
  { label: 'Category', key: 'category', render: (r) => <Chip color="gold">{r.category}</Chip> },
  { label: 'Cost', key: 'cost', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep }}>{r.cost} pts</span> },
  { label: 'Inventory', key: 'inventory', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.inventory}</span> },
  { label: 'Fulfilled', key: 'fulfilled', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, color: brand.success, fontWeight: 700 }}>{r.fulfilled}</span> },
  { label: 'Pending', key: 'pending', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, color: r.pending > 0 ? brand.warning : brand.textMuted, fontWeight: 700 }}>{r.pending}</span> },
];

export default function PointsRewardsPage() {
  const [tab, setTab] = useState<'rules' | 'rewards'>('rules');

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
            { id: 'rules' as const, label: 'Earning Rules', count: demoData.pointsRules.length },
            { id: 'rewards' as const, label: 'Rewards Catalog', count: demoData.rewardsCatalog.length },
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
              {demoData.pointsRules.map((r, i, arr) => (
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
                <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>AVG POINTS EARNED PER MEMBER / MONTH</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display }}>142</div>
                <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 4 }}>↑ 18% since points launch</div>
                <div style={{ marginTop: 16, padding: 12, background: brand.infoBg, borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>
                  <strong>Changes take effect immediately</strong> for all members. Historical points aren&apos;t affected.
                </div>
              </OCard>

              <div style={{ marginTop: 20 }}>
                <SectionHeader title="Top Earners This Month" />
                <OCard>
                  {['Jake Rodriguez', 'Noah Patel', 'Ethan Garcia', 'Jackson Hall'].map((n, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: i < 3 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 11, background: i === 0 ? brand.gold : brand.dark, color: i === 0 ? brand.dark : brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: fonts.display }}>{i + 1}</div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{n}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono }}>{[340, 295, 268, 244][i]} pts</div>
                    </div>
                  ))}
                </OCard>
              </div>
            </div>
          </div>
        )}

        {tab === 'rewards' && (
          <OTable
            columns={rewardColumns as TableColumn<Record<string, unknown>>[]}
            rows={demoData.rewardsCatalog as unknown as Record<string, unknown>[]}
          />
        )}
      </div>
    </div>
  );
}
