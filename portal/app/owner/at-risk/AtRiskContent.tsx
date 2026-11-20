'use client';
import { PlayerLink } from '@/components/owner/PlayerLink';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, OCard, Chip } from '@/components/owner/ui';
import { Send, Phone, Mail, Gift, Sparkles, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';

type Props = { members: OwnerMember[] };

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_AT_RISK: OwnerMember[] = [
  { id: 'd00', kidId: 'k00', name: 'Alex Owner Jr.',  age: '12U', parent: 'Owner Demo',      parentEmail: 'owner@example.com',    parentPhone: '555-100-0000', program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 38, churnRisk: 'high',   lastSession: '31d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 2240, joinedDate: 'May 2024', riskReason: 'No session in 31 days · Last payment failed — Insufficient funds. Call within 48 hours.',   cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd03', kidId: 'k03', name: 'Marcus Williams', age: '10U', parent: 'Darius Williams',  parentEmail: 'darius@example.com',   parentPhone: '555-100-0003', program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 41, churnRisk: 'high',   lastSession: '28d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 1680, joinedDate: 'Sep 2024', riskReason: 'No session in 28 days · Last payment failed — Card expired. Call within 48 hours.',            cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd02', kidId: 'k02', name: 'Tyler Johnson',   age: '14U', parent: 'Brad Johnson',      parentEmail: 'brad@example.com',     parentPhone: '555-100-0002', program: 'Team Training',        planType: 'eft', status: 'active', engagementScore: 60, churnRisk: 'high',   lastSession: '23d ago', nextCharge: 'Jun 5',   mrr: 450, lifetime: 5480, joinedDate: 'Mar 2024', riskReason: '23 days since last session. Members in Team Training who miss 3+ consecutive weeks churn 72% of the time.',             cardLast4: '5555', cardBrand: 'Mastercard', cardExpMonth: 6,    cardExpYear: 2028 },
  { id: 'd11', kidId: 'k11', name: 'Owen Murphy',     age: '15U', parent: 'Patrick Murphy',    parentEmail: 'patrick@example.com',  parentPhone: '555-100-0011', program: 'Team Training',        planType: 'eft', status: 'paused', engagementScore: 30, churnRisk: 'high',   lastSession: '35d ago', nextCharge: '—',       mrr: 0,   lifetime: 2250, joinedDate: 'May 2024', riskReason: '35 days inactive — critical window. Contact required today.',                                                               cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd05', kidId: 'k05', name: 'Ethan Brooks',    age: '13U', parent: 'Kevin Brooks',      parentEmail: 'kevin@example.com',    parentPhone: '555-100-0005', program: 'Cage Rental Monthly',  planType: 'eft', status: 'active', engagementScore: 63, churnRisk: 'medium', lastSession: '16d ago', nextCharge: 'Jun 3',   mrr: 120, lifetime: 960,  joinedDate: 'Jul 2024', riskReason: 'Attendance dropped significantly compared to prior months. Targeted messaging recommended.',                               cardLast4: '4444', cardBrand: 'Mastercard', cardExpMonth: 8,    cardExpYear: 2027 },
  { id: 'd06', kidId: 'k06', name: 'Noah Patel',      age: '11U', parent: 'Raj Patel',         parentEmail: 'raj@example.com',      parentPhone: '555-100-0006', program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 55, churnRisk: 'medium', lastSession: '15d ago', nextCharge: 'Jun 8',   mrr: 280, lifetime: 2240, joinedDate: 'Jun 2024', riskReason: 'Missed last 3 scheduled sessions without notice. Progress highlights may help re-engage.',                               cardLast4: '1234', cardBrand: 'Visa',       cardExpMonth: 11,   cardExpYear: 2026 },
];


type LoadingKey = `${string}-email` | `${string}-free_session`;

type CampaignState =
  | { status: 'idle' }
  | { status: 'sending'; sent: number; total: number }
  | { status: 'done'; succeeded: number; skipped: number; failed: number; notConfigured: boolean };

// ── Component ──────────────────────────────────────────────────────────────

export function AtRiskContent({ members: rawMembers }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState<Set<LoadingKey>>(new Set());
  const [campaign, setCampaign] = useState<CampaignState>({ status: 'idle' });

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }
  }, [toast]);

  const atRisk = rawMembers.filter(
    m => (m.status === 'active' || m.status === 'at-risk' || m.status === 'paused') &&
         (m.churnRisk === 'high' || m.churnRisk === 'medium'),
  );
  const totalMrr = atRisk.reduce((s, m) => s + m.mrr, 0);

  const handleCampaign = async () => {
    const withEmail = atRisk.filter(m => m.parentEmail);
    if (withEmail.length === 0) {
      setToast('No at-risk members have an email address on file');
      return;
    }

    setCampaign({ status: 'sending', sent: 0, total: withEmail.length });

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    let notConfigured = false;

    for (let i = 0; i < withEmail.length; i++) {
      const m = withEmail[i];
      setCampaign({ status: 'sending', sent: i, total: withEmail.length });
      try {
        const res = await fetch('/api/owner/send-reengagement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentName: m.parent, parentEmail: m.parentEmail, kidName: m.name, type: 'email' }),
        });
        const data = await res.json() as { success?: boolean; skipped?: boolean; error?: string };
        if (!res.ok || data.error) {
          failed++;
        } else if (data.skipped) {
          skipped++;
          notConfigured = true;
        } else {
          succeeded++;
        }
      } catch {
        failed++;
      }
    }

    setCampaign({ status: 'done', succeeded, skipped, failed, notConfigured });
  };

  const dismissCampaignResult = () => setCampaign({ status: 'idle' });

  async function sendReengagement(m: OwnerMember, type: 'email' | 'free_session') {
    const key: LoadingKey = `${m.id}-${type}`;
    const parentEmail = m.parentEmail;

    if (!parentEmail) {
      setToast(`No email on file for ${m.parent} — contact them directly`);
      return;
    }

    setLoading(prev => new Set(prev).add(key));
    try {
      const res = await fetch('/api/owner/send-reengagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentName: m.parent, parentEmail, kidName: m.name, type }),
      });
      const data = await res.json() as { success?: boolean; skipped?: boolean; error?: string };
      if (!res.ok || data.error) {
        setToast(`Failed to send email: ${data.error ?? 'Unknown error'}`);
      } else if (data.skipped) {
        setToast(`Email not configured — contact your admin to set up Resend (${parentEmail})`);
      } else {
        setToast(type === 'email'
          ? `Re-engagement email sent to ${m.parent} (${parentEmail})`
          : `Free session offer sent to ${m.parent} for ${m.name} (${parentEmail})`);
      }
    } catch {
      setToast('Network error — email not sent');
    } finally {
      setLoading(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  function copyPhone(m: OwnerMember) {
    const phone = m.parentPhone;
    if (!phone) {
      setToast(`No phone number on file for ${m.parent}`);
      return;
    }
    navigator.clipboard.writeText(phone).then(() => {
      setToast(`${m.parent}'s number copied: ${phone}`);
    }).catch(() => {
      setToast(`Phone: ${phone}`);
    });
  }

  const campaignIsSending = campaign.status === 'sending';


  return (
    <div>
      <PageHeader
        title="At-Risk Members"
        subtitle={`${atRisk.length} member${atRisk.length !== 1 ? 's' : ''} flagged · $${totalMrr.toLocaleString()} monthly revenue at risk`}
        actions={
          <OButton
            variant="gold"
            icon={campaignIsSending ? Loader2 : Send}
            onClick={handleCampaign}
            disabled={campaignIsSending}
          >
            {campaignIsSending
              ? `Sending ${campaign.sent + 1} of ${campaign.total}…`
              : 'Send Re-engagement Campaign'}
          </OButton>
        }
      />

      {/* Campaign result banner */}
      {campaign.status === 'done' && (
        <div style={{ margin: '0 24px', padding: '12px 16px', background: campaign.notConfigured ? `${brand.warning}22` : campaign.failed > 0 ? `${brand.danger}22` : `${brand.success}22`, border: `1px solid ${campaign.notConfigured ? brand.warning : campaign.failed > 0 ? brand.danger : brand.success}44`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          {campaign.notConfigured
            ? <AlertCircle size={16} color={brand.warning} />
            : <CheckCircle2 size={16} color={campaign.failed > 0 ? brand.danger : brand.success} />}
          <div style={{ flex: 1, fontSize: 13 }}>
            {campaign.notConfigured
              ? <><strong>Email not configured</strong> — contact your admin to set up Resend. {campaign.succeeded} sent, {campaign.skipped} skipped.</>
              : <>Campaign complete — <strong>{campaign.succeeded} sent</strong>{campaign.failed > 0 ? `, ${campaign.failed} failed` : ''}{campaign.skipped > 0 ? `, ${campaign.skipped} skipped (no email)` : ''}.</>}
          </div>
          <button onClick={dismissCampaignResult} style={{ background: 'none', border: 'none', cursor: 'pointer', color: brand.textMuted, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div style={{ padding: 24 }}>
        {atRisk.length === 0 ? (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <CheckCircle2 size={48} color={brand.success} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>No at-risk members — keep it up!</div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>Every active member has engaged within the last 21 days and has no failed payments.</div>
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
                            <div style={{ fontSize: 15, fontWeight: 700 }}><PlayerLink name={m.name} reference={{ kidId: m.kidId, membershipId: m.id }} /></div>
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
                            ? 'Personal call from coach within 48 hours. Offer a free comeback session to get them back on the field.'
                            : 'Send a targeted message with progress highlights. A personalised check-in now can prevent escalation.'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <OButton variant="gold" size="sm" icon={Phone} onClick={() => copyPhone(m)}>Call Parent</OButton>
                        <OButton
                          variant="secondary" size="sm"
                          icon={emailLoading ? Loader2 : Mail}
                          onClick={() => sendReengagement(m, 'email')}
                          disabled={emailLoading || campaignIsSending}
                        >
                          {emailLoading ? 'Sending…' : 'Send Email'}
                        </OButton>
                        <OButton
                          variant="secondary" size="sm"
                          icon={freeLoading ? Loader2 : Gift}
                          onClick={() => sendReengagement(m, 'free_session')}
                          disabled={freeLoading || campaignIsSending}
                        >
                          {freeLoading ? 'Sending…' : 'Offer Free Session'}
                        </OButton>
                        <OButton variant="ghost" size="sm" onClick={() => router.push(`/owner/members/${m.id}`)}>View Profile →</OButton>
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
