import { createServiceClient } from '@/lib/supabase/serviceClient';
import { getBillingData, getLocationsStripeStatus } from '@/lib/supabase/ownerQueries';
import { fetchLocationMrr } from '@/lib/stripe/mrrUtils';
import { BillingContent } from './BillingContent';
import { requireOwnerContext } from '@/lib/ownerAccess';

export default async function BillingPage() {
  const { tenantId } = await requireOwnerContext();
  const supabase = createServiceClient();

  const [data, locations] = await Promise.all([
    getBillingData(supabase, tenantId),
    getLocationsStripeStatus(supabase, tenantId),
  ]);

  // Fetch live MRR from all connected Stripe accounts.
  // When we have a configured Stripe key and at least one connected location,
  // Stripe is the AUTHORITATIVE source for MRR — even if the result is 0
  // (which is a valid state: no active subscriptions yet).
  // We only fall back to the DB-derived value when Stripe is not configured
  // or no locations are connected (i.e., we genuinely cannot reach Stripe).
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const connectedLocations = (locations ?? []).filter(
    l => l.stripe_onboarding_status === 'connected' && l.stripe_account_id,
  );

  const stripeConfigured = Boolean(stripeKey && connectedLocations.length > 0);
  let stripeMrrCents = 0;
  let stripeSubCount = 0;
  let stripeAnySucceeded = false;

  if (stripeConfigured && stripeKey) {
    const results = await Promise.allSettled(
      connectedLocations.map(l => fetchLocationMrr(stripeKey, l.stripe_account_id!)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        stripeMrrCents += r.value.mrrCents;
        stripeSubCount += r.value.activeCount;
        stripeAnySucceeded = true;
      } else {
        // Partial failure — log but still aggregate the accounts that succeeded
        console.error('[billing/page] Stripe MRR fetch error for one account:', r.reason);
      }
    }
  }

  // Use Stripe MRR when at least one connected account fetch succeeded.
  // Partial aggregation: if 3 accounts are connected and 1 fails, we still
  // show live data from the 2 that succeeded rather than falling back to DB.
  // Only fall back to DB when no Stripe data at all could be fetched.
  const useStripeMrr = stripeAnySucceeded;

  const enrichedData = useStripeMrr
    ? {
        ...data,
        kpis: {
          ...data.kpis,
          mrr: stripeMrrCents / 100,
          // Use Stripe-authoritative count including zero — a live count of 0
          // is a valid state (no active subscriptions yet) and should not be
          // masked by the stale DB-derived value.
          activeMembers: stripeSubCount,
        },
      }
    : data;

  return <BillingContent data={enrichedData} />;
}
