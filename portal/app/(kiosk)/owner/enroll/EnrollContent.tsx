'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton } from '@/components/owner/ui';
import {
  CheckCircle, ChevronLeft, ChevronRight, User, ClipboardList,
  FileText, CreditCard, RotateCcw, UserPlus,
} from 'lucide-react';
import type { MembershipPlan } from '@/app/api/owner/membership-plans/route';
import type SignatureCanvasType from 'react-signature-canvas';

// Dynamically import SignatureCanvas (requires DOM canvas API)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureCanvas = dynamic(() => import('react-signature-canvas') as any, { ssr: false }) as React.ComponentType<{
  ref?: React.Ref<SignatureCanvasType>;
  penColor?: string;
  canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
  onEnd?: () => void;
}>;

// Dynamically import Stripe Elements (requires browser env)
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// ── Types ──────────────────────────────────────────────────────────────────

type Waiver = {
  id: string;
  version: number;
  effective_date: string;
  body_text: string;
};

type Location = {
  id: string;
  name: string;
  stripe_onboarding_status: string | null;
};

type Props = {
  waiver: Waiver | null;
  stripePublishableKey: string | null;
  locations: Location[];
};

type Step = 1 | 2 | 3 | 4 | 5; // 5 = confirmation

type FormData = {
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  kidFirstName: string;
  kidLastName: string;
  ageGroup: string;
  planId: string;
  locationId: string;
};

// ── Styles ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: `1px solid ${brand.border}`, borderRadius: 8,
  fontSize: 14, color: brand.text, background: brand.darker,
  fontFamily: fonts.body, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.6,
  textTransform: 'uppercase', marginBottom: 5, display: 'block',
};

const fieldWrap: React.CSSProperties = { marginBottom: 16 };

const errorStyle: React.CSSProperties = {
  fontSize: 12, color: brand.danger, marginTop: 4,
};

// ── Step indicator ─────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, icon: User, label: 'Family & Athlete' },
  { n: 2, icon: ClipboardList, label: 'Plan' },
  { n: 3, icon: FileText, label: 'Agreement' },
  { n: 4, icon: CreditCard, label: 'Payment' },
];

function StepBar({ current }: { current: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((s, idx) => {
        const done = current > s.n;
        const active = current === s.n;
        const Icon = s.icon;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                background: done ? brand.success : active ? brand.gold : brand.darker,
                border: `2px solid ${done ? brand.success : active ? brand.gold : brand.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {done
                  ? <CheckCircle size={18} color={brand.dark} strokeWidth={2.5} />
                  : <Icon size={16} color={active ? brand.dark : brand.textMuted} strokeWidth={2.5} />
                }
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                color: done ? brand.success : active ? brand.gold : brand.textMuted,
                fontFamily: fonts.display, whiteSpace: 'nowrap',
              }}>{s.label}</div>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                height: 2, flex: 0.5, marginBottom: 20,
                background: done ? brand.success : brand.border,
                transition: 'background 0.2s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Family & Athlete ───────────────────────────────────────────────

function Step1({
  form, setForm, onNext, locations,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onNext: () => void;
  locations: Location[];
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showLocationPicker = locations.length > 1;

  const selectedLocation = locations.find(l => l.id === form.locationId) ?? null;
  // For single-location tenants the picker is hidden but locationId is auto-set;
  // readiness must be checked regardless of whether the picker is visible.
  const locationStripeReady = selectedLocation?.stripe_onboarding_status === 'connected';
  const hasLocationSelected = !!form.locationId;

  // Block Next when:
  //  - picker is shown and no location selected yet, OR
  //  - any location is resolved (picked or defaulted) but not Stripe-connected
  const nextBlocked = !hasLocationSelected || !locationStripeReady;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.parentFirstName.trim()) e.parentFirstName = 'Required';
    if (!form.parentLastName.trim()) e.parentLastName = 'Required';
    if (!form.parentEmail.trim()) e.parentEmail = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail)) e.parentEmail = 'Invalid email';
    if (!form.kidFirstName.trim()) e.kidFirstName = 'Required';
    if (showLocationPicker && !form.locationId) e.locationId = 'Required';
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onNext();
  };

  const f = (field: keyof FormData) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    },
  });

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: brand.text, marginBottom: 4 }}>Family & Athlete</h2>
      <p style={{ fontSize: 13, color: brand.textMuted, marginBottom: 24 }}>Enter the parent contact details and athlete information.</p>

      {/* Location section — picker shown for multi-location tenants only;
          Stripe readiness guard shown for all tenants when location is resolved */}
      {(showLocationPicker || (hasLocationSelected && !locationStripeReady)) && (
        <div style={{ marginBottom: 20 }}>
          {showLocationPicker && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Location</div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Enroll Under *</label>
                <select
                  style={{ ...inputStyle, appearance: 'auto', borderColor: errors.locationId ? brand.danger : brand.border }}
                  value={form.locationId}
                  onChange={e => {
                    setForm(prev => ({ ...prev, locationId: e.target.value }));
                    if (errors.locationId) setErrors(prev => ({ ...prev, locationId: '' }));
                  }}
                >
                  <option value="">Select a location…</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                {errors.locationId && <div style={errorStyle}>{errors.locationId}</div>}
              </div>
            </>
          )}

          {/* Stripe readiness guard — fires for all tenants when location is resolved but not connected */}
          {hasLocationSelected && !locationStripeReady && (
            <div style={{
              marginTop: showLocationPicker ? 4 : 0,
              padding: '12px 16px',
              background: '#2d1a00',
              border: '1px solid #b45309',
              borderRadius: 8,
              fontSize: 13,
              color: '#fbbf24',
              lineHeight: 1.5,
            }}>
              <strong>No Stripe account connected for this location.</strong> Payments will not work until setup is complete.{' '}
              <a
                href="/owner/payments"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#fbbf24', fontWeight: 700, textDecoration: 'underline' }}
              >
                Go to Payments →
              </a>{' '}
              to complete setup first.
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Parent / Guardian</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={fieldWrap}>
            <label style={labelStyle}>First Name *</label>
            <input style={{ ...inputStyle, borderColor: errors.parentFirstName ? brand.danger : brand.border }} placeholder="Carlos" {...f('parentFirstName')} />
            {errors.parentFirstName && <div style={errorStyle}>{errors.parentFirstName}</div>}
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle}>Last Name *</label>
            <input style={{ ...inputStyle, borderColor: errors.parentLastName ? brand.danger : brand.border }} placeholder="Martinez" {...f('parentLastName')} />
            {errors.parentLastName && <div style={errorStyle}>{errors.parentLastName}</div>}
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle}>Email *</label>
            <input type="email" style={{ ...inputStyle, borderColor: errors.parentEmail ? brand.danger : brand.border }} placeholder="carlos@email.com" {...f('parentEmail')} />
            {errors.parentEmail && <div style={errorStyle}>{errors.parentEmail}</div>}
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle}>Phone</label>
            <input type="tel" style={inputStyle} placeholder="(555) 555-5555" {...f('parentPhone')} />
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Athlete</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={fieldWrap}>
            <label style={labelStyle}>First Name *</label>
            <input style={{ ...inputStyle, borderColor: errors.kidFirstName ? brand.danger : brand.border }} placeholder="Jake" {...f('kidFirstName')} />
            {errors.kidFirstName && <div style={errorStyle}>{errors.kidFirstName}</div>}
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle}>Last Name</label>
            <input style={inputStyle} placeholder="Martinez" {...f('kidLastName')} />
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle}>Age Group</label>
            <select style={{ ...inputStyle, appearance: 'auto' }} {...f('ageGroup')}>
              <option value="">Select…</option>
              {['8U','10U','12U','14U','HS','College'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <OButton variant="gold" icon={ChevronRight} onClick={handleNext} disabled={nextBlocked}>Next: Choose Plan</OButton>
      </div>
    </div>
  );
}

// ── Step 2: Plan Selection ─────────────────────────────────────────────────

function Step2({
  form, setForm, onNext, onBack,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/owner/membership-plans')
      .then(r => r.json())
      .then((data: MembershipPlan[] | { error: string }) => {
        if (Array.isArray(data)) setPlans(data);
        else setError((data as { error: string }).error);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const handleNext = () => {
    if (!form.planId) return;
    onNext();
  };

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: brand.text, marginBottom: 4 }}>Choose a Plan</h2>
      <p style={{ fontSize: 13, color: brand.textMuted, marginBottom: 24 }}>Select the membership plan for {form.kidFirstName || 'this athlete'}.</p>

      {loading && (
        <div style={{ color: brand.textMuted, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading plans…</div>
      )}
      {error && (
        <div style={{ color: brand.danger, fontSize: 13, padding: '12px 16px', background: brand.dangerBg, borderRadius: 8, marginBottom: 16 }}>
          Could not load plans: {error}
        </div>
      )}

      {!loading && plans.length === 0 && !error && (
        <div style={{ color: brand.textMuted, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
          No active plans configured. Add plans in the billing settings.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        {plans.map(plan => {
          const selected = form.planId === plan.id;
          const priceLabel = plan.amount_cents > 0
            ? `$${(plan.amount_cents / 100).toFixed(2)}`
            : 'Free';
          const billingLabel = plan.plan_type === 'eft' ? '/mo · EFT' : ' · OTC';
          return (
            <div
              key={plan.id}
              onClick={() => setForm(f => ({ ...f, planId: plan.id }))}
              style={{
                padding: '16px 18px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${selected ? brand.gold : brand.border}`,
                background: selected ? `${brand.gold}14` : brand.darker,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontFamily: fonts.display, fontSize: 15, fontWeight: 700, color: selected ? brand.gold : brand.text }}>
                  {plan.name}
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: 9,
                  border: `2px solid ${selected ? brand.gold : brand.border}`,
                  background: selected ? brand.gold : 'transparent',
                  flexShrink: 0, marginLeft: 8, marginTop: 2,
                }} />
              </div>
              <div style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: selected ? brand.gold : brand.text, marginBottom: 4 }}>
                {priceLabel}
                <span style={{ fontSize: 12, fontWeight: 400, color: brand.textMuted, fontFamily: fonts.body }}>{billingLabel}</span>
              </div>
              {plan.description && (
                <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.5 }}>{plan.description}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <OButton variant="secondary" icon={ChevronLeft} onClick={onBack}>Back</OButton>
        <OButton variant="gold" icon={ChevronRight} onClick={handleNext} disabled={!form.planId}>
          Next: Agreement
        </OButton>
      </div>
    </div>
  );
}

// ── Step 3: Agreement + Signature ─────────────────────────────────────────

function Step3({
  waiver, form, onBack, onNext,
}: {
  waiver: Waiver | null;
  form: FormData;
  onNext: (signatureDataUrl: string) => Promise<void>;
  onBack: () => void;
}) {
  const sigCanvasRef = useRef<SignatureCanvasType | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleClear = useCallback(() => {
    sigCanvasRef.current?.clear();
    setHasInk(false);
  }, []);

  const handleStroke = useCallback(() => {
    if (!hasInk) setHasInk(true);
  }, [hasInk]);

  const handleSign = useCallback(async () => {
    if (!hasInk || !sigCanvasRef.current) return;
    setSubmitting(true);
    const dataUrl = sigCanvasRef.current.toDataURL('image/png');
    try {
      await onNext(dataUrl);
    } finally {
      setSubmitting(false);
    }
  }, [hasInk, onNext]);

  if (!waiver) {
    return (
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: brand.text, marginBottom: 16 }}>Agreement</h2>
        <div style={{ padding: '20px', background: brand.dangerBg, borderRadius: 8, color: brand.danger, fontSize: 13 }}>
          No active waiver found for this tenant. Please configure a waiver in the admin settings before enrolling members.
        </div>
        <div style={{ marginTop: 24 }}>
          <OButton variant="secondary" icon={ChevronLeft} onClick={onBack}>Back</OButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: brand.text, marginBottom: 4 }}>Liability Agreement</h2>
      <p style={{ fontSize: 13, color: brand.textMuted, marginBottom: 16 }}>
        Version {waiver.version} · Effective {waiver.effective_date} — Have the parent read and sign below.
      </p>

      {/* Waiver body */}
      <div style={{
        height: 260, overflowY: 'auto', background: brand.darker,
        border: `1px solid ${brand.border}`, borderRadius: 8,
        padding: '16px 20px', marginBottom: 20,
      }}>
        <pre style={{ fontFamily: fonts.body, fontSize: 12, color: brand.textLight, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
          {waiver.body_text}
        </pre>
      </div>

      {/* Signature pad */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Parent Signature
          </div>
          {hasInk && (
            <button
              onClick={handleClear}
              style={{ background: 'none', border: 'none', color: brand.textMuted, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
            >
              <RotateCcw size={12} /> Clear
            </button>
          )}
        </div>
        <div style={{
          border: `2px solid ${hasInk ? brand.gold : brand.border}`, borderRadius: 8,
          background: brand.darkest, overflow: 'hidden', cursor: 'crosshair',
          transition: 'border-color 0.2s',
        }}>
          <SignatureCanvas
            ref={sigCanvasRef}
            penColor={brand.gold}
            canvasProps={{
              width: 700,
              height: 160,
              style: { width: '100%', height: 160, display: 'block' },
            }}
            onEnd={handleStroke}
          />
        </div>
        {!hasInk && (
          <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 6, textAlign: 'center' }}>
            Have the parent sign with their finger or a mouse
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <OButton variant="secondary" icon={ChevronLeft} onClick={onBack} disabled={submitting}>Back</OButton>
        <OButton
          variant="gold"
          icon={ChevronRight}
          onClick={handleSign}
          disabled={!hasInk || submitting}
        >
          {submitting ? 'Saving…' : 'I Agree & Sign'}
        </OButton>
      </div>
    </div>
  );
}

// ── Step 4 inner: Stripe PaymentElement ───────────────────────────────────

function PaymentForm({
  form,
  plans,
  clientSecret,
  intentType,
  connectedAccountId,
  enrollmentIds,
  onSuccess,
  onBack,
}: {
  form: FormData;
  plans: MembershipPlan[];
  clientSecret: string;
  intentType: 'setup' | 'payment';
  connectedAccountId: string | null;
  enrollmentIds: { familyId: string; kidId: string; membershipId: string } | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const selectedPlan = plans.find(p => p.id === form.planId);

  const handleConfirm = async () => {
    if (!stripe || !elements || !enrollmentIds) return;
    setSubmitting(true);
    setPaymentError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setPaymentError(submitErr.message ?? 'Payment error');
      setSubmitting(false);
      return;
    }

    // Confirm the intent — EFT uses SetupIntent, OTC uses PaymentIntent
    let stripeIntentId: string | undefined;

    if (intentType === 'payment') {
      const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (confirmErr) {
        setPaymentError(confirmErr.message ?? 'Payment failed');
        setSubmitting(false);
        return;
      }
      if (!paymentIntent?.id || paymentIntent.status !== 'succeeded') {
        setPaymentError('Payment did not complete. Please try again.');
        setSubmitting(false);
        return;
      }
      stripeIntentId = paymentIntent.id;
    } else {
      const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (confirmErr) {
        setPaymentError(confirmErr.message ?? 'Payment authorisation failed');
        setSubmitting(false);
        return;
      }
      if (!setupIntent?.id) {
        setPaymentError('Payment authorisation incomplete. Please try again.');
        setSubmitting(false);
        return;
      }
      stripeIntentId = setupIntent.id;
    }

    // Attach payment method to family + activate membership
    const attachRes = await fetch('/api/owner/enroll/attach-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        family_id: enrollmentIds.familyId,
        membership_id: enrollmentIds.membershipId,
        stripe_intent_id: stripeIntentId,
        intent_type: intentType,
        plan_type: selectedPlan?.plan_type ?? 'eft',
        connected_account_id: connectedAccountId,
      }),
    });

    if (!attachRes.ok) {
      const attachData = await attachRes.json().catch(() => ({})) as { error?: string };
      setPaymentError(attachData.error ?? 'Failed to activate membership. Please contact support.');
      setSubmitting(false);
      return;
    }

    // Guard: only proceed to confirmation when activation succeeded
    const attachData = await attachRes.json().catch(() => ({})) as { ok?: boolean; activated?: boolean };
    if (!attachData.activated) {
      setPaymentError('Membership activation did not complete. Please contact support.');
      setSubmitting(false);
      return;
    }

    onSuccess();
  };

  return (
    <div>
      {selectedPlan && (
        <div style={{
          background: `${brand.gold}14`, border: `1px solid ${brand.goldDeep}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: brand.gold }}>{selectedPlan.name}</div>
            <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>
              {selectedPlan.plan_type === 'eft' ? 'Monthly EFT autopay' : 'One-time payment'}
            </div>
          </div>
          <div style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 700, color: brand.gold }}>
            ${(selectedPlan.amount_cents / 100).toFixed(2)}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {paymentError && (
        <div style={{ padding: '10px 14px', background: brand.dangerBg, borderRadius: 8, color: brand.danger, fontSize: 13, marginBottom: 16 }}>
          {paymentError}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <OButton variant="secondary" icon={ChevronLeft} onClick={onBack} disabled={submitting}>Back</OButton>
        <OButton
          variant="gold"
          icon={CreditCard}
          onClick={handleConfirm}
          disabled={!stripe || !elements || submitting || !enrollmentIds}
        >
          {submitting ? 'Processing…' : selectedPlan?.plan_type === 'eft' ? 'Authorize & Activate' : 'Pay & Activate'}
        </OButton>
      </div>
    </div>
  );
}

// ── Step 4: Payment ────────────────────────────────────────────────────────

function Step4({
  form,
  plans,
  stripePublishableKey,
  enrollmentIds,
  onSuccess,
  onBack,
}: {
  form: FormData;
  plans: MembershipPlan[];
  stripePublishableKey: string | null;
  enrollmentIds: { familyId: string; kidId: string; membershipId: string } | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<'setup' | 'payment'>('setup');
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = plans.find(p => p.id === form.planId);

  useEffect(() => {
    if (!stripePublishableKey) {
      setError('Stripe is not configured for this tenant. Contact support to set up payment processing.');
      setLoading(false);
      return;
    }

    if (!enrollmentIds?.membershipId) {
      setError('Enrollment data missing. Please go back and try again.');
      setLoading(false);
      return;
    }

    fetch('/api/owner/enroll/setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        membership_id: enrollmentIds.membershipId,
        customer_email: form.parentEmail,
        customer_name: `${form.parentFirstName} ${form.parentLastName}`.trim(),
      }),
    })
      .then(r => r.json())
      .then((data: { client_secret?: string; intent_type?: string; connected_account_id?: string; error?: string }) => {
        if (data.error || !data.client_secret) {
          setError(data.error ?? 'Could not initialize payment');
          setLoading(false);
          return;
        }
        setClientSecret(data.client_secret);
        setIntentType(data.intent_type === 'payment' ? 'payment' : 'setup');
        setConnectedAccountId(data.connected_account_id ?? null);

        const opts = data.connected_account_id
          ? { stripeAccount: data.connected_account_id }
          : undefined;
        setStripePromise(loadStripe(stripePublishableKey, opts));
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripePublishableKey, enrollmentIds?.membershipId, form.parentEmail, form.parentFirstName, form.parentLastName]);

  if (loading) {
    return (
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: brand.text, marginBottom: 24 }}>Payment</h2>
        <div style={{ color: brand.textMuted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Initializing secure payment…</div>
      </div>
    );
  }

  if (error) {
    const isStripeNotConfigured = error.includes('Stripe account not configured');
    return (
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: brand.text, marginBottom: 16 }}>Payment</h2>
        <div style={{ padding: '14px 16px', background: brand.dangerBg, borderRadius: 8, color: brand.danger, fontSize: 13, marginBottom: 20 }}>
          <div>{error}</div>
          {isStripeNotConfigured && (
            <div style={{ marginTop: 10, fontSize: 12, color: brand.danger }}>
              Go to <a href="/owner/payments" target="_blank" rel="noopener noreferrer" style={{ color: brand.danger, fontWeight: 700, textDecoration: 'underline' }}>Payments settings</a> to connect a Stripe account for this location, then return here to complete enrollment.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <OButton variant="secondary" icon={ChevronLeft} onClick={onBack}>Back</OButton>
        </div>
      </div>
    );
  }

  if (!stripePromise || !clientSecret) return null;

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: brand.text, marginBottom: 16 }}>Payment</h2>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: brand.gold,
              colorBackground: brand.darker,
              colorText: brand.text,
              colorDanger: brand.danger,
              borderRadius: '8px',
              fontFamily: fonts.body,
            },
          },
        }}
      >
        <PaymentForm
          form={form}
          plans={plans}
          clientSecret={clientSecret}
          intentType={intentType}
          connectedAccountId={connectedAccountId}
          enrollmentIds={enrollmentIds}
          onSuccess={onSuccess}
          onBack={onBack}
        />
      </Elements>
    </div>
  );
}

// ── Confirmation ───────────────────────────────────────────────────────────

function ConfirmationScreen({
  form, plans, onEnrollAnother, onViewMember, memberId,
}: {
  form: FormData;
  plans: MembershipPlan[];
  onEnrollAnother: () => void;
  onViewMember: () => void;
  memberId: string | null;
}) {
  const selectedPlan = plans.find(p => p.id === form.planId);

  return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 36,
        background: brand.successBg, border: `2px solid ${brand.success}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <CheckCircle size={36} color={brand.success} strokeWidth={2} />
      </div>
      <h2 style={{ fontFamily: fonts.display, fontSize: 28, fontWeight: 700, color: brand.text, marginBottom: 8 }}>
        Enrollment Complete!
      </h2>
      <p style={{ fontSize: 15, color: brand.textLight, marginBottom: 4 }}>
        <strong style={{ color: brand.gold }}>{form.kidFirstName}{form.kidLastName ? ' ' + form.kidLastName : ''}</strong> is now enrolled.
      </p>
      {selectedPlan && (
        <p style={{ fontSize: 13, color: brand.textMuted, marginBottom: 4 }}>
          Plan: {selectedPlan.name} · ${(selectedPlan.amount_cents / 100).toFixed(2)}{selectedPlan.plan_type === 'eft' ? '/mo' : ' one-time'}
        </p>
      )}
      <p style={{ fontSize: 13, color: brand.textMuted, marginBottom: 28 }}>
        A welcome email has been sent to <strong style={{ color: brand.text }}>{form.parentEmail}</strong>.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <OButton variant="secondary" icon={UserPlus} onClick={onEnrollAnother}>
          Enroll Another
        </OButton>
        {memberId && (
          <OButton variant="gold" icon={ChevronRight} onClick={onViewMember}>
            View Member
          </OButton>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const INITIAL_FORM: FormData = {
  parentFirstName: '', parentLastName: '', parentEmail: '', parentPhone: '',
  kidFirstName: '', kidLastName: '', ageGroup: '', planId: '', locationId: '',
};

export function EnrollContent({ waiver, stripePublishableKey, locations }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [enrollmentIds, setEnrollmentIds] = useState<{
    familyId: string; kidId: string; membershipId: string;
  } | null>(null);

  // Auto-select the only location when there is exactly one
  useEffect(() => {
    if (locations.length === 1) {
      setForm(prev => ({ ...prev, locationId: locations[0].id }));
    }
  }, [locations]);

  // Preload plans in the background
  useEffect(() => {
    fetch('/api/owner/membership-plans')
      .then(r => r.json())
      .then((data: MembershipPlan[] | { error: string }) => {
        if (Array.isArray(data)) setPlans(data);
      })
      .catch(() => {});
  }, []);

  const handleStep1Next = () => { setSubmitError(null); setStep(2); };
  const handleStep2Next = () => { setSubmitError(null); setStep(3); };
  const handleStep3Next = useCallback(async (signatureDataUrl: string) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/owner/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_first_name: form.parentFirstName,
          parent_last_name: form.parentLastName,
          parent_email: form.parentEmail,
          parent_phone: form.parentPhone || undefined,
          kid_first_name: form.kidFirstName,
          kid_last_name: form.kidLastName || undefined,
          age_group: form.ageGroup || undefined,
          plan_id: form.planId,
          waiver_id: waiver?.id,
          signature_image_data: signatureDataUrl,
          location_id: form.locationId || undefined,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        family_id?: string;
        kid_id?: string;
        membership_id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? `Error ${res.status}`);
        setSubmitting(false);
        return;
      }
      setEnrollmentIds({
        familyId: data.family_id!,
        kidId: data.kid_id!,
        membershipId: data.membership_id!,
      });
      setStep(4);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Enrollment failed');
    }
    setSubmitting(false);
  }, [form, waiver]);

  const handlePaymentSuccess = () => setStep(5);

  const handleEnrollAnother = () => {
    const defaultLocationId = locations.length === 1 ? locations[0].id : '';
    setForm({ ...INITIAL_FORM, locationId: defaultLocationId });
    setEnrollmentIds(null);
    setSubmitError(null);
    setStep(1);
  };

  const handleViewMember = () => {
    if (enrollmentIds?.membershipId) {
      router.push(`/owner/members/${enrollmentIds.membershipId}`);
    } else {
      router.push('/owner/members');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: brand.darkest,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', borderBottom: `1px solid ${brand.border}`,
        background: brand.darker,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/owner/members')}
            style={{ background: 'none', border: 'none', color: brand.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: 0 }}
          >
            <ChevronLeft size={16} /> Members
          </button>
        </div>
        <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 700, color: brand.gold, letterSpacing: 1 }}>
          ENROLL NEW MEMBER
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{
          width: '100%', maxWidth: 760,
          background: brand.surface,
          border: `1px solid ${brand.border}`,
          borderRadius: 14,
          padding: '36px 40px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          {/* Step bar — only show during steps 1-4 */}
          {step < 5 && <StepBar current={step} />}

          {/* Submit error from step 3 (enrollment API) */}
          {submitError && step === 4 && (
            <div style={{
              padding: '12px 16px', background: brand.dangerBg, borderRadius: 8,
              color: brand.danger, fontSize: 13, marginBottom: 20,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{submitError}</span>
              <button onClick={() => setSubmitError(null)} style={{ background: 'none', border: 'none', color: brand.danger, cursor: 'pointer', fontSize: 16, padding: 0, marginLeft: 12 }}>×</button>
            </div>
          )}

          {step === 1 && (
            <Step1 form={form} setForm={setForm} onNext={handleStep1Next} locations={locations} />
          )}

          {step === 2 && (
            <Step2 form={form} setForm={setForm} onNext={handleStep2Next} onBack={() => setStep(1)} />
          )}

          {step === 3 && (
            <>
              {submitError && (
                <div style={{ padding: '12px 16px', background: brand.dangerBg, borderRadius: 8, color: brand.danger, fontSize: 13, marginBottom: 20 }}>
                  {submitError}
                  <button onClick={() => setSubmitError(null)} style={{ background: 'none', border: 'none', color: brand.danger, cursor: 'pointer', fontSize: 16, padding: 0, marginLeft: 12 }}>×</button>
                </div>
              )}
              <Step3
                waiver={waiver}
                form={form}
                onNext={handleStep3Next}
                onBack={() => setStep(2)}
              />
              {submitting && (
                <div style={{ textAlign: 'center', color: brand.textMuted, fontSize: 13, marginTop: 16 }}>
                  Creating account and uploading signature…
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <Step4
              form={form}
              plans={plans}
              stripePublishableKey={stripePublishableKey}
              enrollmentIds={enrollmentIds}
              onSuccess={handlePaymentSuccess}
              onBack={() => setStep(3)}
            />
          )}

          {step === 5 && (
            <ConfirmationScreen
              form={form}
              plans={plans}
              memberId={enrollmentIds?.familyId ?? null}
              onEnrollAnother={handleEnrollAnother}
              onViewMember={handleViewMember}
            />
          )}
        </div>
      </div>
    </div>
  );
}
