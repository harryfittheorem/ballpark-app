"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionTypeRow {
  id: string;
  name: string;
  type_category: string;
  duration_minutes: number;
  base_price_cents: number;
  description: string | null;
}

interface AvailabilitySlot {
  coach_id: string;
  coach_first_name: string;
  coach_last_name: string;
  location_id: string;
  location_name: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface KidRow {
  id: string;
  first_name: string;
  last_name: string;
}

type AuthMode = "signin" | "signup";
type FlowState = "browse" | "auth" | "confirm" | "success";

// ---------------------------------------------------------------------------
// sessionStorage keys for slot persistence across auth handoff
// ---------------------------------------------------------------------------
const SS_SLOT = "ballpark.booking.pendingSlot";
const SS_TYPE = "ballpark.booking.selectedType";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatLongDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(iso: string): { weekday: string; day: string } {
  const d = new Date(iso + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    day: String(d.getDate()),
  };
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function categoryLabel(cat: string): string {
  if (cat === "private") return "Private";
  if (cat === "group") return "Group";
  if (cat === "cage") return "Cage Rental";
  return cat;
}

function priceFmt(cents: number): string {
  if (cents <= 0) return "";
  return ` · $${(cents / 100).toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BookingClientProps {
  tenantSlug: string;
  tenantName: string;
  brandLogoUrl: string | null;
  brandColors: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BookingClient({
  tenantSlug,
  tenantName,
  brandLogoUrl,
  brandColors,
}: BookingClientProps) {
  const supabase: SupabaseClient = createClient();

  // ── Brand color CSS vars ──────────────────────────────────────────────────
  const brandStyle = {
    "--bp-primary":      brandColors.gold      ?? "#F1E5AD",
    "--bp-primary-deep": brandColors.goldDeep  ?? "#B8A268",
    "--bp-bg":           brandColors.dark       ?? "#2D2B2A",
    "--bp-bg-raised":    brandColors.darker     ?? "#1C1B1A",
    "--bp-cream":        brandColors.cream      ?? "#FAF6E8",
  } as React.CSSProperties;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [sessionTypes, setSessionTypes] = useState<SessionTypeRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ── Browse — session type is REQUIRED before seeing slots ─────────────────
  const [selectedType, setSelectedType] = useState<SessionTypeRow | null>(null);
  const [selectedCoach, setSelectedCoach] = useState("all");

  // ── Browse — date strip ───────────────────────────────────────────────────
  const today = useRef(new Date());
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(toDateStr(today.current));

  // ── Flow ──────────────────────────────────────────────────────────────────
  const [flowState, setFlowState] = useState<FlowState>("browse");
  const [pendingSlot, setPendingSlot] = useState<AvailabilitySlot | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // ── Sign-in fields ────────────────────────────────────────────────────────
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // ── Sign-up fields ────────────────────────────────────────────────────────
  const [suFirst, setSuFirst] = useState("");
  const [suLast, setSuLast] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suKidFirst, setSuKidFirst] = useState("");
  const [suKidLast, setSuKidLast] = useState("");

  // ── Confirm ───────────────────────────────────────────────────────────────
  const [kids, setKids] = useState<KidRow[]>([]);
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  // ── Date window ───────────────────────────────────────────────────────────
  const windowDates = Array.from({ length: 14 }, (_, i) =>
    toDateStr(addDays(today.current, dateOffset + i))
  );
  const windowStart = windowDates[0];
  const windowEnd = windowDates[windowDates.length - 1];

  // ── Session listener + sessionStorage slot restore ────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // Restore pending slot/type after email-confirmation redirect
      if (data.session) {
        const rawSlot = sessionStorage.getItem(SS_SLOT);
        const rawType = sessionStorage.getItem(SS_TYPE);
        if (rawSlot && rawType) {
          try {
            const slot = JSON.parse(rawSlot) as AvailabilitySlot;
            const type = JSON.parse(rawType) as SessionTypeRow;
            setPendingSlot(slot);
            setSelectedType(type);
            setFlowState("confirm");
          } catch { /* corrupt storage — ignore */ }
        }
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_ev, s) => setSession(s)
    );
    return () => subscription.unsubscribe();
  }, [supabase]);

  // ── Session types ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .rpc("get_public_session_types", { p_tenant_slug: tenantSlug })
      .then(({ data }) => setSessionTypes((data as SessionTypeRow[]) ?? []));
  }, [supabase, tenantSlug]);

  // ── Availability — only load once a session type is selected ──────────────
  const loadAvailability = useCallback(async () => {
    if (!selectedType) {
      setAvailability([]);
      return;
    }
    setLoadingSlots(true);
    const { data } = await supabase.rpc("get_public_availability", {
      p_tenant_slug:      tenantSlug,
      p_date_range_start: windowStart,
      p_date_range_end:   windowEnd,
      p_duration_minutes: selectedType.duration_minutes,
    });
    setAvailability((data as AvailabilitySlot[]) ?? []);
    setLoadingSlots(false);
  }, [supabase, tenantSlug, windowStart, windowEnd, selectedType]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // ── Load kids when session present ────────────────────────────────────────
  const loadKids = useCallback(async () => {
    if (!session) return;
    const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
    const { data } = await db
      .from("kids")
      .select("id, first_name, last_name")
      .order("first_name");
    const list = (data ?? []) as KidRow[];
    setKids(list);
    if (list.length > 0 && !selectedKidId) {
      setSelectedKidId(list[0].id);
    }
  }, [session, supabase, selectedKidId]);

  useEffect(() => {
    loadKids();
  }, [loadKids]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const uniqueCoaches = Array.from(
    new Map(
      availability.map((s) => [
        s.coach_id,
        `${s.coach_first_name} ${s.coach_last_name}`,
      ])
    ).entries()
  );

  // Slots for the selected date, filtered by coach, with is_available = true
  const filteredSlots = availability.filter(
    (s) =>
      s.is_available &&
      s.slot_date === selectedDate &&
      (selectedCoach === "all" || s.coach_id === selectedCoach)
  );

  const availableDates = new Set(
    availability.filter((s) => s.is_available).map((s) => s.slot_date)
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSelectType(st: SessionTypeRow) {
    setSelectedType(st);
    sessionStorage.setItem(SS_TYPE, JSON.stringify(st));
    setSelectedCoach("all");
  }

  function handleSelectSlot(slot: AvailabilitySlot) {
    setPendingSlot(slot);
    sessionStorage.setItem(SS_SLOT, JSON.stringify(slot));
    setFlowState(session ? "confirm" : "auth");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: siEmail,
      password: siPassword,
    });
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setFlowState("confirm");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { data: signUpData, error: signUpError } =
      await supabase.auth.signUp({
        email: suEmail,
        password: suPassword,
        options: {
          data: {
            first_name: suFirst,
            last_name: suLast,
            tenant_slug: tenantSlug,
          },
        },
      });

    if (signUpError) {
      setAuthError(signUpError.message);
      setAuthLoading(false);
      return;
    }

    if (!signUpData.session) {
      setAuthError(
        "Account created! Please check your email to confirm, then sign in here."
      );
      setAuthMode("signin");
      setSiEmail(suEmail);
      setAuthLoading(false);
      return;
    }

    // Family + kid created by handle_new_user trigger — add the kid row
    const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
    const { data: familyData } = await db
      .from("families")
      .select("id")
      .maybeSingle();
    const familyId = (familyData as { id: string } | null)?.id ?? null;

    if (familyId) {
      await db.from("kids").insert({
        family_id: familyId,
        first_name: suKidFirst,
        last_name: suKidLast,
      });
    }

    await loadKids();
    setAuthLoading(false);
    setFlowState("confirm");
  }

  async function handleConfirmBooking() {
    if (!pendingSlot || !selectedType || !session) return;
    setConfirmLoading(true);
    setConfirmError(null);

    let kidId = selectedKidId;
    if (!kidId && kids.length > 0) kidId = kids[0].id;
    if (!kidId) {
      setConfirmError("No athlete found on your account.");
      setConfirmLoading(false);
      return;
    }

    const scheduledStart = new Date(
      `${pendingSlot.slot_date}T${pendingSlot.start_time}`
    ).toISOString();

    const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
    const { data, error } = await db.rpc("create_public_booking", {
      p_tenant_slug:     tenantSlug,
      p_coach_id:        pendingSlot.coach_id,
      p_location_id:     pendingSlot.location_id,
      p_session_type_id: selectedType.id,
      p_kid_id:          kidId,
      p_scheduled_start: scheduledStart,
    });

    if (error) {
      const msg =
        error.message === "slot_not_available"
          ? "This slot was just taken — please choose another time."
          : error.message === "family_not_found"
          ? "Account setup incomplete. Please contact the facility."
          : error.message;
      setConfirmError(msg);
      setConfirmLoading(false);
      return;
    }

    const bookingId = (
      (data as Array<{ booking_id: string }> | null)?.[0]?.booking_id ?? ""
    );
    setConfirmedId(bookingId);
    setFlowState("success");
    setConfirmLoading(false);

    // Clear persisted selection
    sessionStorage.removeItem(SS_SLOT);
    sessionStorage.removeItem(SS_TYPE);

    // Confirmation email — best-effort, fire-and-forget
    if (bookingId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        fetch(`${supabaseUrl}/functions/v1/booking-confirmation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ booking_id: bookingId }),
        }).catch(() => {});
      }
    }

    loadAvailability();
  }

  function handleClose() {
    setFlowState("browse");
    setPendingSlot(null);
    setAuthError(null);
    setConfirmError(null);
    sessionStorage.removeItem(SS_SLOT);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-darkest text-cream-light" style={brandStyle}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header
        className="border-b border-border-gold px-4 py-4"
        style={{ backgroundColor: "var(--bp-bg)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogoUrl}
              alt={tenantName}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_14px_rgba(241,229,173,0.7)]"
                style={{ backgroundColor: "var(--bp-primary)" }}
              />
              <span className="font-display text-xl font-semibold uppercase tracking-[0.18em] text-cream-light">
                {tenantName}
              </span>
            </div>
          )}
          <span className="ml-auto text-sm text-text-light">Book a Session</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-32">

        {/* ─── Step 1: Session Type (REQUIRED) ────────────────────────── */}
        <section className="mb-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
            1. Choose Session Type
          </p>
          {sessionTypes.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl border border-border-gold bg-darker"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {sessionTypes.map((st) => {
                const isActive = selectedType?.id === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => handleSelectType(st)}
                    style={
                      isActive
                        ? {
                            borderColor: "var(--bp-primary)",
                            backgroundColor: "color-mix(in srgb, var(--bp-primary) 12%, transparent)",
                          }
                        : undefined
                    }
                    className={[
                      "group flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                      isActive
                        ? "shadow-sm"
                        : "border-border-gold bg-darker hover:border-gold/50",
                    ].join(" ")}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          isActive
                            ? "text-sm font-semibold"
                            : "text-sm font-semibold text-cream-light"
                        }
                        style={isActive ? { color: "var(--bp-primary)" } : undefined}
                      >
                        {st.name}
                      </p>
                      <p className="mt-0.5 text-xs text-text-light">
                        {st.duration_minutes} min · {categoryLabel(st.type_category)}
                        {priceFmt(st.base_price_cents)}
                      </p>
                      {st.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-text-muted">
                          {st.description}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <span
                        className="mt-0.5 shrink-0 text-base font-bold"
                        style={{ color: "var(--bp-primary)" }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Step 2: Date + Slots (only after type selected) ────────── */}
        {!selectedType ? (
          <div className="rounded-2xl border border-border-gold/40 bg-darker px-6 py-10 text-center">
            <p className="text-sm text-text-light">
              Select a session type above to browse available times.
            </p>
          </div>
        ) : (
          <>
            {/* Coach filter */}
            {uniqueCoaches.length > 1 && (
              <section className="mb-5">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                  Coach
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all", name: "Any Coach" },
                    ...uniqueCoaches.map(([id, name]) => ({ id, name })),
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCoach(c.id)}
                      style={
                        c.id === selectedCoach
                          ? {
                              borderColor: "var(--bp-primary)",
                              backgroundColor: "color-mix(in srgb, var(--bp-primary) 15%, transparent)",
                              color: "var(--bp-primary)",
                            }
                          : undefined
                      }
                      className={
                        c.id === selectedCoach
                          ? "rounded-full border px-3.5 py-1 text-sm font-medium"
                          : PILL
                      }
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Date strip */}
            <section className="mb-6">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                2. Pick a Date
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDateOffset(Math.max(0, dateOffset - 7))}
                  disabled={dateOffset === 0}
                  aria-label="Previous week"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-gold text-text-light transition-colors hover:border-gold/50 hover:text-cream-light disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ‹
                </button>
                <div className="flex-1 overflow-x-auto">
                  <div className="flex gap-1.5 pb-0.5">
                    {windowDates.map((d) => {
                      const { weekday, day } = formatDateShort(d);
                      const hasSlots = availableDates.has(d);
                      const isSelected = selectedDate === d;
                      return (
                        <button
                          key={d}
                          onClick={() => setSelectedDate(d)}
                          style={
                            isSelected
                              ? {
                                  borderColor: "var(--bp-primary)",
                                  backgroundColor: "color-mix(in srgb, var(--bp-primary) 12%, transparent)",
                                  color: "var(--bp-primary)",
                                }
                              : undefined
                          }
                          className={[
                            "flex min-w-[52px] flex-col items-center rounded-xl border py-2 transition-colors",
                            isSelected
                              ? ""
                              : hasSlots
                              ? "border-border-gold text-cream-light hover:border-gold/50"
                              : "border-border-gold/40 text-text-muted",
                          ].join(" ")}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide">
                            {weekday}
                          </span>
                          <span className="mt-0.5 text-base font-semibold">{day}</span>
                          {hasSlots && (
                            <span
                              className="mt-1 h-1 w-1 rounded-full"
                              style={{
                                backgroundColor: isSelected
                                  ? "var(--bp-primary)"
                                  : "color-mix(in srgb, var(--bp-primary) 50%, transparent)",
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setDateOffset(dateOffset + 7)}
                  aria-label="Next week"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-gold text-text-light transition-colors hover:border-gold/50 hover:text-cream-light"
                >
                  ›
                </button>
              </div>
            </section>

            {/* Slot grid */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-cream-light">
                <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                  3. Pick a Time ·
                </span>
                {formatLongDate(selectedDate)}
              </h2>

              {loadingSlots ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-2xl border border-border-gold bg-darker"
                    />
                  ))}
                </div>
              ) : filteredSlots.length === 0 ? (
                <div className="rounded-2xl border border-border-gold bg-darker px-6 py-8 text-center">
                  <p className="text-text-light">No available times on this day.</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Try another date or coach.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSlots.map((slot, i) => (
                    <button
                      key={`${slot.coach_id}-${slot.start_time}-${i}`}
                      onClick={() => handleSelectSlot(slot)}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-border-gold bg-darker px-4 py-3 text-left transition-all hover:border-gold/50 hover:bg-dark"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--bp-primary) 12%, transparent)",
                          color: "var(--bp-primary)",
                        }}
                      >
                        ⚾
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-cream-light">
                          {fmt12(slot.start_time)} – {fmt12(slot.end_time)}
                        </p>
                        <p className="truncate text-xs text-text-light">
                          {slot.coach_first_name} {slot.coach_last_name} ·{" "}
                          {slot.location_name}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-opacity group-hover:opacity-90"
                        style={{
                          borderWidth: "1px",
                          borderStyle: "solid",
                          borderColor: "color-mix(in srgb, var(--bp-primary) 40%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--bp-primary) 8%, transparent)",
                          color: "var(--bp-primary)",
                        }}
                      >
                        Book
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ─── Bottom sheet overlay ──────────────────────────────────────── */}
      {flowState !== "browse" && (
        <>
          {/* Scrim */}
          <div
            className="fixed inset-0 z-40 bg-darkest/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t border-border-gold bg-darker shadow-card-lg">
            {/* Sheet header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-gold bg-darker px-5 py-4">
              <span className="font-display text-lg font-semibold uppercase tracking-wide text-cream-light">
                {flowState === "auth" && "Sign In to Book"}
                {flowState === "confirm" && "Confirm Booking"}
                {flowState === "success" && "Booking Confirmed"}
              </span>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-light hover:text-cream-light"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-5">
              {/* Slot + type summary bar */}
              {pendingSlot && selectedType && flowState !== "success" && (
                <div className="mb-5 rounded-2xl border border-border-gold bg-dark px-4 py-3">
                  <p className="text-sm font-semibold text-cream-light">
                    {selectedType.name} · {formatLongDate(pendingSlot.slot_date)}{" "}
                    at {fmt12(pendingSlot.start_time)} –{" "}
                    {fmt12(pendingSlot.end_time)}
                  </p>
                  <p className="mt-0.5 text-xs text-text-light">
                    {pendingSlot.coach_first_name} {pendingSlot.coach_last_name}{" "}
                    · {pendingSlot.location_name}
                  </p>
                </div>
              )}

              {/* ── AUTH ─────────────────────────────────────────────────── */}
              {flowState === "auth" && (
                <div>
                  {/* Tabs */}
                  <div className="mb-5 flex rounded-xl border border-border-gold p-0.5">
                    {(["signin", "signup"] as AuthMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setAuthMode(mode);
                          setAuthError(null);
                        }}
                        style={
                          authMode === mode
                            ? {
                                backgroundColor: "color-mix(in srgb, var(--bp-primary) 12%, transparent)",
                                color: "var(--bp-primary)",
                              }
                            : undefined
                        }
                        className={[
                          "flex-1 rounded-[10px] py-2 text-sm font-medium transition-colors",
                          authMode !== mode ? "text-text-light hover:text-cream-light" : "",
                        ].join(" ")}
                      >
                        {mode === "signin" ? "Sign In" : "Create Account"}
                      </button>
                    ))}
                  </div>

                  {authError && (
                    <div className="mb-4 rounded-xl border border-danger/40 bg-danger-bg px-4 py-2.5 text-sm text-danger">
                      {authError}
                    </div>
                  )}

                  {authMode === "signin" ? (
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <FieldGroup label="Email">
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={siEmail}
                          onChange={(e) => setSiEmail(e.target.value)}
                          className={FIELD}
                          placeholder="you@example.com"
                        />
                      </FieldGroup>
                      <FieldGroup label="Password">
                        <input
                          type="password"
                          required
                          autoComplete="current-password"
                          value={siPassword}
                          onChange={(e) => setSiPassword(e.target.value)}
                          className={FIELD}
                          placeholder="••••••••"
                        />
                      </FieldGroup>
                      <GoldButton type="submit" disabled={authLoading} fullWidth>
                        {authLoading ? "Signing in…" : "Sign In & Continue"}
                      </GoldButton>
                    </form>
                  ) : (
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FieldGroup label="Your First Name">
                          <input
                            type="text"
                            required
                            value={suFirst}
                            onChange={(e) => setSuFirst(e.target.value)}
                            className={FIELD}
                            placeholder="Jane"
                          />
                        </FieldGroup>
                        <FieldGroup label="Your Last Name">
                          <input
                            type="text"
                            required
                            value={suLast}
                            onChange={(e) => setSuLast(e.target.value)}
                            className={FIELD}
                            placeholder="Smith"
                          />
                        </FieldGroup>
                      </div>
                      <FieldGroup label="Email">
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={suEmail}
                          onChange={(e) => setSuEmail(e.target.value)}
                          className={FIELD}
                          placeholder="you@example.com"
                        />
                      </FieldGroup>
                      <FieldGroup label="Password">
                        <input
                          type="password"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          value={suPassword}
                          onChange={(e) => setSuPassword(e.target.value)}
                          className={FIELD}
                          placeholder="min. 8 characters"
                        />
                      </FieldGroup>
                      <div className="rounded-xl border border-border-gold/50 bg-darkest px-4 py-3">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                          Athlete Details
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <FieldGroup label="First Name">
                            <input
                              type="text"
                              required
                              value={suKidFirst}
                              onChange={(e) => setSuKidFirst(e.target.value)}
                              className={FIELD}
                              placeholder="Alex"
                            />
                          </FieldGroup>
                          <FieldGroup label="Last Name">
                            <input
                              type="text"
                              required
                              value={suKidLast}
                              onChange={(e) => setSuKidLast(e.target.value)}
                              className={FIELD}
                              placeholder="Smith"
                            />
                          </FieldGroup>
                        </div>
                      </div>
                      <GoldButton type="submit" disabled={authLoading} fullWidth>
                        {authLoading ? "Creating account…" : "Create Account & Continue"}
                      </GoldButton>
                    </form>
                  )}
                </div>
              )}

              {/* ── CONFIRM ──────────────────────────────────────────────── */}
              {flowState === "confirm" && (
                <div className="space-y-5">
                  {/* Athlete picker (multi-kid) */}
                  {kids.length > 1 && (
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
                        Athlete
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {kids.map((k) => (
                          <button
                            key={k.id}
                            onClick={() => setSelectedKidId(k.id)}
                            style={
                              selectedKidId === k.id
                                ? {
                                    borderColor: "var(--bp-primary)",
                                    backgroundColor: "color-mix(in srgb, var(--bp-primary) 15%, transparent)",
                                    color: "var(--bp-primary)",
                                  }
                                : undefined
                            }
                            className={
                              selectedKidId === k.id
                                ? "rounded-full border px-3.5 py-1 text-sm font-medium"
                                : PILL
                            }
                          >
                            {k.first_name} {k.last_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {kids.length === 0 && (
                    <p className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning">
                      No athlete found on this account. Please contact the
                      facility or create an account instead.
                    </p>
                  )}

                  {confirmError && (
                    <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-2.5 text-sm text-danger">
                      {confirmError}
                    </div>
                  )}

                  <GoldButton
                    onClick={handleConfirmBooking}
                    disabled={confirmLoading || kids.length === 0}
                    fullWidth
                  >
                    {confirmLoading ? "Booking…" : "Confirm Booking"}
                  </GoldButton>
                  <p className="text-center text-xs text-text-muted">
                    A confirmation will be sent to your email.
                  </p>
                </div>
              )}

              {/* ── SUCCESS ──────────────────────────────────────────────── */}
              {flowState === "success" && (
                <div className="space-y-6 py-2 text-center">
                  <div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--bp-primary) 15%, transparent)",
                      color: "var(--bp-primary)",
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-semibold uppercase tracking-wide text-cream-light">
                      You&apos;re booked!
                    </h3>
                    {pendingSlot && selectedType && (
                      <p className="mt-2 text-sm text-text-light">
                        {selectedType.name} ·{" "}
                        {formatLongDate(pendingSlot.slot_date)} at{" "}
                        {fmt12(pendingSlot.start_time)}
                        <br />
                        with {pendingSlot.coach_first_name}{" "}
                        {pendingSlot.coach_last_name}
                      </p>
                    )}
                    {confirmedId && (
                      <p className="mt-1 text-xs text-text-muted">
                        Ref #{confirmedId.slice(0, 8).toUpperCase()}
                      </p>
                    )}
                  </div>

                  {/* App download */}
                  <div className="rounded-2xl border border-border-gold bg-dark px-4 py-4 text-left">
                    <p className="mb-3 text-center text-sm font-semibold text-cream-light">
                      Track your progress in the Ballpark app
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <a
                        href="https://apps.apple.com/app/ballpark"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-gold bg-darker px-4 py-2.5 text-sm text-cream-light transition-colors hover:border-gold/50"
                      >
                        <span>🍎</span> Download on the App Store
                      </a>
                      <a
                        href="https://play.google.com/store/apps/details?id=com.ballpark"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-gold bg-darker px-4 py-2.5 text-sm text-cream-light transition-colors hover:border-gold/50"
                      >
                        <span>▶</span> Get it on Google Play
                      </a>
                    </div>
                  </div>

                  <button
                    onClick={handleClose}
                    className="text-sm text-text-light underline-offset-2 hover:text-cream-light hover:underline"
                  >
                    Book another session
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const FIELD =
  "block w-full rounded-xl border border-border-gold bg-darkest/80 px-3.5 py-2.5 text-sm text-cream-light placeholder:text-text-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40";

const PILL =
  "rounded-full border border-border-gold px-3.5 py-1 text-sm font-medium text-text-light transition-colors hover:border-gold/50 hover:text-cream-light";

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
        {label}
      </label>
      {children}
    </div>
  );
}

function GoldButton({
  children,
  fullWidth,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ backgroundColor: "var(--bp-primary)", color: "var(--bp-bg-raised)" }}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90",
        fullWidth ? "w-full" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
