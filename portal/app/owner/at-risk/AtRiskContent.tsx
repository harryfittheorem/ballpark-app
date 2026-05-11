'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, OCard, Chip } from '@/components/owner/ui';
import { Send, Phone, Mail, Gift, Sparkles, CheckCircle2 } from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';

type Props = { members: OwnerMember[] };

export function AtRiskContent({ members }: Props) {
  const router = useRouter();
  const atRisk = members.filter(m => m.status === 'active' && (m.churnRisk === 'high' || m.churnRisk === 'medium'));
  const totalMrr = atRisk.reduce((s, m) => s + m.mrr, 0);

  return (
    <div>
      <PageHeader
        title="At-Risk Members"
        subtitle={`${atRisk.length} member${atRisk.length !== 1 ? 's' : ''} flagged · $${totalMrr.toLocaleString()} monthly revenue at risk`}
        actions={<OButton variant="gold" icon={Send}>Send Re-engagement Campaign</OButton>}
      />

      <div style={{ padding: 24 }}>
        {atRisk.length === 0 ? (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <CheckCircle2 size={48} color={brand.success} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>All members are engaged</div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>No members flagged as at-risk right now.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {atRisk.map(m => (
              <OCard key={m.id} style={{ borderLeft: `4px solid ${m.churnRisk === 'high' ? brand.danger : brand.warning}` }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, fontFamily: fonts.display, flexShrink: 0 }}>
                    {m.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                          <Chip color={m.churnRisk === 'high' ? 'danger' : 'warning'}>{m.churnRisk.toUpperCase()} RISK</Chip>
                        </div>
                        <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 4 }}>{m.age} · {m.program} · ${m.mrr}/mo · LTV ${m.lifetime.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>LAST SESSION</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: brand.danger, marginTop: 2 }}>{m.lastSession}</div>
                      </div>
                    </div>

                    {m.riskReason && (
                      <div style={{ padding: 10, background: brand.surfaceAlt, borderRadius: 8, marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>WHY FLAGGED</div>
                        <div style={{ fontSize: 12, lineHeight: 1.5 }}>{m.riskReason}</div>
                      </div>
                    )}

                    <div style={{ padding: 10, background: `${brand.gold}15`, borderRadius: 8, marginBottom: 12, border: `1px solid ${brand.goldDeep}33` }}>
                      <div style={{ fontSize: 10, color: brand.goldDeep, fontWeight: 700, letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={10} /> SUGGESTED ACTION
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                        {m.churnRisk === 'high'
                          ? 'Personal call from coach within 48 hours. Offer free comeback session. History suggests 72% recovery rate when coach calls within 2 weeks.'
                          : 'Targeted message with progress highlights. Members in similar state respond to specific achievement reminders.'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <OButton variant="gold" size="sm" icon={Phone}>Call Parent</OButton>
                      <OButton variant="secondary" size="sm" icon={Mail}>Send Email</OButton>
                      <OButton variant="secondary" size="sm" icon={Gift}>Offer Free Session</OButton>
                      <OButton variant="ghost" size="sm" onClick={() => router.push(`/owner/members/${m.id}`)}>View Profile →</OButton>
                    </div>
                  </div>
                </div>
              </OCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
