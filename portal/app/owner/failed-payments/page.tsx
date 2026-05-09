'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { AlertCircle, Users, TrendingUp, CreditCard, Mail, Phone, MessageCircle, Send } from 'lucide-react';

export default function FailedPaymentsPage() {
  return (
    <div>
      <PageHeader
        title="Failed Payments"
        subtitle="Resolve these to recover revenue"
        actions={<OButton variant="gold" icon={Send}>Email All Parents</OButton>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Revenue at Risk" value="$580" icon={AlertCircle} color="danger" />
          <KPICard label="Accounts Affected" value="3" icon={Users} color="warning" />
          <KPICard label="Avg Recovery Rate" value="72%" deltaLabel="historical" icon={TrendingUp} color="success" />
        </div>

        <SectionHeader title="Action Required" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {demoData.failedPayments.map(f => (
            <OCard key={f.id}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: brand.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertCircle size={20} color={brand.danger} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{f.member}</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Parent: {f.parent}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.danger }}>${f.amount}</div>
                      <div style={{ fontSize: 10, color: brand.textMuted }}>{f.package}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: brand.textMuted, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div>Failed: <strong style={{ color: brand.text }}>{f.failedDate}</strong></div>
                    <div>Reason: <strong style={{ color: brand.text }}>{f.reason}</strong></div>
                    <div>Attempts: <strong style={{ color: brand.text }}>{f.attempts}</strong></div>
                    <div>Next retry: <strong style={{ color: brand.text }}>{f.nextAttempt}</strong></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <OButton variant="gold" size="sm" icon={CreditCard}>Retry Charge</OButton>
                    <OButton variant="secondary" size="sm" icon={Mail}>Email Parent</OButton>
                    <OButton variant="secondary" size="sm" icon={Phone}>Call</OButton>
                    <OButton variant="ghost" size="sm" icon={MessageCircle}>Message</OButton>
                  </div>
                </div>
              </div>
            </OCard>
          ))}
        </div>
      </div>
    </div>
  );
}
