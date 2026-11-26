# Marketing data contract (v1)

Marketing reads this contract. It does not own CRM intake, messaging, identity, bookings, or billing writes. The migration `supabase/migrations/20261126120000_marketing_phase2_read_contract.sql` is **not applied**. Dev and prod Supabase are one project, so applying it needs Harry's approval.

Until the replacement projections below are installed, `mkt_contract_health_v1()` returns `lead_origin_ready = false` and `receipts_ready = false`. The Marketing performance view then shows **unavailable**, not zero.

## What Marketing reads

| Object | Who writes | What it is |
|---|---|---|
| `mkt_lead_origins_v1` | CRM, via the columns below. Marketing only selects. | One row per genuine first inquiry. |
| `mkt_receipts_v1` | Billing, via the columns below. Marketing only selects. | One row per cash movement, net of tax. |
| `mkt_acquisition_expenses` | Marketing, after approval. No app write path in this phase. | Agency fees and other acquisition costs. Not Stripe. |
| `mkt_acquisition_expense_edits` | Trigger on expense update. | Edit history. |
| `mkt_contract_health_v1()` | Replaced in the same change as the views. | Tells the app whether the contract is populated. |

Both views are `security_invoker`. Callers only see rows their existing RLS already allows (`crm_can_access` for threads, owner policies for payments, orders, and families).

The current view bodies compile against today's tables. They leave origin and net cash null on purpose:

- `crm_threads` has no source, campaign, ad, form, UTM, or first-inquiry time. `family_id` is projected only when `data->>'verified' = 'true'`.
- `payment_events.amount_cents` is `invoice.amount_paid`, which includes tax. The view exposes that as `gross_cents` and sets `net_cents` to null. It does **not** treat gross as collected revenue.
- `payment_events` has no collecting location, currency, or provider paid-at time. `created_at` is when the webhook arrived, so `cash_at` is null. `location_id` is only `families.primary_location_id`, labeled `location_basis = family_primary_location_proxy`.
- Refunds and disputes are not written by the webhook today. A `status = 'refunded'` row would appear as `kind = 'refund'`, but that status is not produced.
- Paid `payment_events` rows are de-duplicated in the view on `(stripe_invoice_id, status)` because `invoice.paid` and `invoice.payment_succeeded` share a status check, not a unique key. That read-side guard is not a substitute for a unique constraint.
- Card store `orders` are included as `product_class = 'store'`. Points orders are not cash. Pending, failed, and cancelled orders are excluded.
- `crm_locations` is not granted to `authenticated`, so `facility_tz` uses `locations.timezone` until CRM exposes its own timezone on the view.

## Fields the CRM owner must add

Add these on the inquiry the staff already stores (`crm_threads` or a future lead row). Do not guess them from name, amount, or a shared phone. Keep one immutable first-touch origin per new family. Later touches are assists. A returning payer is `is_reactivation`, not a new acquisition.

| Column | Type | Rule |
|---|---|---|
| `first_inquiry_at` | `timestamptz` | First inquiry, not a later message. Required for a cohort. |
| `external_event_id` | `text` | Provider submission or event id. Null for staff-entered. |
| `origin_channel` | `text` | `meta_form`, `web`, `phone`, `walk_in`, `referral`, `organic`, or `unknown`. |
| `meta_campaign_id` | `text` | Set for a Meta form or a mapped paid landing. |
| `meta_adset_id` | `text` | Ad set when the form or click has one. |
| `meta_ad_id` | `text` | Ad when known. Campaign-only UTMs stay campaign-level. |
| `meta_form_id` | `text` | Lead form id when the source is a Meta form. |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | `text` | Captured on `/book` or the landing page. |
| `fbclid_present` | `boolean` | True when a click id was present. Do not store the raw click id in this view. |
| `origin_evidence` | `text` | `form_submission`, `utm_mapping`, or `staff_entered`. |
| `origin_confidence` | `text` | CRM's own scale. Marketing does not invent one. |
| `override_reason` | `text` | Why a staff member replaced the original origin. |
| `override_actor` | `uuid` | Who replaced it. |
| `origin_version` | `integer` | Starts at 1. Increment on an approved override. |
| `is_reactivation` | `boolean` | True when the person was already a payer before this inquiry. |

`family_id` stays the staff-verified link that exists today. Unverified threads keep a null family in the view.

Organic, referral, unknown, and unmapped inquiries stay visible. They are not dropped and they are not given a campaign by spreading leftover cash.

## Fields the billing owner must add

Add these on `payment_events` and the card `orders` that represent cash. Marketing will not change `supabase/functions/stripe-webhook` or the enroll payment route.

| Column | Type | Rule |
|---|---|---|
| `location_id` | `uuid` | Location that collected the cash. Not only `families.primary_location_id`. |
| `currency` | `text` | ISO currency from the provider. Do not assume USD. |
| `cash_at` | `timestamptz` | Provider paid, refunded, or dispute time. Not webhook `created_at`. |
| `gross_cents` | `integer` | Provider amount before the tax split. |
| `tax_cents` | `integer` | Sales tax and other pass-through amounts. Required before net can be shown. |
| `net_cents` | `integer` | Signed. Payments and recoveries positive. Refunds and lost chargebacks negative. |
| `kind` | `text` | `payment`, `refund`, `chargeback`, or `recovery`. |
| `product_class` | `text` | `membership`, `pack`, `store`, `camp`, or `other`. |
| `provider` | `text` | `stripe`, `cash`, or `import`. |
| `provider_ref` | `text` | Invoice, payment intent, charge, or refund id. |
| `service_start`, `service_end` | `timestamptz` | Service period. Independent of `cash_at`. |
| `is_first_paid` | `boolean` | First successful cash for the family. Null when history is unverified. |

Also required from billing, with no Marketing code change:

- Record refunds and disputes (`charge.refunded`, `charge.dispute.*`), including adjustments after cancellation.
- Unique `(provider, provider_ref, kind)` or an equivalent so `invoice.paid` and `invoice.payment_succeeded` cannot insert two paid rows.
- Keep failed and pending invoices out of this view.
- Say explicitly how gift cards, credits, split tenders, and missing historical refunds should be treated before those lines are turned on. Until then they stay out.
- Direct delivery cost (coach time and consumables) or a versioned margin is still absent. Gross profit stays unavailable on live data until one of those exists. The July fixture supplies sample direct costs and labels them as a sample.

## Replacement projections

Install these in a later migration, together with a `mkt_contract_health_v1()` body that returns true only when the columns exist. Do not point the app at gross tax-inclusive amounts.

```sql
CREATE OR REPLACE VIEW public.mkt_lead_origins_v1
WITH (security_invoker = true) AS
SELECT
  t.tenant_id,
  t.location_id,
  t.id AS lead_id,
  t.external_event_id,
  t.first_inquiry_at AS created_at,
  loc.timezone AS facility_tz,
  t.origin_channel AS channel,
  t.meta_campaign_id,
  t.meta_adset_id,
  t.meta_ad_id,
  t.meta_form_id,
  t.utm_source,
  t.utm_medium,
  t.utm_campaign,
  t.utm_content,
  t.utm_term,
  t.fbclid_present,
  t.origin_evidence,
  t.origin_confidence,
  t.override_reason,
  t.override_actor,
  t.origin_version,
  CASE WHEN t.family_id IS NOT NULL AND t.data ->> 'verified' = 'true' THEN t.family_id ELSE NULL END AS family_id,
  NULL::timestamptz AS first_paid_at,
  t.is_reactivation,
  (t.first_inquiry_at IS NOT NULL AND t.origin_channel IS NOT NULL) AS contract_ready
FROM public.crm_threads t
LEFT JOIN public.locations loc ON loc.id = t.location_id AND loc.tenant_id = t.tenant_id;
```

`first_paid_at` stays null in that sketch until billing has `cash_at` and a verified family link. The receipts view should then set `net_cents`, `tax_cents`, `currency`, `cash_at`, and the collecting `location_id` from the new columns. `contract_ready` is true only when `net_cents`, `currency`, `cash_at`, and `location_id` are all present.

```sql
CREATE OR REPLACE FUNCTION public.mkt_contract_health_v1()
RETURNS TABLE (lead_origin_ready boolean, receipts_ready boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_threads' AND column_name = 'first_inquiry_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crm_threads' AND column_name = 'origin_channel'
    ),
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_events' AND column_name = 'net_cents'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_events' AND column_name = 'cash_at'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_events' AND column_name = 'currency'
    );
$$;
```

Flip that function only in the migration that also replaces the view bodies. Adding columns without replacing the views would otherwise let the app treat null origins as zero leads.

## How the numbers are defined

Amounts are integer minor units. Ratios use summed numerators and denominators. Null stays null.

- Media CPL = Meta spend / CRM leads from the paid source.
- Tracked CAC = (Meta spend + approved acquisition fees) / distinct first-time paying families.
- Media ROAS = net collections / Meta spend.
- All-in return = net collections / acquisition cost.
- Gross profit = net collections − direct delivery cost.
- LTGP per family = gross profit / acquired families.
- LTGP:CAC = gross profit / acquisition cost.
- Marketing ROI = (gross profit − acquisition cost) / acquisition cost.
- Contribution = gross profit − acquisition cost.
- Payback is the first observed checkpoint (day 30, day 90, or realized age) where gross profit covers acquisition cost. It is not a forecast.
- A recurring fee is split across the actual days in each month (28, 29, 30, or 31), then clipped to the cohort window. It is not divided by 30.
- A media invoice is not added on top of Meta spend.
- With no media spend, a location fee stays unallocated. It is not spread across campaigns.
- Cash collected at another location is left out and the cohort total becomes unavailable rather than a partial number.
- Direct cost is not connected on live data, so live gross profit, LTGP, ROI, contribution, and payback stay unavailable even after cash connects.

The July 2026 fixture (fee $1,000) is the package sample: $3,000 media, 100 leads, 20 payers, $12,000 net, $3,600 direct cost. It is labeled sample data and is not provider-verified.
