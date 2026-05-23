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
 *
 * `savePaymentMethod` / `getCardOnFile` added in Task #233 for
 * in-app payment method management.
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

// ── Card-on-file (Task #233) ──────────────────────────────────────────────────

export type CardOnFile = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

/**
 * Reads the card shadow columns from the calling parent's `families` row.
 * Returns null when no card has been saved yet.
 */
export async function getCardOnFile(): Promise<CardOnFile | null> {
  const { data, error } = await supabase
    .from('families')
    .select('card_brand, card_last4, card_exp_month, card_exp_year')
    .single();

  if (error || !data) return null;

  const { card_brand, card_last4, card_exp_month, card_exp_year } = data as unknown as {
    card_brand: string | null;
    card_last4: string | null;
    card_exp_month: number | null;
    card_exp_year: number | null;
  };

  if (!card_last4) return null;

  return {
    brand: card_brand ?? '',
    last4: card_last4,
    expMonth: card_exp_month ?? 0,
    expYear: card_exp_year ?? 0,
  };
}

/**
 * Calls the `save-payment-method` Edge Function after a successful
 * Stripe PaymentSheet confirmation. The function retrieves the newly
 * attached card from Stripe, sets it as default, and writes the four
 * shadow display columns back to `families`.
 *
 * Returns the saved card details for immediate UI update.
 */
export async function savePaymentMethod(): Promise<CardOnFile> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL not configured');

  const res = await fetch(
    `${supabaseUrl}/functions/v1/save-payment-method`,
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
    brand: json.card_brand ?? '',
    last4: json.card_last4 ?? '',
    expMonth: json.card_exp_month ?? 0,
    expYear: json.card_exp_year ?? 0,
  };
}
