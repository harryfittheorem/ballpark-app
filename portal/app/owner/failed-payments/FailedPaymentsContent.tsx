'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { AlertCircle, Users, TrendingUp, CreditCard, Mail, Phone, MessageCircle, Send, ShoppingBag } from 'lucide-react';
import type { FailedPayment } from '@/lib/supabase/ownerQueries';

type Props = { payments: FailedPayment[] };

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_PAYMENTS: FailedPayment[] = [
  { id: 'fp1', member: 'Marcus Williams', parent: 'Darius Williams', amount: 280, package: 'Unlimited Monthly',   failedDate: 'May 10, 2026', failedAt: '2026-05-10T09:00:00Z', reason: 'Insufficient funds', attempts: 2, nextAttempt: 'May 13, 2026', source: 'membership' },
  { id: 'fp2', member: 'Owen Murphy',     parent: 'Patrick Murphy',  amount: 450, package: 'Team Training',        failedDate: 'May 11, 2026', failedAt: '2026-05-11T14:30:00Z', reason: 'Card expired',       attempts: 1, nextAttempt: 'May 14, 2026', source: 'membership' },
  { id: 'fp3', member: 'Noah Patel',      parent: 'Raj Patel',       amount: 280, package: 'Unlimited Monthly',   failedDate: 'May 12, 2026', failedAt: '2026-05-12T11:00:00Z', reason: 'Do not honor',       attempts: 1, nextAttempt: 'May 15, 2026', source: 'membership' },
  { id: 'fp4', member: 'Ella Johnson',    parent: 'Maya Johnson',    amount: 25,  package: 'IH T-Shirt',          failedDate: 'May 13, 2026', failedAt: '2026-05-13T16:45:00Z', reason: 'Card declined',      attempts: 1, nextAttempt: 'May 16, 2026', source: 'store_order' },
];

// ── Component ──────────────────────────────────────────────────────────────

export function FailedPaymentsContent({ payments: rawPayments }: Props) {
  const payments    = rawPayments.length ? rawPayments : DEMO_PAYMENTS;
  const totalAtRisk = payments.reduce((s, f) => s + f.amount, 0);
  const membershipFailures = payments.filter(p => p.source === 'membership');
  const storeFailures      = payments.filter(p => p.source === 'store_order');

  return (
    <div>
      <PageHeader
        title="Failed Payments"
        subtitle="Resolve these to recover revenue"
        actions={<OButton variant="gold" icon={Send}>Email All Parents</OButton>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Revenue at Risk"   value={`$${totalAtRisk.toLocaleString()}`} icon={AlertCircle} color="danger" />
          <KPICard label="Accounts Affected" value={payments.length}                    icon={Users}       color="warning" />
          <KPICard label="Avg Recovery Rate" value="72%"    deltaLabel="historical"     icon={TrendingUp}  color="success" />
        </div>

        {membershipFailures.length > 0 && (
          <>
            <SectionHeader title="Membership Billing Failures" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {membershipFailures.map(f => (
                <FailedPaymentCard key={f.id} f={f} />
              ))}
            </div>
          </>
        )}

        {storeFailures.length > 0 && (
          <>
            <SectionHeader title="Store Purchase Failures" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {storeFailures.map(f => (
                <FailedPaymentCard key={f.id} f={f} />
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
    </div>
  );
}

function FailedPaymentCard({ f }: { f: FailedPayment }) {
  const isStoreOrder = f.source === 'store_order';
  return (
    <OCard>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: brand.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isStoreOrder
            ? <ShoppingBag size={20} color={brand.danger} />
            : <AlertCircle size={20} color={brand.danger} />
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{f.member}</div>
                {isStoreOrder && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#2a2000',
                    color: brand.gold,
                    borderRadius: 4,
                    padding: '2px 6px',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>
                    Store
                  </span>
                )}
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
            <div>Attempts: <strong style={{ color: brand.text }}>{f.attempts}</strong></div>
            {!isStoreOrder && <div>Next retry: <strong style={{ color: brand.text }}>{f.nextAttempt}</strong></div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isStoreOrder && (
              <OButton variant="gold" size="sm" icon={CreditCard}>Retry Charge</OButton>
            )}
            <OButton variant="secondary" size="sm" icon={Mail}>Email Parent</OButton>
            <OButton variant="secondary" size="sm" icon={Phone}>Call</OButton>
            <OButton variant="ghost"     size="sm" icon={MessageCircle}>Message</OButton>
          </div>
        </div>
      </div>
    </OCard>
  );
}
