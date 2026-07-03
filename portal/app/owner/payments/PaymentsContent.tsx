'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { PageHeader, SectionHeader, OCard, OButton, Chip } from '@/components/owner/ui';
import {
  CreditCard, CheckCircle2, AlertCircle, Link2, Link2Off,
  ExternalLink, Info, Clock, RefreshCw,
} from 'lucide-react';
import type { LocationStripeStatus } from '@/lib/supabase/ownerQueries';

type Props = {
  locations: LocationStripeStatus[];
};

type ConnectingState = Record<string, boolean>;

function statusChip(status: LocationStripeStatus['stripe_onboarding_status']) {
  if (status === 'connected')   return <Chip color="success">CONNECTED</Chip>;
  if (status === 'pending')     return <Chip color="warning">PENDING VERIFICATION</Chip>;
  if (status === 'restricted')  return <Chip color="danger">RESTRICTED</Chip>;
  return <Chip color="danger">NOT CONNECTED</Chip>;
}

function statusIcon(status: LocationStripeStatus['stripe_onboarding_status']) {
  if (status === 'connected')   return <CheckCircle2 size={15} color={brand.success} />;
  if (status === 'pending')     return <Clock        size={15} color={brand.warning} />;
  if (status === 'restricted')  return <AlertCircle  size={15} color={brand.danger} />;
  return <AlertCircle size={15} color={brand.textLight} />;
}

function statusText(status: LocationStripeStatus['stripe_onboarding_status']) {
  if (status === 'connected')   return 'Card payments are enabled. Payouts go to your connected bank account.';
  if (status === 'pending')     return 'Stripe is verifying your account. Card payments enable once complete.';
  if (status === 'restricted')  return 'Your account has an outstanding requirement. Open the Stripe Dashboard to resolve.';
  return 'No Stripe account connected. Card payments are disabled for this location.';
}

export function PaymentsContent({ locations }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [connecting, setConnecting] = useState<ConnectingState>({});
  const [disconnecting, setDisconnecting] = useState<ConnectingState>({});
  const [syncing, setSyncing] = useState<ConnectingState>({});
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      setFlash({ type: 'success', text: 'Stripe account connected! Stripe is verifying your details — status will update automatically via webhook.' });
    }
    const err = searchParams.get('error');
    if (err) {
      setFlash({ type: 'error', text: `Connection failed: ${decodeURIComponent(err)}` });
    }
  }, [searchParams]);

  const anyNotConnected = locations.some(l => l.stripe_onboarding_status === 'not_connected');

  async function handleConnect(locationId: string) {
    setConnecting(prev => ({ ...prev, [locationId]: true }));
    setFlash(null);
    try {
      const res = await fetch('/api/stripe/connect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const data = await res.json() as { url?: string; error?: { message?: string } | string };
      if (!res.ok || !data.url) {
        const msg = typeof data.error === 'string' ? data.error : (data.error?.message ?? 'Failed to start Stripe connection.');
        setFlash({ type: 'error', text: msg });
        setConnecting(prev => ({ ...prev, [locationId]: false }));
        return;
      }
      // Open in a new tab — Stripe OAuth should not navigate away from the portal
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Network error' });
    } finally {
      setConnecting(prev => ({ ...prev, [locationId]: false }));
    }
  }

  async function handleDisconnect(locationId: string) {
    if (!window.confirm('Disconnect this Stripe account? Card payments will be disabled for this location until you reconnect.')) return;
    setDisconnecting(prev => ({ ...prev, [locationId]: true }));
    setFlash(null);
    try {
      const res = await fetch('/api/stripe/connect/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setFlash({ type: 'error', text: data.error ?? 'Failed to disconnect.' });
      } else {
        setFlash({ type: 'success', text: 'Stripe account disconnected.' });
        window.location.reload();
      }
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Network error' });
    } finally {
      setDisconnecting(prev => ({ ...prev, [locationId]: false }));
    }
  }

  async function handleSync(locationId: string) {
    setSyncing(prev => ({ ...prev, [locationId]: true }));
    setFlash(null);
    try {
      const res = await fetch('/api/stripe/connect/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const data = await res.json() as { ok?: boolean; status?: string; error?: string };
      if (!res.ok || !data.ok) {
        setFlash({ type: 'error', text: data.error ?? 'Failed to sync status from Stripe.' });
      } else {
        setFlash({ type: 'success', text: `Status synced from Stripe: ${data.status ?? 'updated'}.` });
        router.refresh();
      }
    } catch (e) {
      setFlash({ type: 'error', text: e instanceof Error ? e.message : 'Network error' });
    } finally {
      setSyncing(prev => ({ ...prev, [locationId]: false }));
    }
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Connect each location to Stripe to enable card payments"
      />

      <div style={{ padding: 24, maxWidth: 820 }}>
        {/* Flash message */}
        {flash && (
          <div style={{
            marginBottom: 20,
            padding: '12px 16px',
            borderRadius: 8,
            background: flash.type === 'success' ? brand.successBg : brand.dangerBg,
            border: `1px solid ${flash.type === 'success' ? brand.success : brand.danger}`,
            color: flash.type === 'success' ? brand.success : brand.danger,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            {flash.type === 'success'
              ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertCircle  size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            }
            {flash.text}
          </div>
        )}

        {/* Warning when any location lacks Stripe */}
        {anyNotConnected && !flash && (
          <div style={{
            marginBottom: 20,
            padding: '14px 16px',
            borderRadius: 8,
            background: brand.warningBg,
            border: `1px solid ${brand.warning}`,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <AlertCircle size={18} color={brand.warning} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: brand.warning }}>Card payments disabled for some locations</div>
              <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4, lineHeight: 1.5 }}>
                Connect a Stripe Express account for each location below. Parents cannot pay by card at any unconnected location.
              </div>
            </div>
          </div>
        )}

        {/* Per-location cards */}
        {locations.length === 0 && (
          <OCard>
            <div style={{ textAlign: 'center', padding: '24px 0', color: brand.textMuted, fontSize: 13 }}>
              No locations found for your account.
            </div>
          </OCard>
        )}

        {locations.map((loc) => {
          const isConnected   = loc.stripe_onboarding_status === 'connected';
          const isPending     = loc.stripe_onboarding_status === 'pending';
          const isRestricted  = loc.stripe_onboarding_status === 'restricted';
          const isNotConnected = loc.stripe_onboarding_status === 'not_connected';
          const isConnecting   = !!connecting[loc.id];
          const isDisconnecting = !!disconnecting[loc.id];
          const isSyncing      = !!syncing[loc.id];

          return (
            <OCard key={loc.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: brand.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CreditCard size={20} color={isConnected ? brand.success : brand.goldDeep} strokeWidth={2} />
                </div>

                <div style={{ flex: 1 }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display }}>{loc.name}</div>
                    {statusChip(loc.stripe_onboarding_status)}
                  </div>

                  {/* Connected account details */}
                  {(isConnected || isPending || isRestricted) && (
                    <div style={{ marginBottom: 10 }}>
                      {loc.stripe_account_name && (
                        <div style={{ fontSize: 12, color: brand.textMuted, marginBottom: 2 }}>
                          Account: <strong style={{ color: brand.text }}>{loc.stripe_account_name}</strong>
                        </div>
                      )}
                      {loc.stripe_account_id && (
                        <div style={{ fontSize: 11, color: brand.textLight, fontFamily: fonts.mono, marginBottom: 2 }}>
                          {loc.stripe_account_id}
                        </div>
                      )}
                      {isConnected && loc.stripe_payout_interval && (
                        <div style={{ fontSize: 12, color: brand.textMuted }}>
                          Payout schedule: <strong style={{ color: brand.text }}>{loc.stripe_payout_interval}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status description */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 14 }}>
                    <span style={{ marginTop: 2 }}>{statusIcon(loc.stripe_onboarding_status)}</span>
                    <span style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.5 }}>
                      {statusText(loc.stripe_onboarding_status)}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {isNotConnected && (
                      <OButton
                        variant="gold"
                        icon={Link2}
                        onClick={isConnecting ? undefined : () => handleConnect(loc.id)}
                        style={isConnecting ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                      >
                        {isConnecting ? 'Opening Stripe…' : 'Connect Stripe Account'}
                      </OButton>
                    )}

                    {(isPending || isRestricted) && (
                      <>
                        <OButton
                          variant={isRestricted ? 'gold' : 'secondary'}
                          icon={ExternalLink}
                          onClick={() => window.open('https://dashboard.stripe.com', '_blank', 'noopener,noreferrer')}
                        >
                          {isRestricted ? 'Resolve in Stripe Dashboard' : 'Open Stripe Dashboard'}
                        </OButton>
                        <OButton
                          variant="secondary"
                          icon={RefreshCw}
                          onClick={isSyncing ? undefined : () => handleSync(loc.id)}
                          style={isSyncing ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                        >
                          {isSyncing ? 'Syncing…' : 'Sync from Stripe'}
                        </OButton>
                        <OButton
                          variant="ghost"
                          icon={Link2Off}
                          onClick={isDisconnecting ? undefined : () => handleDisconnect(loc.id)}
                          style={isDisconnecting ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                        >
                          {isDisconnecting ? 'Disconnecting…' : (isPending ? 'Disconnect & Restart' : 'Disconnect')}
                        </OButton>
                      </>
                    )}

                    {isConnected && (
                      <>
                        <OButton
                          variant="secondary"
                          icon={ExternalLink}
                          onClick={() => window.open('https://dashboard.stripe.com', '_blank', 'noopener,noreferrer')}
                        >
                          Stripe Dashboard
                        </OButton>
                        <OButton
                          variant="secondary"
                          icon={RefreshCw}
                          onClick={isSyncing ? undefined : () => handleSync(loc.id)}
                          style={isSyncing ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                        >
                          {isSyncing ? 'Syncing…' : 'Sync from Stripe'}
                        </OButton>
                        <OButton
                          variant="ghost"
                          icon={Link2Off}
                          onClick={isDisconnecting ? undefined : () => handleDisconnect(loc.id)}
                          style={isDisconnecting ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                        >
                          {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </OButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </OCard>
          );
        })}

        {/* How it works */}
        <div style={{ marginTop: 32 }}>
          <SectionHeader title="How it works" />
          <OCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                {
                  step: '1',
                  title: 'Click "Connect Stripe Account"',
                  body: 'A new tab opens with Stripe\'s secure onboarding. Stripe handles identity verification (KYC) directly — Ballpark never sees your banking details.',
                },
                {
                  step: '2',
                  title: 'Stripe verifies your details',
                  body: 'After completing onboarding, Stripe verifies your information (typically within minutes). The status on this page updates automatically via webhook.',
                },
                {
                  step: '3',
                  title: 'Card payments go live',
                  body: 'When status shows "Connected", parents can pay by card in the Ballpark app. Ballpark\'s 2.5% platform fee is deducted automatically on each transaction. Your net payout is 97.5% of each charge (standard Stripe processing fees also apply).',
                },
              ].map((item, i, arr) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', gap: 14,
                    paddingBottom: i < arr.length - 1 ? 20 : 0,
                    borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: brand.goldDeep, color: brand.dark,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 2,
                    fontFamily: fonts.display,
                  }}>
                    {item.step}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </OCard>
        </div>

        <div style={{ marginTop: 20 }}>
          <OCard style={{ background: brand.surfaceAlt }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Info size={15} color={brand.info} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.6 }}>
                <strong style={{ color: brand.text }}>Platform fee:</strong> Ballpark automatically deducts a 2.5% application fee from each card transaction. This fee covers platform maintenance, support, and royalty collection. Standard Stripe payment processing fees (typically 2.9% + 30¢) also apply and are charged separately by Stripe.
              </div>
            </div>
          </OCard>
        </div>
      </div>
    </div>
  );
}
