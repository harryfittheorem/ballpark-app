'use client';
import { PlayerLink } from '@/components/owner/PlayerLink';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, OCard, Chip } from '@/components/owner/ui';
import { Send, Phone, Mail, Gift, Sparkles, CheckCircle2, Loader2, AlertCircle, Smartphone, Trophy } from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';

type Props = { members: OwnerMember[] };


type LoadingKey = `${string}-email` | `${string}-free_session`;

type CampaignState =
  | { status: 'idle' }
  | { status: 'sending'; sent: number; total: number }
  | { status: 'done'; succeeded: number; skipped: number; failed: number; notConfigured: boolean };

// ── Component ──────────────────────────────────────────────────────────────

type GameStatsForm = {
  kidId: string;
  kidName: string;
  gameDate: string;
  opponent: string;
  result: '' | 'win' | 'loss' | 'tie' | 'scrimmage';
  atBats: string;
  hits: string;
  homeRuns: string;
  rbi: string;
  avgExitVelo: string;
  peakExitVelo: string;
  notes: string;
};

export function AtRiskContent({ members: rawMembers }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState<Set<LoadingKey>>(new Set());
  const [campaign, setCampaign] = useState<CampaignState>({ status: 'idle' });
  const [gameStatsModal, setGameStatsModal] = useState<null | GameStatsForm>(null);
  const [gameStatsSaving, setGameStatsSaving] = useState(false);

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

  function openGameStats(m: OwnerMember) {
    setGameStatsModal({
      kidId: m.kidId ?? m.id,
      kidName: m.name,
      gameDate: new Date().toISOString().slice(0, 10),
      opponent: '', result: '', atBats: '', hits: '', homeRuns: '', rbi: '',
      avgExitVelo: '', peakExitVelo: '', notes: '',
    });
  }

  async function saveGameStats() {
    if (!gameStatsModal) return;
    setGameStatsSaving(true);
    try {
      const res = await fetch('/api/owner/game-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kidId: gameStatsModal.kidId,
          gameDate: gameStatsModal.gameDate,
          opponent: gameStatsModal.opponent || undefined,
          result: gameStatsModal.result || undefined,
          atBats: gameStatsModal.atBats ? parseInt(gameStatsModal.atBats, 10) : undefined,
          hits: gameStatsModal.hits ? parseInt(gameStatsModal.hits, 10) : undefined,
          homeRuns: gameStatsModal.homeRuns ? parseInt(gameStatsModal.homeRuns, 10) : undefined,
          rbi: gameStatsModal.rbi ? parseInt(gameStatsModal.rbi, 10) : undefined,
          avgExitVelo: gameStatsModal.avgExitVelo ? parseFloat(gameStatsModal.avgExitVelo) : undefined,
          peakExitVelo: gameStatsModal.peakExitVelo ? parseFloat(gameStatsModal.peakExitVelo) : undefined,
          notes: gameStatsModal.notes || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        setToast(`Game stats logged for ${gameStatsModal.kidName}`);
        setGameStatsModal(null);
      } else {
        setToast(`Error: ${data.error ?? 'Failed to save'}`);
      }
    } catch {
      setToast('Network error — could not save game stats');
    } finally {
      setGameStatsSaving(false);
    }
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

      <div style={{ padding: '12px 24px 0' }}>
        <details style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 10, marginBottom: 16 }}>
          <summary style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: brand.gold, fontFamily: fonts.display, letterSpacing: 0.5, listStyle: 'none', userSelect: 'none' }}>
            At-Risk criteria &amp; triggers
          </summary>
          <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 12 }}>
            {[
              { label: 'No session in 14+ days', risk: 'High', detail: 'Member has not attended a session for 14 or more calendar days. Contact required within 48 hours.' },
              { label: 'Account paused', risk: 'High', detail: 'Membership is in a pause/hold state. Paused members cancel at a significantly higher rate than active members.' },
              { label: 'No re-evaluation in 30+ days', risk: 'High', detail: 'No progress re-evaluation on record in the past 30 days. Re-evaluations are a key retention touchpoint.' },
              { label: 'No Google review left', risk: 'Medium', detail: 'Member has never left a Google review. Flagged as a retention and referral opportunity.' },
              { label: 'No session in 7–13 days', risk: 'Medium', detail: 'Attendance gap detected. Early outreach before the 14-day threshold can prevent escalation to High.' },
            ].map(c => (
              <div key={c.label} style={{ padding: 10, background: brand.surfaceAlt, borderRadius: 8, borderLeft: `3px solid ${c.risk === 'High' ? brand.danger : brand.warning}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: c.risk === 'High' ? brand.danger : brand.warning, letterSpacing: 0.5 }}>{c.risk.toUpperCase()}</span>
                  <span style={{ fontWeight: 700, color: brand.text }}>{c.label}</span>
                </div>
                <p style={{ margin: 0, color: brand.textMuted, lineHeight: 1.5 }}>{c.detail}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

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

                      {/* App Engagement Signal (W21) */}
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <div style={{ flex: 1, padding: '8px 12px', background: brand.surfaceAlt, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Smartphone size={10} /> APP ENGAGEMENT
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${m.engagementScore}%`, height: '100%', borderRadius: 3, background: m.engagementScore >= 70 ? brand.success : m.engagementScore >= 50 ? brand.warning : brand.danger }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: m.engagementScore >= 70 ? brand.success : m.engagementScore >= 50 ? brand.warning : brand.danger, minWidth: 32 }}>{m.engagementScore}/100</span>
                          </div>
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
                        <OButton variant="ghost" size="sm" icon={Trophy} onClick={() => openGameStats(m)}>Log Game Stats</OButton>
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

      {/* Game Stats Modal (W21) */}
      {gameStatsModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setGameStatsModal(null); }}>
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: fonts.display, color: brand.text, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={16} color={brand.goldDeep} /> Log Game Stats
            </div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginBottom: 20 }}>{gameStatsModal.kidName}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Game Date */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>GAME DATE</label>
                <input type="date" value={gameStatsModal.gameDate}
                  onChange={e => setGameStatsModal(p => p ? { ...p, gameDate: e.target.value } : null)}
                  style={{ width: '100%', padding: '8px 10px', background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, color: brand.text, fontSize: 13 }} />
              </div>
              {/* Opponent */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>OPPONENT</label>
                <input type="text" placeholder="Team name" value={gameStatsModal.opponent}
                  onChange={e => setGameStatsModal(p => p ? { ...p, opponent: e.target.value } : null)}
                  style={{ width: '100%', padding: '8px 10px', background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, color: brand.text, fontSize: 13 }} />
              </div>
              {/* Result */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>RESULT</label>
                <select value={gameStatsModal.result}
                  onChange={e => setGameStatsModal(p => p ? { ...p, result: e.target.value as GameStatsForm['result'] } : null)}
                  style={{ width: '100%', padding: '8px 10px', background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, color: brand.text, fontSize: 13 }}>
                  <option value="">—</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="tie">Tie</option>
                  <option value="scrimmage">Scrimmage</option>
                </select>
              </div>
              {/* At Bats / Hits */}
              {(['atBats', 'hits', 'homeRuns', 'rbi'] as const).map(field => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>
                    {field === 'atBats' ? 'AT BATS' : field === 'hits' ? 'HITS' : field === 'homeRuns' ? 'HOME RUNS' : 'RBI'}
                  </label>
                  <input type="number" min="0" placeholder="0" value={gameStatsModal[field]}
                    onChange={e => setGameStatsModal(p => p ? { ...p, [field]: e.target.value } : null)}
                    style={{ width: '100%', padding: '8px 10px', background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, color: brand.text, fontSize: 13 }} />
                </div>
              ))}
              {/* Exit Velo */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>AVG EXIT VELO (mph)</label>
                <input type="number" step="0.1" placeholder="e.g. 78.5" value={gameStatsModal.avgExitVelo}
                  onChange={e => setGameStatsModal(p => p ? { ...p, avgExitVelo: e.target.value } : null)}
                  style={{ width: '100%', padding: '8px 10px', background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, color: brand.text, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>PEAK EXIT VELO (mph)</label>
                <input type="number" step="0.1" placeholder="e.g. 85.0" value={gameStatsModal.peakExitVelo}
                  onChange={e => setGameStatsModal(p => p ? { ...p, peakExitVelo: e.target.value } : null)}
                  style={{ width: '100%', padding: '8px 10px', background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, color: brand.text, fontSize: 13 }} />
              </div>
              {/* Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>NOTES</label>
                <textarea rows={2} placeholder="Any observations…" value={gameStatsModal.notes}
                  onChange={e => setGameStatsModal(p => p ? { ...p, notes: e.target.value } : null)}
                  style={{ width: '100%', padding: '8px 10px', background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, color: brand.text, fontSize: 13, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <OButton variant="ghost" size="sm" onClick={() => setGameStatsModal(null)}>Cancel</OButton>
              <OButton variant="gold" size="sm" icon={gameStatsSaving ? Loader2 : Trophy} disabled={gameStatsSaving || !gameStatsModal.gameDate} onClick={saveGameStats}>
                {gameStatsSaving ? 'Saving…' : 'Save Game Stats'}
              </OButton>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 420 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
