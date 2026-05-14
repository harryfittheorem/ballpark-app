/**
 * Shared Stripe MRR fetch utility.
 *
 * Used by:
 *   - portal/app/owner/billing/page.tsx  (server component, called server-side)
 *   - portal/app/api/stripe/mrr/route.ts (API route, called by client dashboards)
 *
 * Paginates through all active subscriptions on a single connected account and
 * returns the total MRR (in cents) and active subscription count for that account.
 *
 * Throws on Stripe HTTP errors so Promise.allSettled callers can distinguish
 * a genuine zero from a fetch failure — preventing silent MRR underreporting.
 */

const STRIPE_API_VERSION = '2024-06-20';

export interface LocationMrrResult {
  mrrCents: number;
  activeCount: number;
}

/**
 * Fetch live MRR for a single connected Stripe account.
 * Paginates automatically (up to 100 subscriptions per page).
 *
 * Throws on non-OK Stripe responses — callers should wrap in try/catch or use
 * Promise.allSettled, so a single account failure does not mask other accounts'
 * real data and can be logged/reported distinctly.
 */
export async function fetchLocationMrr(
  stripeKey: string,
  connectedAccountId: string,
): Promise<LocationMrrResult> {
  let mrrCents = 0;
  let activeCount = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params = new URLSearchParams({ status: 'active', limit: '100' });
    if (startingAfter) params.set('starting_after', startingAfter);

    const res = await fetch(`https://api.stripe.com/v1/subscriptions?${params}`, {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Stripe-Account': connectedAccountId,
        'Stripe-Version': STRIPE_API_VERSION,
      },
    });

    if (!res.ok) {
      // Throw so Promise.allSettled registers this as a rejection — callers can
      // then log the failure and still aggregate the accounts that succeeded.
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(
        body.error?.message ?? `Stripe responded ${res.status} for account ${connectedAccountId}`,
      );
    }

    const data = await res.json() as {
      data: Array<{
        id: string;
        status: string;
        items: {
          data: Array<{
            price: { unit_amount: number; recurring?: { interval: string } };
          }>;
        };
      }>;
      has_more: boolean;
    };

    for (const sub of data.data) {
      if (sub.status !== 'active' && sub.status !== 'trialing') continue;
      // Count the subscription once (not once per item), then sum all monthly item amounts.
      let subHasMonthlyItem = false;
      for (const item of sub.items?.data ?? []) {
        if (item.price?.recurring?.interval === 'month') {
          mrrCents += item.price.unit_amount ?? 0;
          subHasMonthlyItem = true;
        }
      }
      if (subHasMonthlyItem) activeCount += 1;
    }

    hasMore = data.has_more;
    if (hasMore && data.data.length > 0) {
      startingAfter = data.data[data.data.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  return { mrrCents, activeCount };
}
