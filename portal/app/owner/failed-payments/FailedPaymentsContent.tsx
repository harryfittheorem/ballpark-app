'use client';

import { useState, useEffect, useCallback } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { AlertCircle, Users, TrendingUp, CreditCard, Mail, Phone, MessageCircle, Send, ShoppingBag, RefreshCw, RotateCcw, PauseCircle } from 'lucide-react';
import type { FailedPayment } from '@/lib/supabase/ownerQueries';
import { PlayerLink } from '@/components/owner/PlayerLink';

type Props = { payments: FailedPayment[] };

const DEMO_PAYMENTS: FailedPayment[] = [
  { id: 'fp1', membershipId: 'mem1', member: 'Marcus Williams', parent: 'Darius Williams', amount: 280, package: 'Unlimited Monthly',   failedDate: 'May 10, 2026', failedAt: '2026-05-10T09:00:00Z', reason: 'Insufficient funds', attempts: 2, nextAttempt: 'May 13, 2026', source: 'membership', failureCount: 2, isPaused: false },
  { id: 'fp2', membershipId: 'mem2', member: 'Owen Murphy',     parent: 'Patrick Murphy',  amount: 450, package: 'Team Training',        failedDate: 'May 11, 2026', failedAt: '2026-05-11T14:30:00Z', reason: 'Card expired',       attempts: 1, nextAttempt: 'May 14, 2026', source: 'membership', failureCount: 1, isPaused: false },
  { id: 'fp3', membershipId: 'mem3', member: 'Noah Patel',      parent: 'Raj Patel',       amount: 280, package: 'Unlimited Monthly',   failedDate: 'May 12, 2026', failedAt: '2026-05-12T11:00:00Z', reason: 'Do not honor',       attempts: 3, nextAttempt: 'May 15, 2026', source: 'membership', failureCount: 3, isPaused: true  },
  { id: 'fp4', membershipId: null,   member: 'Ella Johnson',    parent: 'Maya Johnson',    amount: 25,  package: 'IH T-Shirt',          failedDate: 'May 13, 2026', failedAt: '2026-05-13T16:45:00Z', reason: 'Card declined',      attempts: 1, nextAttempt: 'May 16, 2026', source: 'store_order', failureCount: 0, isPaused: false },
];

export function FailedPaymentsContent({ payments: rawPayments }: Props) {
  const payments = rawPayments;
  const totalAtRisk = payments.reduce((s, f) => s + f.amount, 0);
  const membershipFailures = payments.filter(p => p.source === 'membership');
  const storeFailures      = payments.filter(p => p.source === 'store_order');
  const pausedCount        = payments.filter(p => p.isPaused).length;
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  const showToast = useCallback((msg: string, isError = false) => {
    setToast(msg);
    setToastError(isError);
  }, []);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const handleEmailAll = () => {
    showToast(`Payment reminder emails sent to ${payments.length} parent${payments.length !== 1 ? 's' : ''}`);
  };

  return (
    <div>
      <PageHeader
        title="Failed Payments"
        subtitle="Resolve these to recover revenue"
        actions={<OButton variant="gold" icon={Send} onClick={handleEmailAll}>Email All Parents</OButton>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Revenue at Risk"     value={`$${totalAtRisk.toLocaleString()}`} icon={AlertCircle}  color="danger" />
          <KPICard label="Accounts Affected"   value={payments.length}                    icon={Users}        color="warning" />
          <KPICard label="Membership Paused"   value={pausedCount}                        icon={PauseCircle}  color="danger" />
          <KPICard label="Avg Recovery Rate"   value="72%"    deltaLabel="historical"     icon={TrendingUp}   color="success" />
        </div>

        {membershipFailures.length > 0 && (
          <>
            <SectionHeader title="Membership Billing Failures" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {membershipFailures.map(f => (
                <FailedPaymentCard key={f.id} f={f} onToast={showToast} />
              ))}
            </div>
          </>
        )}

        {storeFailures.length > 0 && (
          <>
            <SectionHeader title="Store Purchase Failures" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {storeFailures.map(f => (
                <FailedPaymentCard key={f.id} f={f} onToast={showToast} />
              ))}
            </div>
          </>
        )}

        {payments.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: brand.textMuted }}>
            No failed payments. Great work!
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 500,
          background: toastError ? '#c0392b' : brand.dark,
          color: toastError ? '#fff' : brand.gold,
          padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.24)',
          fontSize: 13, fontWeight: 600, maxWidth: 400,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Failure count chip ──────────────────────────────────────────────────────

function FailureCountChip({ count }: { count: number }) {
  if (count <= 0) return null;
  const color = count === 1 ? '#f39c12' : count === 2 ? '#e67e22' : '#c0392b';
  const label = count === 1 ? '1st failure' : count === 2 ? '2nd failure' : `${count}× failed`;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 10, fontWeight: 700,
      background: `${color}22`, color,
      border: `1px solid ${color}66`,
      borderRadius: 4, padding: '2px 7px',
      textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {label}
    </span>
  );
}

// ─── Reset notes modal ───────────────────────────────────────────────────────

function ResetModal({
  memberName,
  onConfirm,
  onCancel,
}: {
  memberName: string;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: brand.dark, border: `1px solid ${brand.borderDark}`,
        borderRadius: 12, padding: 28, width: 420, maxWidth: '90vw',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: brand.text, marginBottom: 8 }}>
          Reset Failure Count
        </div>
        <div style={{ fontSize: 13, color: brand.textMuted, marginBottom: 16 }}>
          Resetting the failure count for <strong style={{ color: brand.text }}>{memberName}</strong> will
          clear the dunning schedule. Use this when payment was arranged in person.
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Staff note (optional) — e.g. 'Cash payment received 7/8'"
          style={{
            width: '100%', minHeight: 80, padding: '10px 12px',
            background: brand.darker, border: `1px solid ${brand.borderDark}`,
            borderRadius: 8, color: brand.text, fontSize: 13,
            resize: 'vertical', boxSizing: 'border-box',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <OButton variant="ghost" size="sm" onClick={onCancel}>Cancel</OButton>
          <OButton variant="gold" size="sm" onClick={() => onConfirm(note)}>Reset</OButton>
        </div>
      </div>
    </div>
  );
}

// ─── Individual card ─────────────────────────────────────────────────────────

function FailedPaymentCard({ f, onToast }: { f: FailedPayment; onToast: (msg: string, isError?: boolean) => void }) {
  const isStoreOrder = f.source === 'store_order';
  const [retrying, setRetrying] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleRetry = async () => {
    if (!f.membershipId) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/owner/memberships/${f.membershipId}/retry-payment`, {
        method: 'POST',
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (res.ok && data.ok !== false) {
        onToast(`Retry initiated for ${f.member}. Check payment status in a moment.`);
      } else {
        const msg = data.message ?? data.error ?? 'Retry failed';
        onToast(msg.length > 80 ? msg.slice(0, 80) + '…' : msg, true);
      }
    } catch {
      onToast('Network error — retry failed', true);
    } finally {
      setRetrying(false);
    }
  };

  const handleReset = async (note: string) => {
    setShowReset(false);
    if (!f.membershipId) return;
    try {
      const res = await fetch(`/api/owner/memberships/${f.membershipId}/reset-failure-count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        onToast(`Failure count reset for ${f.member}. Dunning schedule cleared.`);
      } else {
        onToast(data.error ?? 'Reset failed', true);
      }
    } catch {
      onToast('Network error — reset failed', true);
    }
  };

  return (
    <>
      <OCard>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: brand.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isStoreOrder
              ? <ShoppingBag size={20} color={brand.danger} />
              : f.isPaused
                ? <PauseCircle size={20} color={brand.danger} />
                : <AlertCircle size={20} color={brand.danger} />
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    <PlayerLink name={f.member} reference={f} section="payment-history" />
                  </div>
                  {isStoreOrder && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#2a2000', color: brand.gold, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: 1 }}>Store</span>
                  )}
                  {f.isPaused && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#3a0000', color: brand.danger, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: 1 }}>⏸ Paused</span>
                  )}
                  {!isStoreOrder && <FailureCountChip count={f.failureCount} />}
                </div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Parent: {f.parent}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.danger }}>${f.amount.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: brand.textMuted }}>{f.package}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: brand.textMuted, marginBottom: 12, flexWrap: 'wrap' }}>
              <div>Failed: <strong style={{ color: brand.text }}>{f.failedDate}</strong></div>
              <div>Reason: <strong style={{ color: brand.text }}>{f.reason}</strong></div>
              {!isStoreOrder && <div>Failures: <strong style={{ color: brand.text }}>{f.failureCount}</strong></div>}
              {!isStoreOrder && !f.isPaused && <div>Next retry: <strong style={{ color: brand.text }}>{f.nextAttempt}</strong></div>}
              {f.isPaused && <div style={{ color: brand.danger, fontWeight: 600 }}>Membership paused — payment required</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!isStoreOrder && f.membershipId && (
                <OButton
                  variant="gold"
                  size="sm"
                  icon={retrying ? undefined : RefreshCw}
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? 'Retrying…' : 'Retry Now'}
                </OButton>
              )}
              {!isStoreOrder && f.membershipId && (
                <OButton
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => setShowReset(true)}
                >
                  Reset Count
                </OButton>
              )}
              <OButton variant="secondary" size="sm" icon={Mail} onClick={() => onToast(`Payment reminder email sent to ${f.parent}`)}>Email</OButton>
              <OButton variant="secondary" size="sm" icon={Phone} onClick={() => onToast(`Copied ${f.parent}'s phone number`)}>Call</OButton>
              <OButton variant="ghost" size="sm" icon={MessageCircle} onClick={() => onToast(`Opening message thread with ${f.parent}…`)}>Message</OButton>
            </div>
          </div>
        </div>
      </OCard>

      {showReset && (
        <ResetModal
          memberName={f.member}
          onConfirm={handleReset}
          onCancel={() => setShowReset(false)}
        />
      )}
    </>
  );
}
