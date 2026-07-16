import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Ballpark",
  description: "Ballpark app privacy policy.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
          Privacy Policy
        </h1>
        <p className="mb-1 text-sm text-gray-500">
          <strong>DRAFT — REQUIRES LEGAL REVIEW</strong>
        </p>
        <p className="mb-8 text-sm text-gray-500">
          Last updated: <em>to be set on publication</em> &middot; Contact:{" "}
          <a
            href="mailto:privacy@fittheorem.com"
            className="text-blue-600 underline"
          >
            privacy@fittheorem.com
          </a>
        </p>

        <Section title="1. Who we are">
          <p>
            Ballpark is a mobile app operated by Fit Theorem (&quot;we&quot;,
            &quot;us&quot;) and offered to families through participating youth
            sports performance facility franchises (each, a &quot;facility&quot;
            ). Our pilot facility is Infinite Hitting. Each facility is a
            separate &quot;tenant&quot; inside Ballpark, and your data is
            associated with the facility where your family trains.
          </p>
          <p className="mt-3">
            This policy covers the Ballpark mobile app for parents and kids. A
            separate notice will cover the coach and franchise admin tools when
            they ship.
          </p>
        </Section>

        <Section title="2. What we collect">
          <p>
            We try to collect only what we need to run the service. Here is the
            actual list, grouped by where the data lives in our system.
          </p>

          <SubSection title="2.1 Parent account">
            <p>When a parent signs up, we store:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Email address (used as the login).</li>
              <li>
                Password (stored hashed by Supabase Auth — we never see the
                plaintext).
              </li>
              <li>Parent first and last name.</li>
              <li>
                Parent phone number (optional; used for facility contact, not
                marketing).
              </li>
              <li>The facility tenant the account belongs to.</li>
              <li>
                A Supabase Auth user id and session tokens carrying your
                tenant_id, family_id, and app_role.
              </li>
            </ul>
          </SubSection>

          <SubSection title="2.2 Kid profile">
            <p>
              Parents create kid profiles inside their own account. Kids do not
              have their own logins. For each kid we store:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>First and last name.</li>
              <li>Date of birth and/or age group (e.g. 11U).</li>
              <li>
                Primary playing position and jersey number (optional).
              </li>
              <li>Avatar image (optional).</li>
              <li>
                Current points balance and current streak — both are gameplay
                state, not identity.
              </li>
            </ul>
          </SubSection>

          <SubSection title="2.3 Bookings and session history">
            <p>
              When a parent books a session we store which kid, coach, session
              type, facility location, scheduled times, and booking status.
            </p>
          </SubSection>

          <SubSection title="2.4 Coach video messages">
            <p>
              When a coach records or uploads a short video for a family we
              store the Mux asset and playback identifiers, optional text, the
              recipient family and kid, and whether and when the parent has
              viewed it. The video file itself is hosted by Mux (see §4).
            </p>
          </SubSection>

          <SubSection title="2.5 Drill assignments">
            <p>
              When a coach assigns a drill we store the title, description,
              duration, due date, point reward, optional drill video identifiers,
              which kid and family the assignment is for, and the coach&apos;s
              optional rating and feedback.
            </p>
          </SubSection>

          <SubSection title="2.6 Points, redemptions, and orders">
            <p>
              We record each points change as a ledger entry. For each
              redemption we store the product, the kid and family, the points
              spent, the order status, and an 8-character alphanumeric
              redemption code generated on the server. Card-based purchases are
              not yet enabled; when they are, we will store only Stripe&apos;s
              payment intent id (not the card number).
            </p>
          </SubSection>

          <SubSection title="2.7 Push notifications">
            <p>
              If you grant permission, we store an Expo push notification token
              tied to your account and use it only to send service notifications
              (e.g. &quot;your coach sent a new video&quot;). We do not use push
              tokens for marketing.
            </p>
          </SubSection>

          <SubSection title="2.8 What we do not collect">
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not collect precise device location.</li>
              <li>
                We do not collect contacts, calendars, or other apps&apos; data.
              </li>
              <li>
                We do not embed third-party advertising or analytics SDKs.
              </li>
              <li>
                We do not collect payment card numbers ourselves.
              </li>
            </ul>
          </SubSection>
        </Section>

        <Section title="3. How we use what we collect">
          <p>We use the data above to operate the service:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Sign you in and keep you signed in across app restarts.</li>
            <li>
              Show your family&apos;s bookings, coach videos, drill assignments,
              points balance, redemption codes, and the live leaderboard.
            </li>
            <li>
              Let coaches you train with send videos and assign drills, and let
              them see whether you have completed them.
            </li>
            <li>
              Send transactional email (signup confirmation, video notifications,
              and similar service messages).
            </li>
            <li>
              Send push notifications when you have allowed them.
            </li>
            <li>
              Maintain operational records the facility needs to run its business.
            </li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> use your data for advertising, and we do{" "}
            <strong>not</strong> sell it to third parties.
          </p>
        </Section>

        <Section title="4. Third-party processors">
          <p>
            We share data with a small set of vendors that act as processors on
            our behalf. They are bound to use the data only to provide their
            service to us.
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>Supabase</strong> — hosts our Postgres database,
              authentication, storage, realtime, and edge functions.
            </li>
            <li>
              <strong>Mux</strong> — hosts and streams coach video messages and
              drill videos.
            </li>
            <li>
              <strong>Resend</strong> — sends our transactional email.
            </li>
            <li>
              <strong>Stripe (Connect)</strong> — future processor for in-app
              card payments (not yet enabled).
            </li>
          </ul>
        </Section>

        <Section title="5. Multi-tenant isolation">
          <p>
            Ballpark is a multi-tenant platform: each franchise facility is a
            separate tenant. Every tenant-scoped row in our database carries a
            tenant_id, and access is enforced inside Postgres using row-level
            security (RLS) policies. A parent at one facility cannot see another
            facility&apos;s coaches, kids, bookings, videos, drills, products,
            or points history.
          </p>
        </Section>

        <Section title="6. Children's data (under 13) and COPPA">
          <p>
            Ballpark is designed for kids ages roughly 8–16 to use alongside
            their parents. Kids do not have their own logins — kid profiles live
            inside the parent&apos;s account. The parent creates and manages the
            profile.
          </p>
          <p className="mt-3">
            Parents can delete a kid profile, request export of the data we hold
            about their kid, or delete the entire family account by contacting{" "}
            <a
              href="mailto:privacy@fittheorem.com"
              className="text-blue-600 underline"
            >
              privacy@fittheorem.com
            </a>
            .
          </p>
          <p className="mt-3">
            We are aware that COPPA imposes additional requirements when a
            service knowingly collects personal information from children under
            13. We intend to publish a separate Children&apos;s Privacy Notice
            and implement a verifiable parental consent flow before scaling
            beyond the pilot.
          </p>
        </Section>

        <Section title="7. Data retention">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Parent account and kid profile</strong> — retained while
              the account is active. On deletion we delete or anonymize the
              records.
            </li>
            <li>
              <strong>Bookings and session history</strong> — retained for the
              facility&apos;s record-keeping.
            </li>
            <li>
              <strong>Coach video messages and drill videos</strong> — retained
              for the life of the account so families can re-watch coaching
              content.
            </li>
            <li>
              <strong>Points ledger, orders, and redemption codes</strong> —
              retained for fraud, audit, and reconciliation purposes.
            </li>
          </ul>
        </Section>

        <Section title="8. Your rights">
          <p>You can:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>Request deletion</strong> of your account and kid
              profile(s) by emailing{" "}
              <a
                href="mailto:privacy@fittheorem.com"
                className="text-blue-600 underline"
              >
                privacy@fittheorem.com
              </a>
              .
            </li>
            <li>
              <strong>Request a copy</strong> of the data we hold about your
              family.
            </li>
            <li>
              <strong>Correct</strong> parent contact info from inside the app
              or by emailing us.
            </li>
            <li>
              <strong>Withdraw push-notification permission</strong> in your
              phone&apos;s system settings at any time.
            </li>
          </ul>
          <p className="mt-3">
            We will respond within a reasonable period and confirm the action in
            writing.
          </p>
        </Section>

        <Section title="9. Security">
          <p>
            Data is stored in Supabase with row-level security policies
            enforcing tenant and family boundaries. Passwords are hashed.
            Authentication tokens are short-lived and refreshed automatically.
            Server-side keys are held only on the server and never shipped in
            the mobile app.
          </p>
          <p className="mt-3">
            No system is perfectly secure. If we ever detect a security incident
            affecting your data, we will notify affected accounts.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We will post material changes to this policy in the app and, where
            required, notify the parent account by email. Continued use of the
            app after a change indicates acceptance of the updated policy.
          </p>
        </Section>

        <div className="mt-10 border-t pt-6 text-sm text-gray-500">
          <p>
            Questions? Email{" "}
            <a
              href="mailto:privacy@fittheorem.com"
              className="text-blue-600 underline"
            >
              privacy@fittheorem.com
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-semibold text-gray-900">{title}</h2>
      <div className="text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-base font-semibold text-gray-800">{title}</h3>
      <div className="text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}
