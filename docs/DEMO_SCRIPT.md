# Ballpark Demo Script

## THEME: "The Operating System for Youth Sports"

**Core narrative:** MindBody runs a gym. Ballpark runs a franchise. The difference is the kid.

Every demo revolves around one athlete — **Marcus Rivera, 14U, #847 points, ranked #3 in his age group at Infinite Hitting**. Every feature is revealed through Marcus's day, not through a feature list.

**Demo runtime:** ~25 minutes for investors / ~40 minutes with a live app walkthrough for franchise partners.

---

## PART 1 — THE PROBLEM (3 minutes)

**[DELIVER WITHOUT SLIDES — conversational, sharp]**

> "Youth sports facilities are running on tools that were designed for yoga studios. MindBody. Square. Excel spreadsheets. Maybe a Facebook group for messages.
>
> Here's what that looks like in practice. A parent calls to book a lesson. A coach texts a kid drill feedback. A 12-year-old hits 88 miles per hour off the tee and nobody records it. The kid goes home and plays on his phone — TikTok, YouTube, whatever — and the facility has zero presence in his life between sessions.
>
> The moment a kid walks out the door, the relationship is gone.
>
> Now multiply that across a franchise. 5 locations. 15 coaches. 400 families. Each location running their own version of chaos, none of it talking to each other. The owner of the franchise has no idea which location is actually performing, which coaches are retaining families, which kids are about to churn.
>
> That's the problem. It's not a booking problem. It's an engagement problem. And it costs these facilities $300 to $500 per lost family per year — in recurring revenue, not one-time transactions.
>
> Ballpark fixes this."

---

## PART 2 — THE PRODUCT: MARCUS'S DAY (12 minutes)

**[LIVE APP WALKTHROUGH — use the seeded Marcus Rivera demo scenario]**

**Setup before demo:** Run `node scripts/seed-demo-scenario.mjs` to load Marcus's full data. Have an iPhone with Expo Go open, logged in as Marcus's parent account.

---

### 2A — HOME TAB (2 min)

> "This is what Marcus sees when he opens the app. Not a booking calendar. Not a payment portal. *His* dashboard."

**Point out:**
- **His name, his points (847), his rank (#3 in 14U)** — gold hero card at the top. His identity is front and center.
- **Stats row:** 7-day streak, rank delta (up 2 this week), exit velocity (88.4 mph from today's HitTrax session).
- **"New from Coach"** — Coach Mike sent him a swing analysis video yesterday. Unread badge. Tap it → full-screen video player opens inline.
- **"Up Next"** — Private lesson this Friday, 4:30 PM, Cage 3, Coach Mike.
- **"Pending Assignment"** — "Hip rotation drill, due Thursday. +25 points."
- **Personal Best card** — 88.4 mph. Set today. The app knows.

> "A kid who sees his name, his rank, and a message from his coach — that kid opens this app every day. That's not a hypothesis. That's what we're building toward. Compare that to a MindBody login screen."

---

### 2B — WORK TAB: SWINGS (2 min)

> "Marcus hit 47 swings today. The app knows all of it."

**Point out:**
- **Swings sub-tab** — session from today appears at the top. 47 swings, 88.4 avg exit velo, 3 favorites.
- Tap a swing → detail screen: exit velo, launch angle, distance, result (Home Run / Line Drive). Heart icon to favorite it.
- **HitTrax pipeline** — this data came in automatically. No coach data entry. No manual upload. A Supabase Edge Function polls HitTrax every 2 minutes and upserts the session.

> "This is the HitTrax integration. Every facility that has a HitTrax machine gets automatic data. The coach doesn't touch it. The parent doesn't upload anything. It just appears."

---

### 2C — WORK TAB: MESSAGES (2 min)

> "Coach Mike sent Marcus a swing breakdown."

**Point out:**
- **Messages sub-tab** — thread with Coach Mike at the top.
- Coach's video message: tap → full-screen HLS playback via Mux. Plays beautifully. Marks as viewed automatically.
- Marcus's parent replies with a text: "He's been working on that. We'll drill it tonight."
- Then show a parent-to-coach **video reply** — tap the camera icon, record a 10-second clip of Marcus swinging in the backyard, send. Mux uploads it, processes it, delivers it to Coach Mike's portal in real time.

> "Two-way video. On a phone. Coach sends a breakdown, family sends a response. This is a relationship tool, not just a messaging tool."

---

### 2D — WORK TAB: ASSIGNMENTS / DRILLS (1 min)

> "Coach Mike assigned Marcus homework."

**Point out:**
- **Drills sub-tab** — "Hip rotation progression. Due Thursday. 15 min. +25 points."
- Tap → assignment detail: description, embedded drill video from Coach Mike, "Mark as done" button.
- After submission: coach gets a notification, reviews it, gives 1-5 stars + text feedback. Marcus earns 25 points.

> "The drill loop closes the coaching relationship between sessions. It's retention infrastructure."

---

### 2E — BOOK TAB (1 min)

> "Mom wants to book a cage for Saturday."

**Point out:**
- Filter pills: All / Private Lessons / Group Classes / Cage Rental.
- Select Cage Rental → available slots appear for Saturday.
- Tap 10 AM → confirm screen: Cage 2, 60 min, included with Unlimited Monthly.
- Confirm → booking created, confirmation email sent via Resend.

> "The whole booking flow is under 20 seconds. That's why 50% of bookings will happen via the app instead of by phone."

---

### 2F — EARN TAB (2 min)

> "This is where kids actually live in the app."

**Point out:**
- **Rewards sub-tab** — "Private Lesson (750 pts) — 97 pts to go." Progress bar. Visual urgency.
- **Store sub-tab** — IH branded hoodie: 1,200 points OR $49. Real Stripe checkout if they pay cash. Points redemption if they have enough.
- **Ranks sub-tab** — Podium: Marcus at #3. His age group. Live. Tap his row: +2 this week. He's climbing.
- **Earn sub-tab** — how points are earned: +10 session attended, +25 drill completed, +15 PR hit, +50 achievement unlocked.

**Redeem a reward:**
- Select "Free Cage Rental (200 pts)" → confirm → 8-digit redemption code + QR code appears.
- Front desk scans it. Done.

> "The gamification loop is complete. Kid earns points by showing up and working hard. Points buy things they actually want. The leaderboard is public. This is why kids don't churn — they're competing."

---

### 2G — ME TAB (30 sec)

- **Profile screen:** PRs grid (best exit velo, best distance, best launch angle), achievements catalog (badges for first lesson, first PR, 7-day streak, etc.).
- **Settings:** update contact info, sign out.
- **Order history:** past redemptions and purchases, all in one place.

---

## PART 3 — THE BACKEND (5 minutes)

**[SWITCH TO VERBAL — no need to show screens unless technical audience]**

> "What you just saw is the surface. Here's what's underneath."

**Infrastructure — describe verbally or show `docs/ARCHITECTURE.md` stack diagram:**

```
Mobile App (React Native / Expo)
        ↓
Supabase (Postgres + Auth + Realtime + Edge Functions)
        ↓
HitTrax   |   Mux (video)   |   Stripe Connect   |   Resend (email)
```

**The 5 key backend points:**

**1. Supabase — the data layer.**
Postgres database with row-level security on every table. Every family sees only their data. Every coach sees only their location's data. Every franchise sees only their tenant's data. It's enforced at the database level — not in application code. You cannot query across tenants. Period.

**2. Multi-tenancy — the business model backbone.**
Every record in the system has a `tenant_id`. Infinite Hitting is Tenant #1. The next franchise that signs up becomes Tenant #2. They share zero data. They get a branded build with their own colors, their own coaches, their own store. We flip them on in days, not months.

**3. HitTrax pipeline — the data moat.**
Five Edge Functions handle the full HitTrax integration: association, polling (every 2 minutes via pg_cron), session import, personal best tracking. No competitor has automated this. The data is in the athlete's pocket 2 minutes after they leave the cage.

**4. Mux — video infrastructure.**
Coach uploads a video on the portal. Mux processes it to HLS in under 60 seconds. Parent gets an email (Resend) and an in-app notification. They tap play on their phone. The video streams at full quality. We didn't build a CDN. We didn't build a transcoder. Mux handles it. We just glue the pieces.

**5. Stripe Connect — franchise-ready payments.**
Each location has their own Stripe Connect account. When a family buys a hoodie, the money goes to the location, not to us. We take a platform fee. This is how franchise royalties work in software. It's the same model that powers Shopify and Mindbody — we just built it for youth sports.

---

## PART 4 — KEY DIFFERENTIATORS (3 minutes)

> "Why can't a facility just use MindBody?"

**1. Kid-first, not admin-first.**
MindBody is built for the owner and the front desk. Ballpark is built for the athlete. A 12-year-old can open this app and have a reason to stay for 10 minutes. MindBody's mobile experience is a login screen and a class schedule. We're competing for the kid's attention against TikTok. We designed for that.

**2. Automated performance data.**
No other booking/management platform integrates with HitTrax or similar sensor data. When a kid's exit velocity data appears in their app automatically, that's magic. It creates a feedback loop that no coach can replicate manually. The data is the hook.

**3. Multi-tenant franchise infrastructure.**
MindBody runs one location at a time. Ballpark is a franchise OS. A franchisor logs in and sees all 12 locations — bookings, retention metrics, coach performance — in one view. An owner of 3 locations gets consolidated revenue and engagement data. This is the product that franchise HQs will pay for.

**4. The points economy changes behavior.**
We have a hypothesis: if every session, every drill, every PR translates to points — and points have real-world value — kids will nag their parents to book more sessions. We'll prove this in the June pilot. If the average weekly session count per kid goes up 15% after launch, we have an upsell engine, not just a software product.

---

## PART 5 — THE JUNE PILOT PLAN (5 minutes)

**[DELIVERY: forward-looking, specific, honest about what's a test]**

> "Here's how we're going to stress-test everything we just showed you."

**Location:** One Infinite Hitting facility — [target: highest-volume location, TBD with the IH team]. Target: 40-60 active families, 4-6 coaches.

**Timeline:**
- **Week 1 (early June): Soft launch.** 10 families, 2 coaches. Invite-only via email. We sit with the front desk staff and walk them through coach provisioning, booking setup, and the QR scanner on the portal.
- **Week 2-3: Expanded beta.** All coaches onboarded. 30-40 families invited. HitTrax pipeline active. First real redemptions.
- **Week 4: Full location.** Everyone gets access. Push email blast. Coach Mike demo for families at the front desk.

**What we're measuring:**

| Metric | Target | How We Measure |
|---|---|---|
| Weekly app opens per kid | ≥ 3x | Supabase analytics |
| Bookings via app vs. phone | ≥ 40% via app | `bookings.source` field |
| Drill completion rate | ≥ 60% submitted | Assignment status |
| Coach response time | < 24h on messages | `coach_messages` timestamps |
| Points redemptions | ≥ 10 in 4 weeks | `orders` table |
| Net Promoter Score | ≥ 8 (ask at week 4) | Google Form |
| Crash rate | < 2% sessions | Expo error tracking |

**What the location needs to provide:**
- Wi-Fi for Expo Go testing (QR code onboarding)
- Front desk point of contact (1 person for QR scanner + coach provisioning)
- HitTrax credentials (HITTRAX_PARTNER_ID + API key) — or we run mock data if API isn't ready
- 10 volunteer families for week 1 beta

**What we own:**
- Onboarding all 4-6 coaches (takes 10 minutes per coach)
- Family invite emails via Resend
- Live support during week 1 (Slack channel with location manager)
- Weekly data recap emailed to IH leadership

**Known risks and mitigations:**
- *Expo Go requires a QR scan per device.* Mitigation: we run a TestFlight/Play Store beta build before week 3 to eliminate this friction.
- *HitTrax API may not be live.* Mitigation: seed realistic mock data so the in-app experience is still compelling. The pipeline code is ready to flip live the moment keys are available.
- *Coach adoption.* Mitigation: show coaches the portal first — it's their tool. The parent app is secondary. Coaches who see value in sending swing breakdowns are our distribution channel.

---

## PART 6 — WHAT WE BUILD NEXT (3 minutes)

**[Frame as "the platform getting smarter over time"]**

**Near-term (v0.8-v1.0, 60-90 days post-pilot):**
- **AI daily recap (SMS/push):** Every morning, a parent gets a 2-sentence recap — "Marcus is ranked #3 in 14U exit velo. He has a drill due Thursday. Coach Mike left him a note." Automated. Zero coach time.
- **Coach mobile app:** Coaches shouldn't be tied to a laptop. A lightweight coach app for sending messages, reviewing drills, and marking sessions complete from the cage.
- **Multi-kid families:** One parent account, multiple siblings. Each kid gets their own profile, their own points, their own leaderboard position.
- **Cancellation + rescheduling self-service:** Parents reschedule from the app. No phone calls. No front desk overhead.

**Medium-term (v1.0-v1.5, 3-6 months):**
- **Franchisor portal:** The owner of all 12 locations logs in once. Sees which locations have the highest engagement, which coaches have the best retention, which age groups are at risk of churning. This is the tool that gets a franchise HQ to mandate Ballpark across all locations.
- **White-label builds:** Ballpark powers the "XYZ Baseball Academy" app. Different name, different colors, same infrastructure. Each new franchise is a new revenue line with near-zero marginal cost.
- **Leaderboard cross-location:** Kids competing across multiple Infinite Hitting locations. Top 10 in the state. Regional competitions. This is the flywheel — the more locations on the platform, the more compelling the leaderboard.

**Long-term (the platform play):**
- **Stripe billing integration:** Families manage their memberships in the app. Monthly auto-renew. Pause, cancel, upgrade — all self-service. This eliminates the front desk entirely for billing and puts the subscription business on the platform.
- **Data products for franchisors:** Which drills correlate with exit velocity improvement? Which coaching styles retain kids longest? Aggregate, anonymized insights that a franchisor uses to build their coaching curriculum. This is where the data moat compounds.
- **Other sports:** Same infrastructure, different HitTrax data. Soccer (StatSports). Lacrosse. Swimming. The multi-tenant architecture means we onboard a new sport the same way we onboard a new franchise. This is a 5-year play.

---

## PART 7 — THE ASK / CLOSE (2 minutes)

**[Adapt based on audience]**

**For investors:**
> "We are building the operating system for youth sports franchises. The anchor customer is live. The pilot is in June. The technology is deployed. We're raising [X] to [hire first full-time engineer / scale to 5 franchise locations / fund EAS production builds and full HitTrax partnership]. The data moat deepens every session. The more kids on the platform, the more compelling the leaderboard, the more engaged the kids, the less churn, the more locations want in. That's the flywheel."

**For franchise partners (IH leadership):**
> "We want to run the June pilot with your [location name] location. We handle everything — onboarding, tech support, data recaps. You tell us if your coaches like it and if your families open it. If the numbers we showed you hold — 3+ opens per kid per week, 40%+ bookings via app — we expand to your next location in August and price the platform from there."

**For prospective tenant franchises (other sports):**
> "You get the same infrastructure Infinite Hitting has — booking, messaging, gamification, HitTrax (or your equivalent sensor) — under your brand, in your app. We've already built it. You don't pay for the build. You pay a platform fee on transactions and a per-active-family monthly. We go live in 30 days."

---

## APPENDIX: DEMO SETUP CHECKLIST

Before every demo:

```bash
# Load Marcus Rivera hero scenario
node scripts/seed-demo-scenario.mjs

# Verify coach Mike is provisioned
node scripts/provision-coach-mike.mjs

# Confirm portal is running
cd portal && npm run dev

# Confirm app is running on test device
npm run dev   # then scan QR on device
```

**Accounts to have ready:**
- Parent account: logged in as Marcus Rivera's parent (family account)
- Coach account: Coach Mike — logged in on portal at `localhost:3000` (or the Replit preview URL)
- Admin: portal `/admin/redemptions` with QR scanner ready

**Fallback if live demo breaks:**
- Screenshots of each screen in `docs/demo-screenshots/` (capture after each major screen is polished)
- Loom walkthrough video (record before each important demo)
