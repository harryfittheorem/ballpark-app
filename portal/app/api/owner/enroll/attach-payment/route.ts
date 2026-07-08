/**
 * POST /api/owner/enroll/attach-payment
 *
 * Called after the Stripe intent is confirmed on the client. All payment
 * parameters (plan_type, amount, connected_account_id) are loaded SERVER-SIDE
 * from the DB using membership_id — client values are ignored for security.
 *
 * EFT (SetupIntent confirmed):
 *   1. Load membership + tenant stripe_account_id from DB
 *   2. Retrieve SetupIntent → get payment_method.id
 *   3. Create Stripe customer on the connected account
 *   4. Attach the payment method to the customer + set as default
 *   5. Save card shadow columns + stripe_connected_customer_id to families row
 *   6. Call /api/memberships/activate — returns error if activation fails
 *   7. Send welcome email via Resend
 *
 * OTC (PaymentIntent confirmed):
 *   1. Load membership + tenant stripe_account_id from DB
 *   2. Retrieve PaymentIntent → verify status === 'succeeded'
 *   3. Save card shadow columns to families row
 *   4. Mark membership active via service-role update
 *   5. If split: insert scheduled_charges row for the balance
 *   6. Send welcome email via Resend
 *
 * Body: {
 *   family_id: string,
 *   membership_id: string,
 *   stripe_intent_id: string,   -- SetupIntent or PaymentIntent id
 *   intent_type: 'setup' | 'payment',
 *   split_deposit_cents?: number,   -- OTC split only
 *   split_due_date?: string,        -- OTC split only (YYYY-MM-DD)
 * }
 *
 * Returns: { ok: true, activated: true } or { error: string } with 4xx/5xx
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_VERSION = '2024-06-20';
const RESEND_API = 'https://api.resend.com/emails';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

type CardDetail = { brand: string; last4: string; exp_month: number; exp_year: number };

async function sendWelcomeEmail(opts: {
  parentEmail: string;
  parentFirstName: string;
  kidFirstName: string;
  kidLastName: string | null;
  ageGroup: string | null;
  planName: string;
  planType: string;
  amountCents: number;
  resetLink: string | null;
  splitBalanceCents?: number | null;
  splitDueDate?: string | null;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const resendFrom = process.env.RESEND_FROM_EMAIL ?? 'noreply@infinitehitting.com';
  const depositPaid = opts.splitBalanceCents != null
    ? `$${(opts.amountCents / 100).toFixed(2)} deposit`
    : opts.amountCents > 0
    ? `$${(opts.amountCents / 100).toFixed(2)}${opts.planType === 'eft' ? '/month' : ' (one-time)'}`
    : 'Complimentary';

  const splitNote = opts.splitBalanceCents != null && opts.splitDueDate
    ? `<div style="background:#2D2B2A;border-radius:8px;padding:14px;margin-bottom:16px;border-left:3px solid #F1E5AD;">
        <span style="color:#A8A3A0;font-size:12px;">BALANCE DUE</span><br/>
        <strong style="font-size:15px;">$${(opts.splitBalanceCents / 100).toFixed(2)}</strong>
        <span style="color:#A8A3A0;font-size:12px;margin-left:8px;">due ${opts.splitDueDate}</span>
      </div>`
    : '';

  const emailHtml = `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#1C1B1A;color:#FAF6E8;border-radius:10px;padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:28px;font-weight:900;letter-spacing:3px;color:#F1E5AD;font-family:Oswald,Impact,sans-serif;">BALLPARK</span>
      </div>
      <h1 style="font-size:22px;font-weight:700;color:#F1E5AD;margin:0 0 8px;">Welcome to Infinite Hitting, ${opts.parentFirstName}!</h1>
      <p style="color:#B0ABA8;margin:0 0 20px;">Your enrollment is complete. Here's a summary:</p>
      <div style="background:#2D2B2A;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="margin-bottom:8px;">
          <span style="color:#A8A3A0;font-size:12px;">ATHLETE</span><br/>
          <strong style="font-size:15px;">${opts.kidFirstName}${opts.kidLastName ? ' ' + opts.kidLastName : ''}</strong>
          ${opts.ageGroup ? `<span style="color:#A8A3A0;font-size:12px;margin-left:8px;">${opts.ageGroup}</span>` : ''}
        </div>
        <div>
          <span style="color:#A8A3A0;font-size:12px;">PLAN</span><br/>
          <strong style="font-size:15px;">${opts.planName}</strong>
          <span style="color:#A8A3A0;font-size:12px;margin-left:8px;">${depositPaid} paid today</span>
        </div>
      </div>
      ${splitNote}
      <p style="color:#B0ABA8;margin:0 0 8px;">Your signed agreement is on file. Download the Ballpark app to track progress, book sessions, and stay connected with coaches.</p>
      <div style="margin:24px 0;text-align:center;">
        <a href="https://apps.apple.com/app/ballpark" style="background:#F1E5AD;color:#2D2B2A;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:0 6px 12px;">Download on iOS</a>
        <a href="https://play.google.com/store/apps/ballpark" style="background:#F1E5AD;color:#2D2B2A;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:0 6px 12px;">Get on Android</a>
      </div>
      ${opts.resetLink ? `<p style="color:#B0ABA8;font-size:13px;margin:0 0 6px;">Set your password to sign in to the app:</p><p style="text-align:center;"><a href="${opts.resetLink}" style="color:#F1E5AD;font-weight:700;">Set My Password →</a></p>` : ''}
      <p style="color:#A8A3A0;font-size:11px;margin:24px 0 0;text-align:center;">Infinite Hitting Baseball Academy</p>
    </div>
  `;

  await fetch(RESEND_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: resendFrom,
      to: opts.parentEmail,
      subject: `Welcome to Infinite Hitting, ${opts.parentFirstName}! Your membership is active.`,
      html: emailHtml,
    }),
  }).catch(e => console.warn('[attach-payment] welcome email failed:', e));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return err(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return err(500, 'Stripe not configured');

  let body: {
    family_id?: string;
    membership_id?: string;
    stripe_intent_id?: string;
    intent_type?: string;
    split_deposit_cents?: number;
    split_due_date?: string;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return err(400, 'Invalid JSON body');
  }

  const { family_id, membership_id, stripe_intent_id, split_deposit_cents, split_due_date } = body;
  if (!family_id) return err(422, 'family_id required');
  if (!membership_id) return err(422, 'membership_id required');
  if (!stripe_intent_id) return err(422, 'stripe_intent_id required');

  const serviceClient = createServiceClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // ── Load authoritative payment data from DB (never trust client) ──────────

  const { data: membership } = await serviceClient
    .from('memberships')
    .select('id, tenant_id, family_id, kid_id, plan_type, plan_name, amount_cents, status')
    .eq('id', membership_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!membership) return err(404, 'Membership not found');

  if ((membership as { family_id: string }).family_id !== family_id) {
    return err(403, 'family_id does not match membership');
  }

  const planType = (membership as { plan_type: string }).plan_type as 'eft' | 'otc';
  const amountCents = (membership as { amount_cents: number }).amount_cents;
  const planName = (membership as { plan_name: string }).plan_name;

  // Validate split params server-side
  let isSplit = false;
  let splitBalanceCents: number | null = null;
  if (planType === 'otc' && split_deposit_cents != null && split_due_date) {
    if (split_deposit_cents <= 0 || split_deposit_cents >= amountCents) {
      return err(422, 'Invalid split_deposit_cents');
    }
    const dueDate = new Date(split_due_date + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    if (diffDays < 1 || diffDays > 90) {
      return err(422, 'Balance due date must be 1–90 days from today');
    }
    isSplit = true;
    splitBalanceCents = amountCents - split_deposit_cents;
  }

  // ── Load family details + derive location-scoped Stripe account ──────────

  const { data: familyRow } = await serviceClient
    .from('families')
    .select('id, parent_user_id, parent_first_name, parent_last_name, parent_email, primary_location_id')
    .eq('id', family_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!familyRow) return err(404, 'Family not found');

  const primaryLocationId = (familyRow as { primary_location_id?: string }).primary_location_id ?? null;

  let connectedAccountId: string | null = null;
  if (primaryLocationId) {
    const { data: location } = await serviceClient
      .from('locations')
      .select('stripe_account_id, stripe_onboarding_status')
      .eq('id', primaryLocationId)
      .single();
    const loc = location as { stripe_account_id?: string; stripe_onboarding_status?: string } | null;
    if (loc?.stripe_onboarding_status === 'connected') {
      connectedAccountId = loc.stripe_account_id ?? null;
    }
  }

  if (!connectedAccountId) {
    return err(422, 'Stripe account not configured for this location. Complete Stripe Connect onboarding before enrolling members.');
  }

  const { data: kidRow } = await serviceClient
    .from('kids')
    .select('first_name, last_name, age_group')
    .eq('id', (membership as { kid_id: string }).kid_id)
    .single();

  const stripeHeaders: Record<string, string> = {
    Authorization: `Bearer ${stripeKey}`,
    'Stripe-Version': STRIPE_VERSION,
  };
  if (connectedAccountId) stripeHeaders['Stripe-Account'] = connectedAccountId;

  // ── Derive expected intent type from DB plan_type (authoritative) ─────────
  const expectedIntentType: 'setup' | 'payment' = planType === 'otc' ? 'payment' : 'setup';

  const intentIdPrefix = stripe_intent_id.split('_')[0];
  const validPrefix = expectedIntentType === 'payment' ? 'pi' : 'seti';
  if (intentIdPrefix !== validPrefix) {
    return err(422, `Stripe intent ID prefix "${intentIdPrefix}" does not match plan type "${planType}"`);
  }

  let cardDetails: CardDetail | null = null;

  if (expectedIntentType === 'setup') {
    // ── EFT: SetupIntent flow ─────────────────────────────────────────────

    const siRes = await fetch(
      `https://api.stripe.com/v1/setup_intents/${encodeURIComponent(stripe_intent_id)}?expand[]=payment_method`,
      { headers: stripeHeaders },
    );
    const siData = await siRes.json() as {
      status?: string;
      payment_method?: { id: string; card?: CardDetail };
      error?: { message?: string };
    };

    if (!siRes.ok || siData.status !== 'succeeded') {
      const msg = siData.error?.message ?? `SetupIntent not confirmed (status: ${siData.status ?? 'unknown'})`;
      return err(422, msg);
    }

    const pm = siData.payment_method;
    if (!pm) return err(422, 'No payment method on SetupIntent');
    cardDetails = pm.card ?? null;

    // Create Stripe customer on connected account
    const { data: userRecord } = await serviceClient.auth.admin.getUserById(
      (familyRow as { parent_user_id: string }).parent_user_id,
    );
    const email = userRecord?.user?.email ?? (familyRow as { parent_email: string }).parent_email ?? '';
    const fullName = [
      (familyRow as { parent_first_name: string }).parent_first_name,
      (familyRow as { parent_last_name: string }).parent_last_name,
    ].filter(Boolean).join(' ');

    const custParams = new URLSearchParams();
    if (email) custParams.append('email', email);
    if (fullName) custParams.append('name', fullName);
    custParams.append('metadata[family_id]', family_id);
    custParams.append('metadata[membership_id]', membership_id);

    const custRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: custParams.toString(),
    });
    const custData = await custRes.json() as { id?: string; error?: { message?: string } };

    if (!custRes.ok || !custData.id) {
      const msg = custData.error?.message ?? `Could not create Stripe customer (${custRes.status})`;
      return err(502, msg);
    }
    const customerId = custData.id;

    // Attach payment method to customer
    const attachParams = new URLSearchParams({ customer: customerId });
    const attachRes = await fetch(
      `https://api.stripe.com/v1/payment_methods/${encodeURIComponent(pm.id)}/attach`,
      {
        method: 'POST',
        headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: attachParams.toString(),
      },
    );
    const attachData = await attachRes.json() as { id?: string; error?: { message?: string } };
    if (!attachRes.ok) {
      const msg = attachData.error?.message ?? `Could not attach payment method (${attachRes.status})`;
      return err(502, msg);
    }

    // Set as customer's default payment method
    const updateCustParams = new URLSearchParams();
    updateCustParams.append('invoice_settings[default_payment_method]', pm.id);
    await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
      method: 'POST',
      headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: updateCustParams.toString(),
    });

    // Save card details + customer id to families row
    await serviceClient
      .from('families')
      .update({
        stripe_connected_customer_id: customerId,
        card_last4: cardDetails?.last4 ?? null,
        card_brand: cardDetails?.brand ?? null,
        card_exp_month: cardDetails?.exp_month ?? null,
        card_exp_year: cardDetails?.exp_year ?? null,
      })
      .eq('id', family_id);

    // Activate membership — fail hard on error
    const host = req.headers.get('host') ?? 'localhost:3000';
    const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const activateRes = await fetch(`${proto}://${host}/api/memberships/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ membership_id }),
    });

    if (!activateRes.ok) {
      const activateData = await activateRes.json().catch(() => ({})) as { error?: string };
      const msg = activateData.error ?? `Activation failed (${activateRes.status})`;
      console.error('[enroll/attach-payment] EFT activation failed:', msg);
      return err(activateRes.status >= 500 ? 502 : 422, `Membership activation failed: ${msg}`);
    }

  } else {
    // ── OTC: PaymentIntent flow ───────────────────────────────────────────

    const piRes = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(stripe_intent_id)}?expand[]=payment_method`,
      { headers: stripeHeaders },
    );
    const piData = await piRes.json() as {
      status?: string;
      amount?: number;
      payment_method?: { id: string; card?: CardDetail };
      error?: { message?: string };
    };

    if (!piRes.ok) {
      const msg = piData.error?.message ?? `Could not retrieve PaymentIntent (${piRes.status})`;
      return err(502, msg);
    }

    if (piData.status !== 'succeeded') {
      return err(422, `Payment was not completed (status: ${piData.status ?? 'unknown'}). Please try again.`);
    }

    // Amount tamper guard: for split, check against deposit; for full, check against plan amount
    const expectedAmount = isSplit ? split_deposit_cents! : amountCents;
    if (typeof piData.amount === 'number' && piData.amount !== expectedAmount) {
      console.error(`[attach-payment] Amount mismatch: PI=${piData.amount} expected=${expectedAmount}`);
      return err(422, 'Payment amount does not match. Please contact support.');
    }

    cardDetails = piData.payment_method?.card ?? null;

    // Create Stripe customer on the location-scoped connected account for OTC too
    const { data: userRecord } = await serviceClient.auth.admin.getUserById(
      (familyRow as { parent_user_id: string }).parent_user_id,
    );
    const otcEmail = userRecord?.user?.email ?? (familyRow as { parent_email: string }).parent_email ?? '';
    const otcName = [
      (familyRow as { parent_first_name: string }).parent_first_name,
      (familyRow as { parent_last_name: string }).parent_last_name,
    ].filter(Boolean).join(' ');

    let otcCustomerId: string | null = null;
    const otcCustParams = new URLSearchParams();
    if (otcEmail) otcCustParams.append('email', otcEmail);
    if (otcName) otcCustParams.append('name', otcName);
    otcCustParams.append('metadata[family_id]', family_id);
    otcCustParams.append('metadata[membership_id]', membership_id);

    const otcCustRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: otcCustParams.toString(),
    });
    const otcCustData = await otcCustRes.json() as { id?: string; error?: { message?: string } };

    if (otcCustRes.ok && otcCustData.id) {
      otcCustomerId = otcCustData.id;

      // Attach the card as default so collect-scheduled-charges can charge off-session.
      // For split payments this is REQUIRED — fail the enrollment if it doesn't work.
      if (piData.payment_method?.id) {
        const pmId = piData.payment_method.id;
        const attachParams = new URLSearchParams({ customer: otcCustData.id });
        const attachRes = await fetch(
          `https://api.stripe.com/v1/payment_methods/${encodeURIComponent(pmId)}/attach`,
          {
            method: 'POST',
            headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: attachParams.toString(),
          },
        );
        const attachData = await attachRes.json() as { id?: string; error?: { message?: string } };

        if (!attachRes.ok) {
          const msg = attachData.error?.message ?? `Card attach failed (${attachRes.status})`;
          if (isSplit) {
            // For split payments the card on file is mandatory — fail hard.
            return err(502, `Could not save card for future balance collection: ${msg}. Please try again.`);
          }
          // Non-split: log and continue — card storage is best-effort.
          console.warn('[attach-payment] OTC card attach failed (non-split, continuing):', msg);
        } else {
          // Set as customer's default payment method
          const updateCustParams = new URLSearchParams();
          updateCustParams.append('invoice_settings[default_payment_method]', pmId);
          const updateCustRes = await fetch(
            `https://api.stripe.com/v1/customers/${encodeURIComponent(otcCustData.id)}`,
            {
              method: 'POST',
              headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: updateCustParams.toString(),
            },
          );
          if (!updateCustRes.ok && isSplit) {
            const ud = await updateCustRes.json() as { error?: { message?: string } };
            const msg = ud.error?.message ?? `Customer update failed (${updateCustRes.status})`;
            return err(502, `Could not set default payment method for balance collection: ${msg}. Please try again.`);
          }
        }
      } else if (isSplit) {
        // PI has no payment_method attached — cannot schedule the balance charge
        return err(422, 'No payment method found on the confirmed payment. Cannot schedule balance charge.');
      }
    } else {
      const msg = otcCustData.error?.message ?? `Customer creation failed (${otcCustRes.status})`;
      if (isSplit) {
        // For split payments, Stripe customer is required for future collection.
        return err(502, `Could not create Stripe customer for balance collection: ${msg}. Please try again.`);
      }
      console.warn('[attach-payment] OTC customer creation failed (non-split, continuing):', msg);
    }

    // Save card shadow columns + customer id to families row
    const otcFamilyUpdate: Record<string, unknown> = {
      card_last4: cardDetails?.last4 ?? null,
      card_brand: cardDetails?.brand ?? null,
      card_exp_month: cardDetails?.exp_month ?? null,
      card_exp_year: cardDetails?.exp_year ?? null,
    };
    if (otcCustomerId) otcFamilyUpdate.stripe_connected_customer_id = otcCustomerId;

    await serviceClient
      .from('families')
      .update(otcFamilyUpdate)
      .eq('id', family_id);

    if (isSplit && splitBalanceCents != null && split_due_date) {
      // ── OTC split: activate membership + create scheduled charge ATOMICALLY ──
      // Uses a SECURITY DEFINER RPC so both ops happen in one transaction;
      // any failure rolls back both and returns an error to the client.
      if (!otcCustomerId) {
        // Stripe customer creation failed → we have no card on file for future
        // collection → we cannot complete the split enrollment safely.
        return err(502, 'Could not create Stripe customer. The balance cannot be scheduled without a card on file. Please try again.');
      }

      const { error: rpcErr } = await serviceClient
        .rpc('activate_membership_with_scheduled_charge', {
          p_membership_id: membership_id,
          p_tenant_id:     tenantId,
          p_family_id:     family_id,
          p_amount_cents:  splitBalanceCents,
          p_charge_date:   split_due_date,
        });

      if (rpcErr) {
        console.error('[enroll/attach-payment] atomic RPC error:', rpcErr.message);
        return err(500, `Could not activate membership and schedule balance charge: ${rpcErr.message}`);
      }
      console.log(`[enroll/attach-payment] atomic activation + scheduled_charges — balance=${splitBalanceCents} due=${split_due_date}`);
    } else {
      // ── OTC non-split: activate membership only ──────────────────────────
      const { error: activateErr } = await serviceClient
        .from('memberships')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', membership_id)
        .eq('tenant_id', tenantId);

      if (activateErr) {
        console.error('[enroll/attach-payment] OTC activate error:', activateErr.message);
        return err(500, `Could not activate membership: ${activateErr.message}`);
      }
    }
  }

  // ── Send welcome email now that membership is confirmed active ────────────
  let resetLink: string | null = null;
  try {
    const parentEmail = (familyRow as { parent_email: string }).parent_email ?? '';
    const resetRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ type: 'recovery', email: parentEmail }),
    });
    const resetBody = await resetRes.json() as { action_link?: string };
    resetLink = resetBody.action_link ?? null;
  } catch {
    // reset link is best-effort; email still sends
  }

  await sendWelcomeEmail({
    parentEmail: (familyRow as { parent_email: string }).parent_email ?? '',
    parentFirstName: (familyRow as { parent_first_name: string }).parent_first_name ?? '',
    kidFirstName: kidRow ? (kidRow as { first_name: string }).first_name : '',
    kidLastName: kidRow ? ((kidRow as { last_name: string | null }).last_name ?? null) : null,
    ageGroup: kidRow ? ((kidRow as { age_group: string | null }).age_group ?? null) : null,
    planName,
    planType,
    amountCents: isSplit ? split_deposit_cents! : amountCents,
    resetLink,
    splitBalanceCents: isSplit ? splitBalanceCents : null,
    splitDueDate: isSplit ? split_due_date : null,
  });

  return NextResponse.json({ ok: true, activated: true });
}
