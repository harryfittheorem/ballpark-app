'use client';

import { use } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, BarChart } from '@/components/owner/ui';
import { DollarSign, Users, TrendingUp, MessageCircle, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const locationId = parseInt(id, 10);
  const l = demoData.locations.find(loc => loc.id === locationId) ?? demoData.locations[0];
  const rank = demoData.locations.findIndex(loc => loc.id === locationId) + 1;

  return (
    <div>
      <PageHeader
        breadcrumb={`Network → ${l.name}`}
        title={l.name}
        subtitle={`Owned by ${l.owner} · ${l.members} members · Ranked #${rank} of ${demoData.locations.length} in network`}
        actions={
          <>
            <OButton variant="secondary" icon={MessageCircle}>Contact Owner</OButton>
            <OButton variant="gold" icon={FileText}>Generate Review</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="MRR" value={`$${(l.mrr / 1000).toFixed(1)}K`} delta={l.trend} icon={DollarSign} color="gold" />
          <KPICard label="Members" value={l.members} delta={4.2} icon={Users} />
          <KPICard label="Retention" value={`${l.retention}%`} delta={1.1} icon={TrendingUp} color={l.retention >= 88 ? 'success' : l.retention >= 84 ? 'warning' : 'danger'} />
          <KPICard label="Royalty (mo)" value={`$${Math.round(l.mrr * 0.07 / 100) * 100}`} icon={DollarSign} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <SectionHeader title="Revenue Trend (6 mo)" />
            <OCard>
              <BarChart data={[
                { label: 'May', value: Math.round(l.mrr * 0.74 / 1000) },
                { label: 'Jun', value: Math.round(l.mrr * 0.78 / 1000) },
                { label: 'Jul', value: Math.round(l.mrr * 0.82 / 1000) },
                { label: 'Aug', value: Math.round(l.mrr * 0.88 / 1000) },
                { label: 'Sep', value: Math.round(l.mrr * 0.94 / 1000) },
                { label: 'Oct', value: Math.round(l.mrr / 1000), highlight: true },
              ]} height={180} />
            </OCard>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Member Engagement vs Network" />
              <OCard>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {[
                    { label: 'APP OPEN RATE', value: `${Math.round(l.retention * 0.96)}%`, meta: `+${(l.retention * 0.04).toFixed(0)}% vs network`, positive: l.retention > 85 },
                    { label: 'HOMEWORK DONE', value: `${Math.round(l.retention * 0.81)}%`, meta: '+8% vs network', positive: true },
                    { label: 'AVG SESSIONS/MO', value: (5.6 + l.trend * 0.1).toFixed(1), meta: `+${(l.trend * 0.1).toFixed(1)} vs network`, positive: l.trend > 0 },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>{s.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, marginTop: 6 }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: s.positive ? brand.success : brand.danger, fontWeight: 700, marginTop: 2 }}>{s.meta}</div>
                    </div>
                  ))}
                </div>
              </OCard>
            </div>
          </div>

          <div>
            <SectionHeader title="Compliance Status" />
            <OCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Brand standards audit', status: 'pass', date: 'Sep 15' },
                  { label: 'Monthly reporting', status: 'pass', date: 'On-time' },
                  { label: 'Royalty payments', status: 'pass', date: 'Current' },
                  { label: 'Insurance cert', status: l.churnRisk === 'high' ? 'warning' : 'pass', date: l.churnRisk === 'high' ? 'Expires in 45d' : 'All current' },
                  { label: 'Coach certifications', status: 'pass', date: 'All current' },
                ].map((c, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    {c.status === 'pass'
                      ? <CheckCircle2 size={14} color={brand.success} />
                      : <AlertCircle size={14} color={brand.warning} />
                    }
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 10, color: brand.textMuted }}>{c.date}</div>
                  </div>
                ))}
              </div>
            </OCard>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Network Rank" />
              <OCard>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>IN NETWORK</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, marginTop: 4, color: rank <= 3 ? brand.goldDeep : brand.text }}>
                  #{rank} <span style={{ fontSize: 14, color: brand.textMuted, fontWeight: 500 }}>of {demoData.locations.length}</span>
                </div>
                <div style={{ fontSize: 11, color: l.trend >= 0 ? brand.success : brand.danger, fontWeight: 700, marginTop: 4 }}>
                  {l.trend >= 0 ? '↑' : '↓'} {Math.abs(l.trend).toFixed(1)}% MoM trend
                </div>
                <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 10, lineHeight: 1.5 }}>
                  Ranked by composite score: MRR growth, retention, member engagement, and compliance.
                </div>
              </OCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
