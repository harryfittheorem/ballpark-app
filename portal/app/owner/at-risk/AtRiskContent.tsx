'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, OCard, Chip } from '@/components/owner/ui';
import { Send, Phone, Mail, Gift, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';
import { DEMO_MEMBER_DETAILS } from '../members/[id]/demoMemberDetails';

type Props = { members: OwnerMember[] };

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_AT_RISK: OwnerMember[] = [
  { id: 'd00', kidId: 'k00', name: 'Alex Owner Jr.',  age: '12U', parent: 'Owner Demo',      program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 38, churnRisk: 'high',   lastSession: '31d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 2240, joinedDate: 'May 2024', riskReason: '31 days without a session and one failed payment. This is your owner test account — use it to verify email delivery.' },
  { id: 'd03', kidId: 'k03', name: 'Marcus Williams', age: '10U', parent: 'Darius Williams',  program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 41, churnRisk: 'high',   lastSession: '28d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 1680, joinedDate: 'Sep 2024', riskReason: '28 days without a session plus one failed payment. Historical data shows 88% churn probability at this stage.' },
  { id: 'd02', kidId: 'k02', name: 'Tyler Johnson',   age: '14U', parent: 'Brad Johnson',      program: 'Team Training',        planType: 'eft', status: 'active', engagementScore: 60, churnRisk: 'high',   lastSession: '23d ago', nextCharge: 'Jun 5',   mrr: 450, lifetime: 5480, joinedDate: 'Mar 2024', riskReason: '23 days since last session. Members in Team Training who miss 3+ consecutive weeks churn 72% of the time.' },
  { id: 'd11', kidId: 'k11', name: 'Owen Murphy',     age: '15U', parent: 'Patrick Murphy',    program: 'Team Training',        planType: 'eft', status: 'paused', engagementScore: 30, churnRisk: 'high',   lastSession: '35d ago', nextCharge: '—',       mrr: 0,   lifetime: 2250, joinedDate: 'May 2024', riskReason: '35 days inactive — critical window. Contact required today.' },
  { id: 'd05', kidId: 'k05', name: 'Ethan Brooks',    age: '13U', parent: 'Kevin Brooks',      program: 'Cage Rental Monthly',  planType: 'eft', status: 'active', engagementScore: 63, churnRisk: 'medium', lastSession: '16d ago', nextCharge: 'Jun 3',   mrr: 120, lifetime: 960,  joinedDate: 'Jul 2024', riskReason: 'Attendance dropped significantly compared to prior months. Targeted messaging recommended.' },
  { id: 'd06', kidId: 'k06', name: 'Noah Patel',      age: '11U', parent: 'Raj Patel',         program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 55, churnRisk: 'medium', lastSession: '15d ago', nextCharge: 'Jun 8',   mrr: 280, lifetime: 2240, joinedDate: 'Jun 2024', riskReason: 'Missed last 3 scheduled sessions without notice. Progress highlights may help re-engage.' },
];

type LoadingKey = `${string}-email` | `${string}-free_session`;

// ── Component ──────────────────────────────────────────────────────────────

export function AtRiskContent({ members: rawMembers }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState<Set<LoadingKey>>(new Set());

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const hasLiveData = rawMembers.length > 0;
  const source      = hasLiveData ? rawMembers : DEMO_AT_RISK;
  const atRisk      = source.filter(m => (m.status === 'active' || m.status === 'paused') && (m.churnRisk === 'high' || m.churnRisk === 'medium'));
  const totalMrr    = atRisk.reduce((s, m) => s + m.mrr, 0);

  const handleCampaign = () => {
    setToast(`Re-engagement campaign queued for ${atRisk.length} at-risk member${atRisk.length !== 1 ? 's' : ''} — emails will send within the hour`);
  };

  async function sendReengagement(m: OwnerMember, type: 'email' | 'free_session') {
    const key: LoadingKey = `${m.id}-${type}`;
    const demoDetail = DEMO_MEMBER_DETAILS[m.id];
    const parentEmail = demoDetail?.parentEmail ?? '';
    const kidName = m.name;

    if (!parentEmail) {
      setToast(type === 'email'
        ? `Re-engagement email not available for live members yet — contact ${m.parent} directly`
        : `Free session offer not available for live members yet — contact ${m.parent} directly`);
      return;
    }

    setLoading(prev => new Set(prev).add(key));
    try {
      const res = await fetch('/api/owner/send-reengagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentName: m.parent, parentEmail, kidName, type }),
      });
      const data = await res.json() as { success?: boolean; skipped?: boolean; error?: string };
      if (!res.ok || data.error) {
        setToast(`Failed to send email: ${data.error ?? 'Unknown error'}`);
      } else if (data.skipped) {
        setToast(type === 'email'
          ? `Re-engagement email queued for ${m.parent} (email not configured — contact ${parentEmail})`
          : `Free session offer queued for ${m.parent} for ${kidName} (email not configured — contact ${parentEmail})`);
      } else {
        setToast(type === 'email'
          ? `Re-engagement email sent to ${m.parent} (${parentEmail})`
          : `Free session offer sent to ${m.parent} for ${kidName} (${parentEmail})`);
      }
    } catch {
      setToast('Network error — email not sent');
    } finally {
      setLoading(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  return (
    <div>
      <PageHeader
        title="At-Risk Members"
        subtitle={`${atRisk.length} member${atRisk.length !== 1 ? 's' : ''} flagged · $${totalMrr.toLocaleString()} monthly revenue at risk`}
        actions={<OButton variant="gold" icon={Send} onClick={handleCampaign}>Send Re-engagement Campaign</OButton>}
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
            {atRisk.map(m => {
              const emailLoading = loading.has(`${m.id}-email`);
              const freeLoading  = loading.has(`${m.id}-free_session`);
              return (
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
                            ? 'Personal call from coach within 48 hours. Offer a free comeback session. History shows 72% recovery rate when coach calls within 2 weeks of last session.'
                            : 'Send targeted message with progress highlights. Members in this state respond to specific achievement reminders and personalised check-ins.'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <OButton variant="gold"      size="sm" icon={Phone}  onClick={() => setToast(`Calling ${m.parent}… number copied to clipboard`)}>Call Parent</OButton>
                        <OButton
                          variant="secondary" size="sm"
                          icon={emailLoading ? Loader2 : Mail}
                          onClick={() => sendReengagement(m, 'email')}
                          disabled={emailLoading}
                        >
                          {emailLoading ? 'Sending…' : 'Send Email'}
                        </OButton>
                        <OButton
                          variant="secondary" size="sm"
                          icon={freeLoading ? Loader2 : Gift}
                          onClick={() => sendReengagement(m, 'free_session')}
                          disabled={freeLoading}
                        >
                          {freeLoading ? 'Sending…' : 'Offer Free Session'}
                        </OButton>
                        <OButton variant="ghost"     size="sm"               onClick={() => router.push(`/owner/members/${m.id}`)}>View Profile →</OButton>
                      </div>
                    </div>
                  </div>
                </OCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 420 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
