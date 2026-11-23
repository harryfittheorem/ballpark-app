'use client';

import { useState } from 'react';
import Link from 'next/link';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, Chip } from '@/components/owner/ui';
import { DollarSign, Users, TrendingUp, ArrowLeft, MessageCircle, FileText, CheckCircle2, Info } from 'lucide-react';
import type { FranchisorLocationRow } from '@/lib/supabase/hqQueries';

const fmtMoney = (v: number) =>
  v >= 1000
    ? `$${(v / 1000).toFixed(1)}K`
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

type Props = {
  location: FranchisorLocationRow;
  rank: number;
  totalLocations: number;
  networkAvgMrr: number;
  networkAvgMembers: number;
};

export function LocationProfileContent({ location: l, rank, totalLocations, networkAvgMrr, networkAvgMembers }: Props) {
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<Array<{ text: string; ts: string }>>([]);

  const mrrVsNetwork = networkAvgMrr > 0
    ? Math.round(((l.mrr - networkAvgMrr) / networkAvgMrr) * 100)
    : 0;
  const membersVsNetwork = networkAvgMembers > 0
    ? Math.round(((l.memberCount - networkAvgMembers) / networkAvgMembers) * 100)
    : 0;

  function addNote() {
    if (!noteText.trim()) return;
    setNotes(prev => [{ text: noteText.trim(), ts: new Date().toLocaleString() }, ...prev]);
    setNoteText('');
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Network → Locations"
        title={l.locationName}
        subtitle={`${l.tenantName} · ${l.memberCount} members · Ranked #${rank} of ${totalLocations} in network`}
        actions={
          <>
            <Link href="/owner/franchisor"><OButton variant="ghost" size="sm" icon={ArrowLeft}>Back</OButton></Link>
            <OButton variant="secondary" icon={MessageCircle}>Contact Owner</OButton>
            <OButton variant="gold" icon={FileText}>Generate Review</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard
            label="MRR"
            value={fmtMoney(l.mrr)}
            delta={mrrVsNetwork}
            deltaLabel="vs network avg"
            icon={DollarSign}
            color="gold"
          />
          <KPICard
            label="Active Members"
            value={l.memberCount.toLocaleString()}
            delta={membersVsNetwork}
            deltaLabel="vs network avg"
            icon={Users}
          />
          <KPICard
            label="New (MTD)"
            value={`+${l.newMembersMtd}`}
            icon={TrendingUp}
            color={l.newMembersMtd > 0 ? 'success' : 'default'}
          />
          <KPICard
            label="Royalty (MTD)"
            value={fmtMoney(l.royaltyMtd)}
            icon={DollarSign}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* MTD Performance */}
            <div>
              <SectionHeader title="Month-to-Date Performance" />
              <OCard>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Collected', value: fmtMoney(l.collectedMtd) },
                    { label: 'Leads', value: l.leadsMtd > 0 ? String(l.leadsMtd) : '—' },
                    { label: 'Closing Rate', value: l.closingRate != null ? `${l.closingRate}%` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: '10px 0' }}>
                      <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, color: brand.text }}>{value}</div>
                    </div>
                  ))}
                </div>
              </OCard>
            </div>

            {/* Network comparison */}
            <div>
              <SectionHeader title="vs Network Average" />
              <OCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'MRR', thisVal: fmtMoney(l.mrr), networkVal: fmtMoney(networkAvgMrr), delta: mrrVsNetwork },
                    { label: 'Members', thisVal: l.memberCount.toLocaleString(), networkVal: Math.round(networkAvgMembers).toLocaleString(), delta: membersVsNetwork },
                  ].map(({ label, thisVal, networkVal, delta }, i, arr) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12, alignItems: 'center', paddingBottom: i < arr.length - 1 ? 14 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                      <div>
                        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display }}>{thisVal}</div>
                        <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 1 }}>This location</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Network avg</div>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, color: brand.textMuted }}>{networkVal}</div>
                      </div>
                      <Chip color={delta >= 10 ? 'success' : delta >= 0 ? 'default' : delta >= -10 ? 'warning' : 'danger'} size="sm">
                        {delta >= 0 ? '+' : ''}{delta}%
                      </Chip>
                    </div>
                  ))}
                </div>
              </OCard>
            </div>

            {/* Call notes */}
            <div>
              <SectionHeader title="Call Notes & Actions" />
              <OCard>
                <textarea
                  placeholder="Add a call note or action item…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', border: `1px solid ${brand.border}`,
                    borderRadius: 8, fontSize: 13, color: brand.text, background: brand.surfaceAlt,
                    fontFamily: fonts.body, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <OButton variant="gold" size="sm" onClick={addNote}>Save Note</OButton>
                </div>
                {notes.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {notes.map((n, i) => (
                      <div key={i} style={{ padding: '10px 12px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}` }}>
                        <div style={{ fontSize: 12, color: brand.text, lineHeight: 1.5 }}>{n.text}</div>
                        <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 4 }}>{n.ts}</div>
                      </div>
                    ))}
                  </div>
                )}
                {notes.length === 0 && (
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 12, fontSize: 11, color: brand.textMuted }}>
                    <Info size={12} />
                    <span>Notes are session-only until a persistent notes API is connected.</span>
                  </div>
                )}
              </OCard>
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Network rank */}
            <div>
              <SectionHeader title="Network Rank" />
              <OCard style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Overall Rank</div>
                <div style={{ fontSize: 48, fontWeight: 700, fontFamily: fonts.display, color: rank <= 3 ? brand.goldDeep : brand.text, lineHeight: 1 }}>
                  #{rank}
                </div>
                <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>of {totalLocations} locations</div>
                <div style={{ marginTop: 10, fontSize: 10, color: brand.textMuted, lineHeight: 1.5 }}>
                  Ranked by MRR. Click Rankings on the network dashboard for other categories.
                </div>
              </OCard>
            </div>

            {/* Revenue breakdown */}
            <div>
              <SectionHeader title="Revenue Breakdown" />
              <OCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Monthly MRR', value: fmtMoney(l.mrr) },
                    { label: 'MTD Collected', value: fmtMoney(l.collectedMtd) },
                    { label: `Royalty (${Math.round(l.royaltyRate * 100)}%)`, value: fmtMoney(l.royaltyMtd) },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                      <div style={{ fontSize: 12, color: brand.textMuted }}>{row.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </OCard>
            </div>

            {/* Compliance checklist */}
            <div>
              <SectionHeader title="Compliance" />
              <OCard>
                {[
                  { label: 'Stripe Connected', pass: true },
                  { label: 'Monthly reporting', pass: true },
                  { label: 'Royalty current', pass: l.royaltyMtd > 0 },
                  { label: 'Active membership base', pass: l.memberCount > 0 },
                ].map((c, i, arr) => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    <CheckCircle2 size={14} color={c.pass ? brand.success : brand.textMuted} />
                    <div style={{ flex: 1, fontSize: 12 }}>{c.label}</div>
                    <Chip color={c.pass ? 'success' : 'warning'} size="sm">{c.pass ? 'OK' : 'Review'}</Chip>
                  </div>
                ))}
              </OCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
