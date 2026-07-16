import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Ballpark",
  description: "Get help with the Ballpark app.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-900">
          Support
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Need help with the Ballpark app? We&apos;re here for you.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-gray-900">
            Contact us
          </h2>
          <p className="text-gray-700 leading-relaxed">
            For account questions, technical issues, data requests, or general
            inquiries, email us at:
          </p>
          <a
            href="mailto:support@fittheorem.com"
            className="mt-3 inline-block text-blue-600 underline text-lg font-medium"
          >
            support@fittheorem.com
          </a>
          <p className="mt-4 text-gray-700 leading-relaxed">
            We typically respond within one business day.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-gray-900">
            Facility support
          </h2>
          <p className="text-gray-700 leading-relaxed">
            For questions about your bookings, memberships, or in-person
            sessions, contact your facility directly. Your facility&apos;s
            contact information is available at the front desk.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-gray-900">
            Common topics
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            <li>
              <strong>Account deletion</strong> — email{" "}
              <a
                href="mailto:privacy@fittheorem.com"
                className="text-blue-600 underline"
              >
                privacy@fittheorem.com
              </a>{" "}
              to request deletion of your account and all associated data.
            </li>
            <li>
              <strong>Password reset</strong> — use the &quot;Forgot
              password&quot; link on the sign-in screen.
            </li>
            <li>
              <strong>Billing and payments</strong> — contact your facility
              directly for membership billing questions.
            </li>
            <li>
              <strong>HitTrax connection issues</strong> — email support with
              your athlete&apos;s name and HitTrax username and we&apos;ll
              investigate.
            </li>
            <li>
              <strong>Privacy questions</strong> — see our{" "}
              <a href="/privacy" className="text-blue-600 underline">
                Privacy Policy
              </a>{" "}
              or email{" "}
              <a
                href="mailto:privacy@fittheorem.com"
                className="text-blue-600 underline"
              >
                privacy@fittheorem.com
              </a>
              .
            </li>
          </ul>
        </section>

        <div className="mt-10 border-t pt-6 text-sm text-gray-500">
          <p>
            Ballpark is operated by Fit Theorem &middot;{" "}
            <a href="/privacy" className="text-blue-600 underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
