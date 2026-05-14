# Stripe Connect Setup — Operator Runbook

This document covers the one-time platform configuration required before any franchise location can accept card payments via Stripe Connect.

---

## 1. Create the Ballpark platform Stripe account

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) and sign up (or log in) with the **platform** email (e.g. `payments@ballparkapp.com`). This is Ballpark's platform account — not a location account.
2. Complete the Stripe identity verification for the platform.
3. Activate your account by providing business details (legal entity, bank account for platform fee payouts).

---

## 2. Enable Stripe Connect

1. In the Stripe Dashboard, navigate to **Connect** → **Settings**.
2. Under **Integration**, select **Express** as the account type.
3. Set your **Platform name** and **Platform website** (e.g. `Ballpark`, `https://ballparkapp.com`).
4. Under **Branding**, upload your logo and set brand colors so the Stripe-hosted onboarding looks on-brand.
5. Enable **OAuth** for Express accounts: **Connect → Settings → OAuth settings → Enable OAuth for Express accounts**.

---

## 3. Get your API keys

From **Developers → API keys**:

| Key | Where to use |
|-----|-------------|
| **Publishable key** (`pk_live_…` or `pk_test_…`) | `STRIPE_PUBLISHABLE_KEY` portal env var |
| **Secret key** (`sk_live_…` or `sk_test_…`) | `STRIPE_SECRET_KEY` portal env var + Supabase secret |

**Never commit secret keys to source control.**

For development use `pk_test_…` / `sk_test_…`. Switch to live keys before going to production.

---

## 4. Get your Connect client ID

From **Connect → Settings → Integration**:

- Copy the **Client ID** (`ca_…`). This is `STRIPE_CONNECT_CLIENT_ID`.
- It is the same for test and live modes (the API key mode controls which environment you're in).

---

## 5. Configure the OAuth redirect URI

In **Connect → Settings → OAuth settings → Redirect URIs**, add:

```
https://<your-portal-domain>/api/stripe/connect/callback
```

For local development with the Replit portal:
```
https://<REPLIT_EXPO_DEV_DOMAIN>/api/stripe/connect/callback
```

The `callback` route expects a `code` and `state` query parameter from Stripe.

---

## 6. Set up the Stripe webhook

1. Go to **Developers → Webhooks → Add endpoint**.
2. Set the **Endpoint URL** to your Supabase Edge Function URL:
   ```
   https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
   ```
3. Under **Events to listen to**, select:
   - `account.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Click **Add endpoint**, then copy the **Signing secret** (`whsec_…`). This is `STRIPE_WEBHOOK_SECRET`.
5. Set it as a Supabase secret:
   ```bash
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## 7. Set environment variables

### Portal (Next.js) — set in Replit environment secrets

```
STRIPE_SECRET_KEY=sk_live_...         (or sk_test_... for dev)
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_CONNECT_CLIENT_ID=ca_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Supabase Edge Functions — set via CLI

The `stripe-webhook` Edge Function reads its keys from Supabase secrets:

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Note:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into every Edge Function — you do not need to set these manually.

---

## 8. Deploy the webhook Edge Function

```bash
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag is required because Stripe's webhook POST carries a `Stripe-Signature` header (not a Supabase JWT). The function authenticates callers by verifying the signature against `STRIPE_WEBHOOK_SECRET`.

`scripts/post-merge.sh` re-deploys this function automatically after every task merge.

---

## 9. Per-location onboarding flow

Once the platform is configured, franchise owners onboard via the portal:

1. Owner logs into the portal → **Config → Payments**.
2. Clicks **Connect Stripe Account**.
3. The portal redirects to Stripe's hosted KYC / Express onboarding flow.
4. After completion, Stripe redirects back to `/api/stripe/connect/callback`.
5. The callback exchanges the OAuth code for the connected account ID and saves it to `locations.stripe_account_id`.
6. The `account.updated` webhook keeps `stripe_onboarding_status` in sync as Stripe verifies details.

---

## 10. Application fee (royalty) configuration

The platform fee rate is stored in `tenants.royalty_config`:

```json
{ "model": "per_transaction", "rate": 0.025 }
```

- **`model`**: `"per_transaction"` (default) or `"monthly_aggregate"`
- **`rate`**: decimal fraction, e.g. `0.025` = 2.5%

The Infinite Hitting tenant is seeded with 2.5% at migration time. To change the rate, update the row directly in Supabase:

```sql
UPDATE tenants
SET royalty_config = '{"model":"per_transaction","rate":0.025}'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000001';
```

Per-location overrides can be added to `royalty_config` JSONB in the future without a schema change.

---

## 11. Testing the integration

Use Stripe's [test mode](https://stripe.com/docs/testing) with `sk_test_…` / `pk_test_…` keys.

To simulate an Express account connection in test mode, use Stripe's [test OAuth flow](https://stripe.com/docs/connect/testing#oauth).

Webhook events can be triggered via the Stripe CLI:

```bash
stripe trigger account.updated
stripe trigger payment_intent.succeeded
```
