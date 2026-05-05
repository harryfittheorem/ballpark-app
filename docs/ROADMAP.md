# Roadmap: Ballpark Athlete App (Replit Edition)

> Build in vertical slices. Each version below is a working app that solves a real user problem. **Do not skip versions to start a "more interesting" feature.**

> **Note on time estimates:** These assume you're working in Replit with React Native + Expo. Some friction is real — Expo tunnel mode is slower than local LAN dev, and Replit's container has occasional hiccups. Add 20-30% buffer over local-dev estimates.

---

## v0.1 — Foundation & Auth

**Time estimate:** 4-6 days (Replit) / 3-5 days (local)
**Goal:** Working app skeleton with parent signup, kid profile creation, and bottom nav.

### Build order

1. Initialize Expo project in Replit using their Expo template
2. Configure Replit Secrets with Supabase keys
3. Install all locked dependencies (see CLAUDE.md tech stack)
4. Set up folder structure per ARCHITECTURE.md
5. Configure path aliases (`@/components`, `@/screens`, etc.)
6. Set up theme tokens in `/src/theme/tokens.ts`
7. Load fonts (Oswald, Inter) via `expo-font`
8. Create Supabase project (manually via dashboard)
9. Link Replit project to Supabase: `npx supabase link --project-ref <ref>`
10. Write initial migration: `tenants`, `families`, `kids`, `locations`
11. Add RLS policies on those tables
12. Set up Supabase client in `/src/lib/supabase.ts`
13. Build auth flow:
    - SignUpScreen (email + password + first name + last name + phone)
    - SignInScreen (email + password)
    - AddKidScreen (kid first name, age group, position)
14. Build navigation:
    - RootNavigator (Auth vs Main)
    - MainTabNavigator (5 tabs, empty placeholders)
15. Test on real phone via Expo Go using tunnel mode

### Definition of done

- [ ] App opens on iOS and Android via Expo Go (tunnel mode)
- [ ] Parent can create account → JWT issued → redirected to MainTabNavigator
- [ ] Parent can add a kid profile after signup
- [ ] Bottom nav renders 5 tabs (Home, Work, Book, Earn, Me) with correct icons
- [ ] Each tab is a placeholder screen with a header (no content yet)
- [ ] Auth state persists across app restart
- [ ] Sign out works
- [ ] All tables have RLS policies in place
- [ ] TypeScript compiles with zero errors
- [ ] No hardcoded colors/fonts/spacing — all from `/src/theme/tokens.ts`
- [ ] Code pushed to GitHub (Replit's Git integration)

### Manual smoke test checklist

1. Open app via Expo Go tunnel URL → see SignIn screen
2. Tap "Create account" → SignUp screen
3. Fill out signup → submit → redirected to AddKidScreen
4. Add Jake as kid → tap done → redirected to Home tab (placeholder)
5. Swipe through bottom nav tabs → all render placeholders
6. Force quit app → reopen → still logged in
7. Tap "Sign out" → returned to SignIn

---

## v0.2 — Home Tab ✅ SHIPPED 2026-05-05

**Time estimate:** 5-7 days (Replit) / 4-6 days (local)
**Goal:** A meaningful Home tab that resembles the prototype, with mock data wired through clean API stubs.

**Sign-off:** Full phone smoke pass on Expo Go (cold start, auth flows, all 5 Home cards, tab switching, persistence). `npm run typecheck` + `npm run lint` clean. `node scripts/verify-auth-hook.mjs` PASS.

### Build order

1. Reference `/design/InfiniteHittingApp.jsx` `HomeScreen` component
2. Build reusable components:
    - `<SectionLabel>` (with optional action)
    - `<Card>` (default dark)
    - `<HeroCard>` (gold gradient)
    - `<StatTile>`
    - `<PointsBadge>`
3. Build Home screen sections (in order):
    - Welcome header
    - Points hero card with progress bar to next reward
    - 3-tile stats row (streak, rank, exit velo)
    - "New from Coach" video preview card
    - "Up Next" booking card
    - "Assignments due" list
    - "Latest PR" hero card
4. Wire to mock API in `/src/api/home.ts`:
    - `getHomeData(kidId)` returns hardcoded mock matching the data shapes
5. Use TanStack Query for data fetching
6. Pull-to-refresh refetches mock data

### Definition of done

- [ ] Home tab visually matches `/design/InfiniteHittingApp.jsx` HomeScreen pixel-for-pixel
- [ ] All sections render correctly with mock data
- [ ] Tap on points card → navigates to Earn tab (placeholder ok)
- [ ] Tap on "Up Next" → navigates to Book tab (placeholder ok)
- [ ] Tap on assignment → navigates to placeholder detail screen
- [ ] Tap on "Latest PR" → navigates to placeholder swing detail
- [ ] Pull-to-refresh works
- [ ] All components are reusable (used elsewhere in upcoming tabs)
- [ ] Mock data is in `/src/api/home.ts` with TODO comments for real implementation

---

## v0.3 — Booking System

**Time estimate:** 7-10 days (Replit) / 6-8 days (local)
**Goal:** Real booking flow. Parents can book lessons, see them in upcoming, and persist to DB.

### Build order

1. Write migrations: `coaches`, `coach_availability`, `session_types`, `bookings`
2. Add RLS policies
3. Seed dev data: 4 coaches, availability schedule, 3 session types
4. Build `/src/api/bookings.ts`:
    - `getAvailableSlots(locationId, dateRange)`
    - `createBooking(payload)`
    - `cancelBooking(bookingId, reason)`
    - `getUpcomingBookings(kidId)`
5. Build Book screen:
    - Filter pills (All, Private, Group, Cage)
    - "What can I book?" cards (when "All" selected)
    - "Your Upcoming" section (real data)
    - Day-grouped slots (Today, Tomorrow, Thursday)
    - Tap slot → navigates to BookConfirmScreen
6. Build BookConfirmScreen:
    - Summary of selected slot
    - "Included with Unlimited Monthly" badge (or pricing)
    - Confirm button → creates booking → success state
7. Send confirmation email via Resend Edge Function
8. Wire Home tab "Up Next" to real data

### Definition of done

- [ ] Parent can browse available slots filtered by type
- [ ] Tapping a slot opens confirmation
- [ ] Confirming creates a booking record in DB
- [ ] Booking shows up in "Your Upcoming" immediately
- [ ] Booking shows up on Home tab "Up Next"
- [ ] Confirmation email arrives
- [ ] Cancellation flow works (with reason)
- [ ] Cancelling within X hours warns about cancellation policy (TBD: confirm policy with anchor customer)
- [ ] Coach availability respects existing bookings (no double-booking)
- [ ] Time zone handling correct (use location's TZ)

---

## v0.4 — Messages

**Time estimate:** 9-12 days (Replit) / 7-10 days (local)
**Goal:** Real two-way messaging between coach and family, with text + video.

### Build order

1. Write migrations: `message_threads`, `messages`
2. Add RLS policies
3. Build basic coach portal (web, separate Next.js project) — JUST a message inbox, NOTHING else
    - This is the MINIMUM needed to test two-way flow
    - Can be in same Replit workspace or a separate one
    - Coach can see threads from kids at their location
    - Coach can reply with text or video
4. Build mobile Messages tab (inside Work tab):
    - Thread header (Coach Mike, online status)
    - Message list (text + video bubbles, iMessage-style)
    - Inline camera + text input bar
    - Realtime subscription
5. Set up Mux:
    - Create Mux account
    - Build Edge Function `get-mux-upload-url`
    - Wire mobile camera → Mux upload → message insert
    - Build Mux webhook handler
6. Build video playback:
    - Tap video bubble → full-screen player
    - Use `react-native-video` with HLS
7. Wire Home tab "New from Coach" to real latest video message

### Definition of done

- [ ] Family can send text message → appears in coach's web inbox
- [ ] Coach can reply → appears in family's mobile thread (real-time)
- [ ] Family can record a video, send it → uploads to Mux, processes, appears in thread
- [ ] Coach can play family's video in browser
- [ ] Coach can send video back → family can play it
- [ ] Realtime updates work without app reload
- [ ] Failed sends show error, allow retry
- [ ] Unread count badge on Work tab when new coach message arrives
- [ ] Home tab "New from Coach" shows latest coach video

### Coach portal scope (for this milestone only)

The coach portal in v0.4 is a STUB — bare minimum to test messaging:
- Email/password login
- List of conversation threads
- Open thread → see messages
- Send text or upload video
- That's it. No scheduling, no member management, no fancy UI.

---

## v0.5 — Earn (Rewards + Store + Leaderboard)

**Time estimate:** 10-13 days (Replit) / 8-10 days (local)
**Goal:** Full gamification loop. Real points, real redemption, real Stripe purchase.

### Build order

1. Write migrations: `products`, `orders`, `points_ledger`, `leaderboard_rankings`
2. Add RLS policies
3. Seed product catalog (8 items with dual pricing)
4. Implement points-earning triggers:
    - Database trigger on `bookings.status = 'completed'` → +10 pts
    - Database trigger on `assignments.status = 'reviewed'` → +25 pts
    - Database trigger on `swings.is_pr = true` → +15 pts
    - All emit to `points_ledger`, update `kids.points_balance`
5. Build Earn tab with 4 sub-tabs:
    - Rewards (redemption with progress bars)
    - Store (dual pricing grid)
    - Ranks (podium + top 25)
    - Earn (rules + history)
6. Build StoreItemScreen (dual purchase flow):
    - Toggle between Card and Points
    - Purchase via Stripe Connect
    - Redemption via points (creates order with `payment_method='points'`)
7. Build RewardRedeemScreen:
    - Confirm → generate code → show QR
8. Build leaderboard computation:
    - Edge function runs nightly
    - Computes rankings per age_group per metric
    - Stores in `leaderboard_rankings`
9. Wire Home tab points card to real data

### Definition of done

- [ ] Points earn from real activities (test by completing a booking → +10 pts)
- [ ] Kid sees points balance update in real-time
- [ ] Kid can redeem reward → generates redemption code → shown in Me tab Orders
- [ ] Parent can purchase store item → Stripe charge succeeds → order created
- [ ] Order history shows in Me tab
- [ ] Leaderboard shows real top 25
- [ ] Kid's rank highlighted with "(You)" tag
- [ ] Pull-to-refresh works on all sub-tabs
- [ ] Points history (ledger) shows in Earn → Recent Earnings

---

## After v0.5: Decision Gate

Before continuing past v0.5, evaluate:

- **Pilot launch readiness:** Can we put this in front of 1 location of real users?
- **HitTrax integration status:** What's the actual integration path?
- **Coach portal needs:** Is the messaging stub enough, or does the coach need scheduling/member view?
- **Stripe Connect onboarding:** Have all locations completed Stripe Connect setup?
- **Replit fit:** Is Replit still serving us, or have we outgrown it?

These answers shape v0.6+.

---

## Anti-Goals (don't get distracted)

These will be tempting to build but should NOT be tackled in v0.1-v0.5:

- ❌ AI Layer (SMS intelligence, Q&A, daily recap)
- ❌ Franchisor portal
- ❌ Owner dashboard with deep analytics
- ❌ Coach portal beyond messaging stub
- ❌ Push notifications
- ❌ Sibling/multi-kid support
- ❌ Co-parent support
- ❌ Multi-tenant onboarding flow (we hardcode tenant for now)
- ❌ HitTrax integration (mock data until partnership confirmed)
- ❌ Localization
- ❌ Marketplace / public listing
- ❌ Custom-branded white-label builds (one Expo build for now)

If a Replit Agent or Claude Code session starts wandering toward these, redirect.

---

## Success Metrics

After v0.5 ships and pilot launches:

- 70%+ of kids open the app at least 3x/week
- 50%+ of bookings happen via the app (vs phone/walk-in)
- 80%+ of homework assignments submitted via app
- < 2% session crash rate
- Coach response time < 24 hours on messages
- Average session length > 90 seconds (kids engaging, not just opening)

These are the numbers that determine whether v0.5 is "real" or "broken."

---

## Estimated Total Timeline (Replit)

| Phase | Replit Estimate |
|---|---|
| v0.1 — Foundation & Auth | 4-6 days |
| v0.2 — Home Tab | 5-7 days |
| v0.3 — Booking System | 7-10 days |
| v0.4 — Messages | 9-12 days |
| v0.5 — Earn | 10-13 days |
| **Total** | **35-48 working days (7-10 weeks)** |

For a solo developer working full-time: ~9-10 weeks.
For a team of 2-3 with some parallelization: ~6-8 weeks.
