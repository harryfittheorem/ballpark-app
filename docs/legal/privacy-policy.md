# Privacy Policy — Ballpark

> **DRAFT — REQUIRES LEGAL REVIEW**
>
> This document is a working draft prepared by the engineering team to describe what the Ballpark app actually collects and how it is used today. It has **not** been reviewed by counsel and must not be treated as the published policy. Items flagged for the lawyer are collected in the "Reviewer notes" section at the end.

**Last updated:** _YYYY-MM-DD (placeholder — set on publication)_
**Contact:** privacy@fittheorem.com

---

## 1. Who we are

Ballpark is a mobile app operated by Fit Theorem ("we", "us") and offered to families through participating youth sports performance facility franchises (each, a "facility"). Our pilot facility is Infinite Hitting. Each facility is a separate "tenant" inside Ballpark, and your data is associated with the facility where your family trains.

This policy covers the Ballpark mobile app for parents and kids. A separate notice will cover the coach and franchise admin tools when they ship.

---

## 2. What we collect

We try to collect only what we need to run the service. Here is the actual list, grouped by where the data lives in our system.

### 2.1 Parent account

When a parent signs up, we store the following in our `families` table and in Supabase Auth:

- Email address (used as the login).
- Password (stored hashed by Supabase Auth — we never see the plaintext).
- Parent first and last name.
- Parent phone number (optional today; used for facility contact, not marketing).
- The facility tenant the account belongs to (e.g. Infinite Hitting) and an internal `tenant_id`.
- A Supabase Auth user id and session tokens. Our authentication tokens carry custom claims that include your `tenant_id`, your `family_id`, and your `app_role` (e.g. `parent` or `coach`) so the backend can apply the right permissions.

### 2.2 Kid profile

Parents create kid profiles inside their own account. Kids do not have their own logins. For each kid we store, in the `kids` table:

- First and last name.
- Date of birth and/or age group (e.g. `11U`).
- Primary playing position and jersey number (optional).
- Avatar image (optional).
- Current points balance and current streak — both are gameplay state, not identity.

### 2.3 Bookings and session history

When a parent books a private lesson, group class, or cage rental we store, in the `bookings` and related tables:

- Which kid the booking is for, which coach, which session type, and which facility location.
- Scheduled start and end times, and the cage number when applicable.
- Booking status (`pending`, `confirmed`, `completed`, `cancelled`, `no_show`) and any cancellation reason or notes the user enters.

### 2.4 Coach video messages

When a coach records or uploads a short video for a family (`videos` rows tagged `purpose='coach_message'` plus the `coach_messages` row that links the video to the recipient family and kid) we store:

- The Mux asset id and playback id, plus the duration of the video.
- The optional text that accompanies the video.
- Which family and which kid the message is addressed to.
- Whether and when the parent has viewed it (`viewed_at`).

The video file itself is hosted by Mux (see §4 Third-party processors). We store the identifiers needed to play it back.

### 2.5 Drill assignments

When a coach assigns a drill (v0.6 Work feature) we store, in the `assignments` table and a related Mux video where applicable (`videos` tagged `purpose='drill'`):

- Title, description, duration estimate, due date, point reward.
- Optional drill video (Mux asset/playback id).
- Which kid and family the assignment is for, and which coach authored it.
- Submission status, when the parent marked it done, and the coach's optional 1–5 star rating and written feedback.

### 2.6 Points, redemptions, and orders

When a kid earns or spends points, or a family redeems a reward, we record (in `points_ledger`, `orders`, and `products`):

- Each points change as a ledger entry: amount, reason (e.g. session attended, assignment completed, redemption), the resulting balance, and the source row that triggered it.
- For each redemption: the product, the kid and family it belongs to, the points spent, the order status, and an 8-character alphanumeric redemption code generated on the server. The code is shown in the app and on the Me → Orders screen so the front desk can hand over the item.
- Card-based purchases are not yet enabled in the app today; when they are, we will store the Stripe payment intent id (not the card number).

### 2.7 Push notifications

If you grant permission, we store an Expo push notification token tied to your account and use it only to send service notifications (for example, "your coach sent a new video" or "your drill was reviewed"). We do not use push tokens for marketing.

### 2.8 What we do **not** collect

- We do not collect precise device location.
- We do not collect contacts, calendars, or other apps' data.
- We do not embed third-party advertising or analytics SDKs in the app.
- We do not collect payment card numbers ourselves; when card payments launch they will be handled by Stripe.

---

## 3. How we use what we collect

We use the data above to operate the service:

- Sign you in and keep you signed in across app restarts.
- Show your family's bookings, the coach videos addressed to your kid, your drill assignments, your points balance and history, your redemption codes, and the live facility leaderboard.
- Let coaches you train with send you videos and assign drills, and let them see whether you have completed them.
- Send transactional email through Resend (for example, signup confirmation, "your coach sent you a new video", and similar service messages tied to something you or your coach did).
- Send the push notifications described in §2.7, when you have allowed them.
- Maintain operational records the facility needs to run its business (booking history, redemption fulfillment).

We do **not** use your data for advertising, and we do **not** sell it to third parties.

---

## 4. Third-party processors

We share data with a small set of vendors that act as processors on our behalf. They are bound to use the data only to provide their service to us.

- **Supabase** — hosts our Postgres database, authentication, storage, realtime, and edge functions. Substantially all of the data described in §2 lives in Supabase.
- **Mux** — hosts and streams the coach video messages (§2.4) and drill videos (§2.5). Mux holds the video files; we hold the identifiers.
- **Resend** — sends our transactional email. Resend receives the recipient's email address and the message body for the email it is sending.
- **Stripe (Connect)** — listed as a **future** processor. In-app card payments are not yet enabled. The Store tab today lists items and directs parents to settle at the facility front desk. When Stripe Connect launches in-app, Stripe will process payments under their own terms and we will store only Stripe's payment intent id.

This list will be kept current as our processor footprint changes.

---

## 5. Multi-tenant isolation

Ballpark is a multi-tenant platform: each franchise facility is a separate tenant. Every tenant-scoped row in our database carries a `tenant_id`, and access is enforced inside Postgres using row-level security (RLS) policies that pin reads and writes to the caller's tenant. We periodically run an adversarial cross-tenant audit (see `docs/TENANT_ISOLATION_AUDIT.md` in our repository) that signs in as a parent and a coach in two different tenants and probes every tenant-scoped table to confirm one tenant cannot see, modify, or insert into another tenant's data. The most recent audit (2026-05-08) reported 170 of 170 probes passing with zero leaks.

This means a parent at one facility cannot see another facility's coaches, kids, bookings, videos, drills, products, or points history.

---

## 6. Children's data (under 13) and COPPA

Ballpark is designed for kids ages roughly 8–16 to use alongside their parents. Importantly:

- **Kids do not have their own logins.** Kid profiles live inside the parent's account. The parent creates and manages the profile.
- The kid information we collect is described in §2.2 (name, date of birth or age group, position, jersey number, avatar, points balance, streak), plus the activity records the parent's bookings and the coach's interactions generate (§2.3–§2.6).
- Parents can delete a kid profile, request export of the data we hold about their kid, or delete the entire family account by contacting privacy@fittheorem.com.

We are aware that the U.S. Children's Online Privacy Protection Act ("COPPA") imposes additional requirements when a service knowingly collects personal information from children under 13. Today the parent is the contracting user and the parent creates the kid profile, but before we scale beyond the pilot we intend to publish a separate Children's Privacy Notice and implement a verifiable parental consent flow. **This is flagged for legal review (see Reviewer notes §11).**

---

## 7. Data retention

These are proposed defaults. Counsel may adjust the specific windows.

- **Parent account and kid profile** — retained while the account is active. On deletion (see §8) we either delete or anonymize the parent and kid records.
- **Bookings and session history** — retained for the facility's record-keeping. The facility is the operator of record for the booking; deletion of an account does not automatically delete historical bookings the facility relied on for its own books.
- **Coach video messages and drill videos** — retained for the life of the account so families can re-watch coaching content. A parent may request deletion of a specific video.
- **Points ledger, orders, and redemption codes** — retained for fraud, audit, and reconciliation purposes even after an account is deleted. Codes will be unlinked from the deleted account and kept as historical totals.
- **Authentication logs** — retained per Supabase's defaults.

---

## 8. Your rights

You can:

- **Request deletion** of your account and your kid profile(s) by emailing privacy@fittheorem.com.
- **Request a copy** of the data we hold about your family by emailing the same address.
- **Correct** parent contact info from inside the app (Me tab, when that capability ships) or by emailing us in the meantime.
- **Withdraw push-notification permission** in your phone's system settings at any time.

We will respond within a reasonable period and will confirm the action in writing.

---

## 9. Security

Data is stored in Supabase (Postgres, Auth, Storage) with row-level security policies enforcing tenant and family boundaries. Passwords are hashed by Supabase Auth. Authentication tokens are short-lived and refreshed automatically. Server-side keys (the Supabase service role key, Mux tokens, Resend key, the Mux webhook signing secret) are held only on the server side and never shipped in the mobile app. The mobile app uses an anon (publishable) key and the user's signed JWT.

No system is perfectly secure. If we ever detect a security incident affecting your data, we will notify affected accounts.

---

## 10. Changes to this policy

We will post material changes to this policy in the app and, where required, notify the parent account by email. Continued use of the app after a change indicates acceptance of the updated policy.

---

## 11. Reviewer notes (for counsel)

Items the engineering team is specifically flagging for legal review before this draft is published:

- **COPPA verifiable parental consent.** §6 acknowledges the obligation but does not yet describe the mechanism. We need counsel's recommended approach (e.g. credit-card verification, signed consent form, knowledge-based authentication) before scaled launch beyond the pilot.
- **Children's Privacy Notice.** §6 commits to publishing one separately. Counsel to draft or approve scope.
- **Retention windows in §7.** Specific durations (e.g. "bookings retained for 7 years") are intentionally left as proposals; please set the binding numbers.
- **Stripe terms incorporation.** §4 and §2.6 reserve future card payments to Stripe; please confirm how Stripe's terms should be incorporated by reference when that launches.
- **Push notification token classification.** §2.7 — confirm whether Expo push tokens trigger any additional disclosure beyond §2.7's description.
- **Data export format and timeline.** §8 commits to fulfilling export requests but does not specify a timeline (e.g. "within 30 days") or format (JSON, CSV). Please set both.
- **International users / cross-border transfer.** This draft assumes U.S. users only. If we will accept users in other jurisdictions (notably EU/UK or California beyond CCPA's basic disclosures), additional sections will be needed.
- **Whether to name Resend, Mux, and Supabase by name** (§4) versus a generic "hosting and email providers" treatment.
