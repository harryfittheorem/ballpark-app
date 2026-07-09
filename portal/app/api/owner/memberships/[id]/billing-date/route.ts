/**
 * POST /api/owner/memberships/[id]/billing-date
 *
 * Staff action: change a member's recurring billing date, either permanently
 * or for the next payment only.
 *
 * Body: {
 *   new_anchor_day: number   (1–28)
 *   change_type: 'permanent' | 'one_time'
 * }
 *
 * Permanent: updates Stripe subscription's billing_cycle_anchor to next
 * occurrence of the chosen day (proration_behavior=none), updates
 * memberships.billing_anchor_day, inserts audit row, sends parent email.
 *
 * One-time: sets trial_end on the subscription to the next occurrence of the
 * chosen day (defers the next invoice to that date), preserves original
 * billing_anchor_day in DB, inserts audit row. The stripe-webhook
 * invoice.payment_succeeded handler automatically reverts billing_cycle_anchor
 * back to the original anchor after that invoice clears.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_API_VERSION = '2024-06-20';

function clientErr(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function encodeForm(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function stripePatch(
  path: string,
  secretKey: string,
  params: Record<string, string | number>,
  connectedAccountId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
      'Stripe-Account': connectedAccountId,
    },
    body: encodeForm(params),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe error ${res.status}`);
  }
  return data;
}

function nextOccurrenceTimestamp(day: number): { ts: number; date: Date } {
  const now = new Date();
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 0, 0, 0));
  if (candidate.getTime() <= now.getTime()) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }
  return { ts: Math.floor(candidate.getTime() / 1000), date: candidate };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatDate(d: Date): string {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

async function sendBillingDateEmail(opts: {
  toEmail: string;
  parentName: string;
  planName: string;
  changeType: 'permanent' | 'one_time';
  newDay: number;
  oldDay: number;
  effectiveDate: Date;
  resendKey: string;
  resendFrom: string;
}) {
  const { toEmail, parentName, planName, changeType, newDay, oldDay, effectiveDate, resendKey, resendFrom } = opts;
  const newDayOrdinal = ordinal(newDay);
  const oldDayOrdinal = ordinal(oldDay);
  const effectiveDateStr = formatDate(effectiveDate);

  const subject = changeType === 'permanent'
    ? `Your billing date has been updated — ${planName}`
    : `Your next payment date has been moved — ${planName}`;

  const bodyText = changeType === 'permanent'
    ? [
        `Hi ${parentName},`,
        '',
        `Your billing date for ${planName} has been updated to the ${newDayOrdinal} of each month.`,
        `This change takes effect with your next billing on ${effectiveDateStr}.`,
        '',
        'Questions? Contact your facility directly.',
      ].join('\n')
    : [
        `Hi ${parentName},`,
        '',
        `Your next payment for ${planName} has been moved to ${effectiveDateStr}.`,
        `Future payments will continue on the ${oldDayOrdinal} of each month as normal.`,
        '',
        'Questions? Contact your facility directly.',
      ].join('\n');

  const bodyHtml = changeType === 'permanent'
    ? `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#1a1a1a;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:#d4a843;font-size:22px;margin:0;font-weight:700;letter-spacing:1px;">BALLPARK SPORTS</h1>
        </div>
        <div style="padding:32px;background:#fff;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
          <h2 style="font-size:18px;margin-bottom:12px;">Billing date updated</h2>
          <p>Hi ${parentName},</p>
          <p>Your billing date for <strong>${planName}</strong> has been updated to the
          <strong>${newDayOrdinal} of each month</strong>.</p>
          <p>This change takes effect with your next billing on <strong>${effectiveDateStr}</strong>.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;"/>
          <p style="color:#888;font-size:12px;">Questions? Reply to this email or contact your facility directly.</p>
        </div>
      </div>`
    : `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#1a1a1a;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:#d4a843;font-size:22px;margin:0;font-weight:700;letter-spacing:1px;">BALLPARK SPORTS</h1>
        </div>
        <div style="padding:32px;background:#fff;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
          <h2 style="font-size:18px;margin-bottom:12px;">Next payment date moved</h2>
          <p>Hi ${parentName},</p>
          <p>Your next payment for <strong>${planName}</strong> has been moved to
          <strong>${effectiveDateStr}</strong>.</p>
          <p>Future payments will continue on the <strong>${oldDayOrdinal} of each month</strong> as normal.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;"/>
          <p style="color:#888;font-size:12px;">Questions? Reply to this email or contact your facility directly.</p>
        </div>
      </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: toEmail,
      subject,
      text: bodyText,
      html: bodyHtml,
    }),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: membershipId } = await params;
  if (!membershipId) return clientErr(400, 'Missing membership id');

  const userClient = await createClient();
  const { data: { session } } = await userClient.auth.getSession();
  if (!session) return clientErr(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return clientErr(403, 'Forbidden');

  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';
  if (!tenantId) return clientErr(403, 'No tenant in token — re-authenticate');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return clientErr(500, 'Stripe not configured');

  const body = await req.json().catch(() => ({})) as {
    new_anchor_day?: unknown;
    change_type?: unknown;
  };

  const newAnchorDay = typeof body.new_anchor_day === 'number' ? Math.round(body.new_anchor_day) : NaN;
  const changeType = body.change_type as string | undefined;

  if (isNaN(newAnchorDay) || newAnchorDay < 1 || newAnchorDay > 28) {
    return clientErr(422, 'new_anchor_day must be an integer between 1 and 28');
  }
  if (changeType !== 'permanent' && changeType !== 'one_time') {
    return clientErr(422, 'change_type must be "permanent" or "one_time"');
  }

  const supabase = createServiceClient();

  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select(`
      id, plan_name, plan_type, status, billing_anchor_day,
      stripe_subscription_id, tenant_id, family_id,
      families!inner(
        id, stripe_connected_customer_id, primary_location_id,
        parent_first_name, parent_last_name, parent_email
      )
    `)
    .eq('id', membershipId)
    .eq('tenant_id', tenantId)
    .single();

  if (memErr || !mem) {
    return clientErr(404, 'Membership not found or access denied');
  }

  if (mem.plan_type !== 'eft') {
    return clientErr(422, 'Billing date changes only apply to EFT (recurring) memberships');
  }
  if (!mem.stripe_subscription_id) {
    return clientErr(422, 'No active Stripe subscription linked to this membership');
  }

  const fam = mem.families as unknown as {
    id: string;
    stripe_connected_customer_id: string | null;
    primary_location_id: string;
    parent_first_name: string;
    parent_last_name: string | null;
    parent_email: string;
  };

  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('stripe_account_id')
    .eq('id', fam.primary_location_id)
    .single();

  if (locErr || !location?.stripe_account_id) {
    return clientErr(422, 'Location Stripe account not configured');
  }

  const connectedAccountId = location.stripe_account_id as string;
  const oldAnchorDay = (mem.billing_anchor_day as number | null) ?? 1;

  const { ts: anchorTs, date: effectiveDate } = nextOccurrenceTimestamp(newAnchorDay);

  try {
    if (changeType === 'permanent') {
      // Stripe's subscription-update endpoint only accepts billing_cycle_anchor
      // values of 'now' or 'unchanged' — an arbitrary future timestamp is
      // rejected. To move the anchor to a future date, defer the next invoice
      // via trial_end (same mechanism as the one-time path); once that invoice
      // is billed, Stripe recalculates subsequent cycles from that date, so
      // the shift is effectively permanent since we never revert it.
      await stripePatch(
        `subscriptions/${mem.stripe_subscription_id}`,
        stripeKey,
        { trial_end: anchorTs },
        connectedAccountId,
      );

      await supabase
        .from('memberships')
        .update({
          billing_anchor_day: newAnchorDay,
          next_billing_at: effectiveDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', membershipId)
        .eq('tenant_id', tenantId);

    } else {
      await stripePatch(
        `subscriptions/${mem.stripe_subscription_id}`,
        stripeKey,
        { trial_end: anchorTs },
        connectedAccountId,
      );

      await supabase
        .from('memberships')
        .update({
          next_billing_at: effectiveDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', membershipId)
        .eq('tenant_id', tenantId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[billing-date] Stripe error:', msg);
    return clientErr(502, msg);
  }

  const { error: auditErr } = await supabase
    .from('membership_billing_date_changes')
    .insert({
      membership_id: membershipId,
      changed_by_user_id: session.user.id,
      old_anchor_day: oldAnchorDay,
      new_anchor_day: newAnchorDay,
      change_type: changeType,
      effective_date: effectiveDate.toISOString().slice(0, 10),
    });

  if (auditErr) {
    console.error('[billing-date] audit insert failed:', auditErr.message);
    return clientErr(500, `Billing date was updated on Stripe but audit log failed to save: ${auditErr.message}`);
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL ?? 'noreply@infinitehitting.com';

  if (resendKey && fam.parent_email) {
    await sendBillingDateEmail({
      toEmail: fam.parent_email,
      parentName: [fam.parent_first_name, fam.parent_last_name].filter(Boolean).join(' ') || 'there',
      planName: mem.plan_name,
      changeType,
      newDay: newAnchorDay,
      oldDay: oldAnchorDay,
      effectiveDate,
      resendKey,
      resendFrom,
    }).catch(err => console.error('[billing-date] email error:', err));
  }

  console.log(`[billing-date] membership=${membershipId} change_type=${changeType} new_day=${newAnchorDay} old_day=${oldAnchorDay} effective=${effectiveDate.toISOString()}`);

  return NextResponse.json({
    ok: true,
    change_type: changeType,
    new_anchor_day: newAnchorDay,
    old_anchor_day: oldAnchorDay,
    effective_date: effectiveDate.toISOString().slice(0, 10),
    next_billing_at: effectiveDate.toISOString(),
  });
}
