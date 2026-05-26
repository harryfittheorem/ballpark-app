import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readTenantId, getCoachCapabilities, isStaffPreset } from "@/lib/auth";
import {
  CheckInBoard,
  type CheckInBooking,
  type WaitlistCount,
} from "@/app/admin/check-in/CheckInBoard";

export const dynamic = "force-dynamic";

export default async function CoachCheckInPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=unauthenticated");

  const caps = await getCoachCapabilities(supabase, user.id);
  if (!isStaffPreset(caps)) redirect("/coach");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? "";
  if (!tenantId) redirect("/logout?reason=no-tenant");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: rows } = await supabase
    .from("bookings")
    .select(
      `id, scheduled_start, scheduled_end, cage_number, status, attended_at,
       kid:kid_id(first_name, last_name),
       coach:coach_id(first_name, last_name),
       session_type:session_type_id(name)`,
    )
    .eq("tenant_id", tenantId)
    .gte("scheduled_start", todayStart.toISOString())
    .lte("scheduled_start", todayEnd.toISOString())
    .not("status", "in", '("cancelled")')
    .order("scheduled_start");

  type RawRow = {
    id: string;
    scheduled_start: string;
    scheduled_end: string;
    cage_number: string | null;
    status: string;
    attended_at: string | null;
    kid: { first_name: string | null; last_name: string | null } | null;
    coach: { first_name: string | null; last_name: string | null } | null;
    session_type: { name: string | null } | null;
  };

  const bookings: CheckInBooking[] = (
    (rows ?? []) as unknown as RawRow[]
  ).map((r) => ({
    id: r.id,
    scheduled_start: r.scheduled_start,
    scheduled_end: r.scheduled_end,
    cage_number: r.cage_number,
    status: r.status,
    attended_at: r.attended_at,
    kid_first_name: r.kid?.first_name ?? null,
    kid_last_name: r.kid?.last_name ?? null,
    coach_first_name: r.coach?.first_name ?? null,
    coach_last_name: r.coach?.last_name ?? null,
    session_type_name: r.session_type?.name ?? null,
  }));

  const { data: waitlistRows } = await supabase
    .from("booking_waitlist")
    .select("scheduled_start")
    .eq("tenant_id", tenantId)
    .in("status", ["waiting", "notified"])
    .gte("scheduled_start", todayStart.toISOString())
    .lte("scheduled_start", todayEnd.toISOString());

  function toHourLabel(iso: string): string {
    const d = new Date(iso);
    const h24 = d.getHours();
    const period = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:00 ${period}`;
  }

  const hourCounts = new Map<string, number>();
  for (const row of waitlistRows ?? []) {
    const label = toHourLabel(row.scheduled_start);
    hourCounts.set(label, (hourCounts.get(label) ?? 0) + 1);
  }
  const waitlistCounts: WaitlistCount[] = Array.from(hourCounts.entries()).map(
    ([hour_label, count]) => ({ hour_label, count }),
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const totalWaitlist = waitlistRows?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Check-In
        </h1>
        <p className="mt-1 text-sm text-text-light">
          {today} · {bookings.length} booking
          {bookings.length !== 1 ? "s" : ""} today
          {totalWaitlist > 0 ? ` · ${totalWaitlist} on waitlist` : ""}
        </p>
      </div>
      <CheckInBoard
        initialBookings={bookings}
        waitlistCounts={waitlistCounts}
        tenantId={tenantId}
      />
    </div>
  );
}
