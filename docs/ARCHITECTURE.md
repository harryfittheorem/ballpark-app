# Architecture & Technical Decisions

> Authoritative technical reference. Every decision documented here is binding for v0.1-v0.5 unless explicitly revisited.

---

## 1. Stack Overview

```
┌────────────────────────────────────────────┐
│       React Native + Expo App (mobile)      │
│  Development: Replit (shared workspace)     │
│  Testing: Expo Go on phones via tunnel      │
│  Production builds: Expo EAS (cloud)        │
└─────────────────┬──────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────┐
│              Supabase                        │
│  • Postgres (data)                           │
│  • Auth (JWT, email/password)                │
│  • Storage (avatars, message attachments)    │
│  • Realtime (messages, leaderboards)         │
│  • Edge Functions (custom server logic)      │
└─────────────────┬──────────────────────────┘
                  │
   ┌──────────────┼──────────────┐
   ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│ Stripe │  │   Mux    │  │  Twilio  │
│Connect │  │ (videos) │  │  (SMS)   │
└────────┘  └──────────┘  └──────────┘
            ▼
       ┌──────────┐
       │  Resend  │
       │ (email)  │
       └──────────┘
```

---

## 2. Replit-Specific Architecture Notes

### Why Replit doesn't host the app itself

Replit hosts the **development environment** — the code, the build tools, the dev server. But the actual production app isn't deployed from Replit.

- **Mobile app:** Production builds via Expo EAS Build (cloud builds), distributed via TestFlight (iOS) and Play Store (Android)
- **Edge Functions:** Deployed to Supabase, not Replit
- **Database:** Hosted on Supabase, not Replit

Replit is the editor + dev environment. Everything else lives elsewhere.

### Why this matters
- Replit Deployments are not used for this project
- Production environment variables live in Supabase (Edge Functions) and EAS (mobile)
- Replit Secrets are for development only

---

## 3. Multi-Tenant Architecture

### The model

Every meaningful record is tenant-scoped via a `tenant_id` column. **`tenant_id` is always a UUID** — never a slug. Infinite Hitting's tenant UUID is hardcoded for predictable local dev: `00000000-0000-0000-0000-000000000001`. The human-readable slug (`'infinitehitting'`) lives in `tenants.slug` as a separate column for URL routing only. JWT custom claims always carry the UUID.

### Tenant resolution

For v0.x: tenant is determined by app build (each franchise gets a branded build with `EXPO_PUBLIC_TENANT_SLUG` baked in).

For v1.x: support runtime tenant detection from subdomain or magic link.

### Data isolation

**Row-Level Security (RLS) is mandatory on every table.** Standard policy template:

```sql
-- Example RLS policy on `bookings` table
CREATE POLICY "tenant_isolation" ON bookings
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Family members can only see their own kids' bookings
CREATE POLICY "family_can_see_own_bookings" ON bookings
  FOR SELECT
  USING (kid_id IN (
    SELECT id FROM kids WHERE family_id IN (
      SELECT id FROM families WHERE parent_user_id = auth.uid()
    )
  ));
```

### Service role usage

The service role key bypasses RLS. **Use ONLY in:**
- Edge functions (server-side)
- Admin scripts
- Migrations and seeds

**NEVER use the service role key in the mobile app.** The mobile app uses the anon key + JWT.

---

## 4. Authentication Architecture

### Flow

```
1. Parent signs up (email + password) via Supabase Auth
2. A trigger on auth.users INSERT calls handle_new_user() which:
   - Creates a row in `families` with parent_user_id = NEW.id
   - Sets tenant_id from EXPO_PUBLIC_TENANT_SLUG → tenant lookup
3. A Supabase Auth Hook (Custom Access Token Hook) injects JWT
   custom claims (tenant_id, family_id, role) on every token issuance
4. Parent adds a kid → creates row in `kids` table
5. App switches to "kid mode" via in-app toggle (no separate auth)
6. JWT refreshed every hour automatically by Supabase client
```

### Custom JWT claims

After signup, the JWT includes:

```json
{
  "sub": "auth-user-uuid",
  "tenant_id": "tenant-uuid",
  "family_id": "family-uuid",
  "role": "parent",
  "exp": 1234567890
}
```

**Implementation:** Use Supabase's Custom Access Token Hook (a Postgres function registered under Auth → Hooks in the Supabase dashboard). A plain trigger on `auth.users` cannot inject claims into the JWT — it can only modify table data. The Custom Access Token Hook receives the default claims and returns the augmented set. The hook function looks up `family_id` and `tenant_id` from the `families` table by `auth.uid()` and merges them into the claims payload.

### Session storage

- Use `expo-secure-store` (NOT AsyncStorage) for any secret-grade data
- Supabase session auto-refresh enabled
- On app launch: check session, restore if valid, redirect to login if not

### Kid mode (no separate auth)

In v0.x, kids do NOT have their own login. The parent's account hosts kid profiles. The app UI switches to "kid mode" via an in-app profile selector. All data ownership stays with the parent for COPPA compliance.

---

## 5. Payments Architecture (Stripe Connect)

### Account model

- **Platform account:** Ballpark (us). Receives application fees from every transaction.
- **Connected accounts:** Each franchise location has a Stripe Connect Express account.
- **Customers:** Each family is a Stripe Customer object on the location's connected account.

### Why Stripe Connect Express

- Fastest to onboard (Stripe handles KYC)
- We control the customer experience
- Application fees automate franchise royalty collection at the transaction level

### Transaction flow (recurring membership example)

```
1. Parent enters card details in app
2. Card tokenized via Stripe.js, sent to backend
3. Backend creates PaymentIntent on the LOCATION's connected account:
   - amount: $280.00
   - application_fee_amount: $16.80 (6% royalty)
   - on_behalf_of: location_stripe_account_id
4. Money flows: parent → location's connected account
5. Royalty automatically split: $263.20 to location, $16.80 to platform
6. Platform routes royalty to franchisor's account (configurable)
```

### Royalty collection models

**Per-transaction (default):** As above. Instant split.

**Monthly aggregate (alternative):** Some franchise agreements don't support per-transaction royalties. In this case:
- Location keeps 100% of transaction
- Backend calculates monthly royalty from prior-month gross
- Auto-debits the location's account on configured day
- Generates statement for franchisor visibility

Configurable per tenant in `tenants.royalty_config` JSONB column.

### Stripe webhooks

Critical webhooks to handle:

- `payment_intent.succeeded` → mark booking/order as paid
- `payment_intent.payment_failed` → mark for AI layer retry (when AI layer ships)
- `charge.refunded` → update order status
- `account.updated` → update connected account onboarding status
- `customer.subscription.created/updated/deleted` → recurring membership state

Handled via Supabase Edge Function endpoint `/api/stripe-webhook` with Stripe signature verification.

**Important for Replit dev:** Webhooks need a public URL. In dev, configure Stripe to point to your Supabase Edge Function URL (which is always public), NOT to your Replit URL. Edge Functions handle webhooks for both dev and prod.

---

## 6. Video Architecture (Mux)

### Why Mux

- Direct uploads from mobile via Mux upload SDK (chunked, resumable)
- HLS playback URLs ready instantly after upload
- Per-second pricing (no minimum durations)
- Analytics and engagement metrics built-in
- Supports auto-thumbnail generation

### Upload flow

```
1. App requests upload URL: POST /functions/get-mux-upload-url
   Edge function creates Mux Direct Upload, returns upload URL + asset ID
2. App uploads video file directly to Mux (chunked)
3. Mux processes asynchronously
4. App stores `asset_id` in DB record (assignments, messages, swings)
5. Mux webhook fires `video.asset.ready`:
   - Updates DB record with `playback_id` and `duration_seconds`
   - Notifies coach if it's a homework submission (via Supabase realtime)
```

### Playback

```typescript
// In React Native, use react-native-video with HLS URL
const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;

<Video
  source={{ uri: hlsUrl }}
  style={styles.video}
  controls
  resizeMode="contain"
/>
```

### Storage redundancy

Mux is the source of truth for video. We do NOT store video files in Supabase Storage. Supabase Storage is only for:
- User avatars
- Brand assets (tenant logos)
- Static images

---

## 7. Messaging Architecture

### Real-time messages

Uses Supabase Realtime on the `messages` table. The mobile app subscribes to:

```typescript
const channel = supabase
  .channel(`thread:${threadId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `thread_id=eq.${threadId}`,
  }, handleNewMessage)
  .subscribe();
```

Cleanup on unmount: `supabase.removeChannel(channel)`.

### Send flow (text)

```
1. Optimistically render message in UI
2. Insert into `messages` table via Supabase client
3. Trigger updates `message_threads.last_message_at`
4. Realtime fires for coach's app/portal
5. If insert fails, mark message as "failed" in UI, allow retry
```

### Send flow (video)

```
1. User taps camera → records or picks video
2. App requests Mux upload URL (Edge Function)
3. App uploads to Mux (show progress UI)
4. On Mux upload complete → insert message with asset_id, status='processing'
5. UI shows message with "Processing..." overlay
6. Mux webhook → update message with playback_id, status='ready'
7. Realtime fires → recipient's UI updates
```

### Read receipts

Deferred to v1.0. For v0.x, just track `unread_count` on the thread for badge display.

---

## 8. State Management

### Layers

- **Server state:** TanStack Query (React Query) — handles caching, refetching, optimistic updates for ALL Supabase data
- **Client state:** Zustand — for UI state that doesn't belong on the server (modals, current view, form drafts)
- **Form state:** React Hook Form + Zod — for ALL form inputs

### Patterns

**Don't use Redux.** Don't use Context for global state. Don't use prop drilling for shared state.

**Server state goes in TanStack Query:**

```typescript
// /src/api/bookings.ts
export const useUpcomingBookings = (kidId: string) => {
  return useQuery({
    queryKey: ['bookings', 'upcoming', kidId],
    queryFn: () => api.bookings.getUpcoming(kidId),
    staleTime: 30 * 1000,
  });
};
```

**Client state goes in Zustand:**

```typescript
// /src/store/uiStore.ts
import { create } from 'zustand';

interface UIState {
  isFilterModalOpen: boolean;
  setFilterModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isFilterModalOpen: false,
  setFilterModalOpen: (open) => set({ isFilterModalOpen: open }),
}));
```

---

## 9. File Structure (Detailed)

```
/src
├── /screens                      # one folder per screen
│   ├── /Home
│   │   ├── HomeScreen.tsx
│   │   ├── styles.ts
│   │   ├── types.ts
│   │   └── components/           # screen-specific components
│   │       ├── PointsCard.tsx
│   │       ├── StatTiles.tsx
│   │       └── ...
│   ├── /Work
│   ├── /Book
│   ├── /Earn
│   ├── /Me
│   ├── /Auth
│   │   ├── SignUpScreen.tsx
│   │   ├── SignInScreen.tsx
│   │   └── AddKidScreen.tsx
│   └── /Detail                   # detail/modal screens
│       ├── SwingDetailScreen.tsx
│       ├── SessionDetailScreen.tsx
│       └── ...
│
├── /components                   # globally reusable
│   ├── /ui                       # primitive UI (Button, Card, Input, Chip)
│   ├── /layout                   # layout components (PhoneFrame, Header)
│   └── /feature                  # cross-cutting features (PointsBadge, SwingThumbnail)
│
├── /navigation
│   ├── RootNavigator.tsx
│   ├── AuthNavigator.tsx
│   ├── MainTabNavigator.tsx
│   └── types.ts                  # navigation types
│
├── /api                          # API client functions
│   ├── client.ts                 # supabase client
│   ├── auth.ts
│   ├── bookings.ts
│   ├── home.ts
│   ├── messages.ts
│   ├── products.ts
│   ├── swings.ts
│   └── types.ts                  # API response/request types
│
├── /hooks
│   ├── useAuth.ts
│   ├── useFamily.ts
│   ├── useKid.ts
│   └── useTheme.ts
│
├── /store                        # Zustand stores
│   ├── uiStore.ts
│   └── ...
│
├── /theme
│   ├── tokens.ts                 # ALL design tokens (colors, spacing, radius, fonts)
│   ├── fonts.ts                  # font loading
│   └── index.ts
│
├── /utils
│   ├── date.ts
│   ├── format.ts
│   └── validation.ts
│
├── /types                        # shared types
│   ├── database.ts               # Supabase generated types
│   └── domain.ts                 # business domain types
│
└── /lib                          # third-party integrations
    ├── supabase.ts
    ├── stripe.ts
    └── mux.ts
```

---

## 10. Environment Variables (Replit Secrets)

```bash
# Set these in Replit: Tools → Secrets

# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Tenant context
EXPO_PUBLIC_TENANT_SLUG=infinitehitting

# Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Server-side secrets (used by Edge Functions on Supabase, NOT by mobile app)
# These also live in Supabase dashboard → Edge Functions → Secrets
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RESEND_API_KEY=
ANTHROPIC_API_KEY=
```

**Rules:**
- `EXPO_PUBLIC_*` vars are bundled into the mobile app — never put true secrets here
- All other vars live ONLY in Supabase Edge Functions environment for server-side use
- Replit Secrets makes these available to all developers in the workspace
- `.env.example` shows what's needed; `.env` is .gitignored

---

## 11. RLS Policy Patterns

Every table needs RLS. Here are the standard policies:

### Tenant-scoped tables

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Tenant isolation (read)
CREATE POLICY "users_see_own_tenant_bookings" ON bookings
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Family members can only see their own kids' data
CREATE POLICY "family_sees_own_bookings" ON bookings
  FOR SELECT
  USING (
    kid_id IN (
      SELECT k.id FROM kids k
      JOIN families f ON k.family_id = f.id
      WHERE f.parent_user_id = auth.uid()
    )
  );

-- Coaches can see bookings at their location
CREATE POLICY "coach_sees_location_bookings" ON bookings
  FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM coaches WHERE user_id = auth.uid()
    )
  );

-- Family can create bookings for their own kids
CREATE POLICY "family_can_create_bookings" ON bookings
  FOR INSERT
  WITH CHECK (
    kid_id IN (
      SELECT k.id FROM kids k
      JOIN families f ON k.family_id = f.id
      WHERE f.parent_user_id = auth.uid()
    )
  );
```

---

## 12. Edge Functions Architecture

Edge functions handle:
- Stripe webhook verification
- Mux upload URL generation (signed)
- Sensitive operations requiring service role
- Multi-step transactional logic
- Future: AI layer SMS handling

Pattern:

```typescript
// /supabase/functions/get-mux-upload-url/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';

serve(async (req) => {
  // 1. Verify JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  // 2. Parse and validate request
  const { kidId, purpose } = await req.json();

  // 3. Call Mux API
  const muxResponse = await createMuxUpload({ ... });

  // 4. Return upload URL
  return new Response(JSON.stringify(muxResponse), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Edge functions are deployed to Supabase (not Replit) using:
```bash
npx supabase functions deploy get-mux-upload-url
```

---

## 13. Error Handling

### App-level

- All API errors caught at TanStack Query level
- User-facing errors translated via error message dictionary (`/src/utils/errors.ts`)
- Crash reporting via Sentry (deferred to v0.5+)

### Server-level

- Edge functions return structured error objects: `{ error: { code, message, details } }`
- Stripe errors translated to user-friendly messages
- Database errors NEVER exposed to client (sanitized)

### Network resilience

- Retry failed requests automatically (TanStack Query retries 3x by default)
- Offline mode: deferred to v1.0
- Loading skeletons for all data-fetching screens

---

## 14. Testing Strategy

**v0.1-v0.3:** Manual testing only. Run on Expo Go, click through flows.

**v0.4:** Unit tests for critical utilities (date, format, validation). Jest setup.

**v0.5:** Integration tests for booking + payment flow. E2E with Detox deferred.

**v1.0:** Full test pyramid: unit (60%), integration (30%), E2E (10%).

---

## 15. Build & Deploy

### Local development (in Replit)

```bash
# Run Expo dev server with tunnel mode (works for phones outside Replit network)
npm run dev

# Scan QR with Expo Go on your phone
# OR open Expo Go and enter the tunnel URL manually
```

### Staging / TestFlight (when ready)

EAS Build is a cloud build service. You initiate from Replit's terminal:

```bash
# First time only: configure EAS
npx eas build:configure

# Internal testing build
npx eas build --platform all --profile preview

# Submit to TestFlight (iOS) and Internal Testing track (Android)
npx eas submit --platform all
```

EAS handles the actual native compilation in the cloud — Replit doesn't have iOS/Android build tools.

### Production (deferred until v1.0+)

```bash
npx eas build --platform all --profile production
npx eas submit --platform all
```

---

## 16. Open Architectural Questions

These will need decisions before specific milestones:

- **v0.4:** Push notifications — Expo Notifications (free) vs OneSignal (managed)? **Decision deferred to v1.0.**
- **v0.5:** When the AI layer launches, where does the SMS handling logic live? **Decision: Edge Functions on Supabase, NOT a separate service.**
- **v1.0:** Multi-tenant strategy — single shared DB with tenant_id (current) or DB-per-tenant? **Decision: Stay with shared DB until 50+ tenants, then evaluate.**
