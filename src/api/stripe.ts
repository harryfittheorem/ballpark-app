/**
 * Stripe card payment API helpers.
 *
 * Calls the `stripe-create-payment-intent` Edge Function to obtain
 * a client secret, Stripe Customer context, and ephemeral key for
 * the Stripe payment sheet, then surfaces the response to
 * StoreCheckoutScreen for presentation.
 *
 * Also calls `stripe-setup-intent` to save a payment method for
 * recurring membership subscription billing (Phase 3).
 */

import { supabase } from '@/lib/supabase';

export type CardPaymentIntentResult = {
  clientSecret: string;
  customerId: string;
  ephemeralKeySecret: string;
  orderId: string;
  redemptionCode: string;
  amountCents: number;
};

/**
 * Creates a Stripe PaymentIntent for a store item purchase and returns
 * the data needed to present the Stripe payment sheet.
 */
export async function createCardPaymentIntent(input: {
  productId: string;
  kidId: string;
}): Promise<CardPaymentIntentResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL not configured');

  const res = await fetch(
    `${supabaseUrl}/functions/v1/stripe-create-payment-intent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: input.productId,
        kid_id: input.kidId,
      }),
    },
  );

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { code?: string };
    err.code = json?.error?.code ?? 'unknown';
    throw err;
  }

  return {
    clientSecret: json.client_secret,
    customerId: json.customer_id,
    ephemeralKeySecret: json.ephemeral_key_secret,
    orderId: json.order_id,
    redemptionCode: json.redemption_code,
    amountCents: json.amount_cents,
  };
}

export type SetupIntentResult = {
  setupIntentClientSecret: string;
  customerId: string;
  ephemeralKeySecret: string;
  stripeAccountId: string;
};

/**
 * Creates a Stripe SetupIntent for saving a payment method for recurring
 * membership billing. The returned secrets are passed to initPaymentSheet
 * in SetupIntent mode to save the card without charging it.
 */
export async function createSetupIntent(): Promise<SetupIntentResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL not configured');

  const res = await fetch(
    `${supabaseUrl}/functions/v1/stripe-setup-intent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { code?: string };
    err.code = json?.error?.code ?? 'unknown';
    throw err;
  }

  return {
    setupIntentClientSecret: json.setup_intent_client_secret,
    customerId: json.customer_id,
    ephemeralKeySecret: json.ephemeral_key_secret,
    stripeAccountId: json.stripe_account_id,
  };
}
