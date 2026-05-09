# PRD: Ballpark Athlete App

> **Scope of this document:** v0.1 through v0.5 of the athlete-facing mobile app only. Operations portal and AI layer have separate PRDs.
> **Status:** Active development spec. Last updated for build kickoff.

---

## 1. What We're Building

A mobile app for kids (ages 8-16) and their parents who train at Infinite Hitting baseball facilities. Replaces the role MindBody currently plays for these families.

**The hypothesis:** Kids will open this app daily if it has their swing videos, their points, their progress, and their coach's feedback. Parents will use it to book lessons, see progress, and pay bills.

**The platform play:** This isn't a single-tenant app. The codebase supports multiple tenants (franchises). Infinite Hitting is the first tenant. Other youth sports franchises become tenants later. Every architectural decision must respect tenant isolation.

---

## 2. Personas (with priority weights)

| Persona | Priority for v0.1-0.5 | Description |
|---|---|---|
| **Jake (the athlete, 11)** | 70% | Opens app daily for points, videos, leaderboard. Drives engagement. |
| **Sarah (the parent)** | 25% | Books lessons, pays bills, sees Jake's progress. Drives retention. |
| **Coach Mike** | 5% | Limited mobile interaction in v0.5. Primary tool is the operations portal (separate). |

The kid-first ratio matters. When making product trade-offs, optimize for kid engagement first, parent convenience second, coach efficiency last.

---

## 3. v0.1 - v0.5 Scope (in build order)

### v0.1 — Foundation
**Goal:** App opens, person can sign up and sign in. Database is ready.

**Features:**
- Expo + React Native + TypeScript scaffolded
- Supabase project configured with auth
- Family account creation (parent signup)
- Add-a-kid flow (parent adds Jake's profile)
- Sign-in flow (parent + kid mode toggle)
- Empty 5-tab bottom nav shell (Home, Work, Book, Earn, Me)
- Theme system from design tokens

**Definition of done:**
- Parent can create account on real phone via Expo Go
- Parent can add a kid profile
- Bottom nav renders with 5 tabs (no content yet)
- Database has correct schema deployed
- Auth persists across app restart

### v0.2 — Home tab
**Goal:** The kid sees something meaningful when they open the app.

**Features:**
- Welcome header with kid's name
- Points card (with mock data initially)
- 3-tile stats row: streak, rank, exit velo (mock)
- "New from Coach" video preview card (mock)
- "Up Next" booking card (mock)
- "Assignments due" list (mock)
- "Latest PR" hero card (mock)
- All cards link to detail screens (which can be empty placeholders for now)

**Definition of done:**
- Home tab matches design prototype pixel-for-pixel
- All sections render with mock data
- Tap interactions feel native (haptic feedback, smooth transitions)

### v0.3 — Booking system
**Goal:** Parents can book real lessons.

**Features:**
- Book tab calendar view
- Filter pills: All, Private Lessons, Group Classes, Cage Rental
- Day-grouped time slots
- Tap slot → confirmation screen
- "Booked!" success state
- Real coach availability data (Supabase backed)
- Real session creation in DB
- "Your Upcoming" section pulls real bookings

**Definition of done:**
- Parent can book a lesson, see it in upcoming, and have it persist
- Coach availability respects time conflicts
- Booking emails parent confirmation (via Resend)

### v0.4 — Messages + Coach interaction
**Goal:** Real two-way coach communication.

**Features:**
- Messages sub-tab inside Work tab
- Unified text + video thread
- Send text message from kid/parent
- Send video from kid/parent (via inline camera in thread)
- Receive coach messages (coach sends from operations portal — built in parallel)
- Video upload via Mux
- Real-time message updates (Supabase realtime)

**Definition of done:**
- Parent or kid can send text + video to coach
- Coach can respond from coach portal (must build basic coach send-message UI for this)
- Messages persist and sync across devices
- Videos upload reliably even on slow connections

### v0.5 — Earn (rewards + store + leaderboard)
**Goal:** Gamification loop is functional.

**Features:**
- Points balance card
- Rewards tab: redemption with progress bars
- Store tab: dual pricing (points + dollars), real Stripe checkout for $$$
- Ranks tab: leaderboard with podium
- Earn tab: how-to-earn rules and recent activity
- Points awarded on real events (session attended, assignment completed, PR hit)
- Order history visible in Me tab

**Definition of done:**
- Kid can earn points from real activity
- Kid/parent can redeem reward (generates code at front desk pickup)
- Parent can purchase store item via Stripe
- Order history shows both redemptions and purchases

---

## 4. Out of Scope (until v1.0+)

These are real features but not in v0.1-v0.5:

- **HitTrax integration** — pending partnership conversation. Mock data until we have API access.
- **AI layer (SMS intelligence)** — separate project, post-launch.
- **Coach mobile app** — coaches use web portal for now.
- **Owner/franchisor portal** — separate codebase, parallel build.
- **Push notifications** — deferred to v1.0 to avoid Expo notifications complexity.
- **Apple/Google Sign-In** — email/password only for v0.x, social login post-launch.
- **Sibling support** — one kid per family for v0.5, expand to N siblings in v0.6.
- **Co-parent / divorced household support** — single parent record per family for v0.x.
- **Localization** — English only.
- **Accessibility audits** — basic WCAG support, full audit deferred.

---

## 5. Data Model (Authoritative)

This is the database schema. Every table is `tenant_id`-scoped where relevant.

### Core entities

```sql
-- Tenants (franchises). Infinite Hitting is tenant_id #1.
tenants:
  id (uuid, pk)
  name (text)               -- "Infinite Hitting"
  slug (text, unique)        -- "infinitehitting"
  brand_colors (jsonb)
  brand_logo_url (text)
  stripe_account_id (text)   -- Stripe Connect ID
  created_at, updated_at

-- Locations within a tenant.
locations:
  id (uuid, pk)
  tenant_id (uuid, fk)
  name (text)               -- "Dallas N."
  address (text)
  city, state, zip
  phone, email
  timezone (text)
  stripe_account_id (text)   -- per-location Stripe Connect (optional)
  created_at, updated_at

-- Family accounts. One per household.
families:
  id (uuid, pk)
  tenant_id (uuid, fk)
  primary_location_id (uuid, fk)
  parent_user_id (uuid, fk to auth.users)
  parent_first_name, parent_last_name
  parent_phone (text)
  parent_email (text)
  stripe_customer_id (text)
  created_at, updated_at

-- Kid profiles. Multiple per family.
kids:
  id (uuid, pk)
  family_id (uuid, fk)
  first_name, last_name
  date_of_birth (date)
  age_group (text)           -- "9U", "10U", "11U", "12U", "13U", "14U", "15U+"
  primary_position (text)    -- "SS", "OF", "P", etc.
  jersey_number (int)
  avatar_url (text)
  points_balance (int, default 0)
  current_streak_days (int, default 0)
  created_at, updated_at

-- Coaches.
coaches:
  id (uuid, pk)
  tenant_id (uuid, fk)
  primary_location_id (uuid, fk)
  user_id (uuid, fk to auth.users)
  first_name, last_name
  specialty (text)
  bio (text)
  avatar_url (text)
  is_active (boolean, default true)
  created_at, updated_at
```

### Bookings & sessions

```sql
-- Coach availability. Generated weekly schedule.
coach_availability:
  id (uuid, pk)
  coach_id (uuid, fk)
  location_id (uuid, fk)
  day_of_week (int)          -- 0-6
  start_time (time)
  end_time (time)
  is_recurring (boolean)
  effective_from, effective_until (date)
  created_at

-- Bookable session types.
session_types:
  id (uuid, pk)
  tenant_id (uuid, fk)
  name (text)                -- "Private Lesson", "Group Class", "Cage Rental"
  duration_minutes (int)
  type_category (text)       -- "private", "group", "cage"
  base_price_cents (int)
  description (text)
  created_at

-- Actual booked sessions.
bookings:
  id (uuid, pk)
  tenant_id (uuid, fk)
  location_id (uuid, fk)
  kid_id (uuid, fk)
  coach_id (uuid, fk)
  session_type_id (uuid, fk)
  scheduled_start (timestamp)
  scheduled_end (timestamp)
  cage_number (text)
  status (text)              -- "confirmed", "completed", "cancelled", "no_show"
  attended_at (timestamp)
  cancelled_at (timestamp)
  cancellation_reason (text)
  notes (text)
  created_at, updated_at

-- A completed training session. Created when booking transitions to "completed".
sessions:
  id (uuid, pk)
  booking_id (uuid, fk)
  kid_id (uuid, fk)
  coach_id (uuid, fk)
  location_id (uuid, fk)
  started_at, ended_at (timestamp)
  swing_count (int)
  avg_exit_velo (numeric)
  best_exit_velo (numeric)
  has_pr (boolean)
  coach_notes (text)
  created_at
```

### Swings (HitTrax-sourced eventually)

```sql
-- Individual swings. Initially mock; later from HitTrax.
swings:
  id (uuid, pk)
  session_id (uuid, fk)
  kid_id (uuid, fk)
  swing_number (int)         -- order within session
  exit_velo (numeric)        -- mph
  launch_angle (numeric)     -- degrees
  distance (numeric)         -- feet
  result (text)              -- "Single", "Home Run", etc.
  is_pr (boolean)
  is_favorite (boolean, default false)
  is_contact (boolean)
  video_url (text)           -- Mux playback ID
  hittrax_swing_id (text)    -- external ID from HitTrax (nullable, for matching)
  raw_hittrax_data (jsonb)   -- full payload from HitTrax (for future fields)
  created_at
```

### Messaging

```sql
-- Threads between coach and family.
message_threads:
  id (uuid, pk)
  tenant_id (uuid, fk)
  family_id (uuid, fk)
  coach_id (uuid, fk)
  kid_id (uuid, fk)          -- which kid this thread is about
  last_message_at (timestamp)
  unread_count_family (int, default 0)
  unread_count_coach (int, default 0)
  created_at, updated_at

-- Individual messages.
messages:
  id (uuid, pk)
  thread_id (uuid, fk)
  sender_user_id (uuid, fk to auth.users)
  sender_role (text)         -- "parent", "kid", "coach"
  message_type (text)        -- "text", "video", "image"
  text_content (text)
  video_url (text)           -- Mux playback ID
  video_label (text)         -- "SWING ANALYSIS", "HOME PRACTICE", etc.
  duration_seconds (int)
  read_at (timestamp)
  created_at
```

### Assignments (homework from coach)

```sql
assignments:
  id (uuid, pk)
  tenant_id (uuid, fk)
  kid_id (uuid, fk)
  coach_id (uuid, fk)
  title (text)
  description (text)
  drill_video_url (text)
  duration_estimate_minutes (int)
  point_reward (int, default 25)
  due_date (date)
  status (text)              -- "pending", "submitted", "reviewed"
  submitted_video_url (text)
  submitted_at (timestamp)
  reviewed_at (timestamp)
  coach_rating (int)         -- 1-5 stars
  coach_feedback (text)
  created_at, updated_at
```

### Rewards & Store

```sql
-- Catalog of redeemable items / store products.
products:
  id (uuid, pk)
  tenant_id (uuid, fk)
  name (text)
  description (text)
  category (text)            -- "Apparel", "Equipment", "Sessions"
  image_url (text)
  points_cost (int)
  dollar_price_cents (int)
  is_redeemable (boolean)    -- true = can be unlocked with points
  is_purchasable (boolean)   -- true = can be bought with $$
  inventory_count (int)
  is_active (boolean)
  created_at, updated_at

-- Order/redemption history.
orders:
  id (uuid, pk)
  family_id (uuid, fk)
  kid_id (uuid, fk)
  product_id (uuid, fk)
  payment_method (text)      -- "points", "card"
  amount_paid_points (int)
  amount_paid_cents (int)
  stripe_payment_intent_id (text)
  status (text)              -- "ordered", "fulfilled", "cancelled", "refunded"
  redemption_code (text)     -- for in-store pickup
  fulfilled_at (timestamp)
  created_at, updated_at
```

### Points & gamification

```sql
-- Points ledger. Every grant or spend is logged.
points_ledger:
  id (uuid, pk)
  kid_id (uuid, fk)
  delta (int)                -- positive (earned) or negative (spent)
  reason (text)              -- "session_attended", "assignment_completed", "pr_hit", "redemption"
  reference_id (uuid)        -- links to source (booking_id, assignment_id, order_id)
  created_at

-- Leaderboards (computed view, refreshed nightly).
leaderboard_rankings:
  id (uuid, pk)
  tenant_id (uuid, fk)
  age_group (text)
  metric (text)              -- "exit_velo", "points", "streak"
  kid_id (uuid, fk)
  value (numeric)
  rank (int)
  computed_at (timestamp)
```

---

## 6. API Surface (v0.5 endpoints)

All endpoints are Supabase RPC or direct table queries unless noted. RLS enforces tenant isolation.

### Auth (Supabase Auth, no custom endpoints)
- `signUp(email, password)` → creates auth user + family record
- `signIn(email, password)` → JWT session
- `signOut()`
- `addKid(family_id, kid_data)` → creates kid record

### Home
- `getHomeData(kid_id)` → assembled response with points, streak, next booking, latest PR, new coach video, pending assignments

### Work
- `getSwingsForKid(kid_id, options)` → paginated swings, can filter by session
- `getSessionsForKid(kid_id)` → list of sessions
- `getAssignmentsForKid(kid_id, status?)` → assignments by status
- `submitAssignmentVideo(assignment_id, video_url)` → marks submitted

### Book
- `getAvailableSlots(location_id, date_range)` → coach availability
- `createBooking(payload)` → creates booking + sends confirmation
- `cancelBooking(booking_id, reason)` → cancellation flow

### Messages
- `getThreads(family_id)` → list of message threads
- `getMessages(thread_id, before?)` → paginated messages
- `sendMessage(thread_id, payload)` → text or video message
- (Realtime subscription via Supabase for new messages)

### Earn
- `getProducts(tenant_id, filters?)` → product catalog
- `redeemReward(kid_id, product_id)` → spend points → create order
- `purchaseProduct(family_id, product_id)` → Stripe payment intent → create order
- `getLeaderboard(tenant_id, age_group, metric)` → top 25
- `getPointsHistory(kid_id)` → ledger entries

### Me
- `getFamilyProfile(family_id)` → family + kids data
- `updateKidProfile(kid_id, updates)` → edit kid
- `getBillingProfile(family_id)` → current plan, payment method, next charge
- `getOrderHistory(family_id)` → past orders/redemptions

---

## 7. Decision Log

Decisions made for v0.1-v0.5 that should NOT be re-litigated mid-build:

- **One kid per family in v0.5.** Multi-kid support deferred.
- **Email/password auth only.** No Google/Apple sign-in until post-launch.
- **No push notifications in v0.x.** SMS via Twilio handles real-time alerts.
- **Mock HitTrax data until partnership confirmed.** Schema is ready; data is fake.
- **Stripe Connect Express** (not Standard). Keeps onboarding simpler for franchisees.
- **Mux over Cloudflare Stream.** Better analytics, simpler integration, willing to pay premium for v1.
- **Single Expo build for v0.x.** Per-tenant branded builds (different bundle IDs) deferred to post-pilot.
- **No localization.** English only until expansion.

---

## 8. Open Questions (resolve before specific milestones)

These are flagged here so Claude Code asks before building:

- **v0.3:** Booking cancellation policy — minimum lead time? Refund logic? **PENDING.**
- **v0.4:** Message read receipts? Show or hide? **DEFERRED — hide for now.**
- **v0.5:** Inventory tracking on store products — real-time or manual? **DEFERRED — manual for v0.5.**
- **v1.0:** Push notifications — Expo Notifications or move to a managed service? **DEFERRED.**
