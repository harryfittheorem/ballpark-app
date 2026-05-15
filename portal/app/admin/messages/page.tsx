/**
 * /admin/messages — read-only inbox for the owner to see all coach↔family
 * messages across the tenant (both directions, newest first, max 200).
 *
 * Direction filter: All / Coach → Family / Parent → Coach.
 *
 * coach→family:  recipient_coach_user_id IS NULL
 * parent→coach:  recipient_coach_user_id IS NOT NULL
 *
 * Uses the service-role client so tenant-admin RLS policies don't need to
 * cover this read path.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { readAppRole, readTenantId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";

type MsgRow = {
  id: string;
  sender_user_id: string;
  sender_display: string | null;
  recipient_coach_user_id: string | null;
  message_text: string | null;
  viewed_at: string | null;
  created_at: string;
  label: string | null;
  recipient_kid: { first_name: string; last_name: string | null } | null;
  video: { mux_playback_id: string | null } | null;
};

type CoachRow = {
  user_id: string;
  first_name: string;
  last_name: string | null;
};

const DIRECTIONS = ["all", "coach_to_family", "parent_to_coach"] as const;
type Direction = (typeof DIRECTIONS)[number];

const DIRECTION_LABELS: Record<Direction, string> = {
  all: "All",
  coach_to_family: "Coach → Family",
  parent_to_coach: "Parent → Coach",
};

function muxThumb(playbackId: string) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=320&time=2`;
}

function relativeTime(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / (86400 * 7)), "week");
  return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
}

function buildHref(dir: Direction): string {
  if (dir === "all") return "/admin/messages";
  return `/admin/messages?direction=${dir}`;
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ direction?: string }>;
}) {
  const sp = await searchParams;

  // Auth guard (admin layout also checks but belt-and-suspenders for direct hits).
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  if (readAppRole(session) !== "admin") redirect("/logout?reason=forbidden");
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");

  const activeDir: Direction =
    sp.direction && (DIRECTIONS as readonly string[]).includes(sp.direction)
      ? (sp.direction as Direction)
      : "all";

  // Service client to read all coach_messages regardless of RLS.
  const svc = createServiceClient();

  // Load messages + kid name + video mux_playback_id.
  let q = svc
    .from("coach_messages")
    .select(
      "id, sender_user_id, sender_display, recipient_coach_user_id, " +
        "message_text, viewed_at, created_at, label, " +
        "recipient_kid:recipient_kid_id(first_name, last_name), " +
        "video:video_id(mux_playback_id)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (activeDir === "coach_to_family") {
    q = q.is("recipient_coach_user_id", null);
  } else if (activeDir === "parent_to_coach") {
    q = q.not("recipient_coach_user_id", "is", null);
  }

  const { data: msgData, error: msgError } = await q;

  // Load coaches so we can resolve user_id → name.
  const { data: coachData } = await svc
    .from("coaches")
    .select("user_id, first_name, last_name")
    .eq("tenant_id", tenantId);

  const coaches = ((coachData ?? []) as unknown as CoachRow[]).reduce<
    Record<string, string>
  >((acc, c) => {
    acc[c.user_id] = [c.first_name, c.last_name].filter(Boolean).join(" ");
    return acc;
  }, {});

  const rows = (msgData ?? []) as unknown as MsgRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Messages
        </h1>
        <p className="mt-1 text-sm text-text-light">
          All coach↔family messages for this location — read-only view, newest first.
        </p>
      </div>

      {/* Direction filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
          Direction
        </span>
        {DIRECTIONS.map((d) => {
          const active = activeDir === d;
          return (
            <Link
              key={d}
              href={buildHref(d)}
              className={
                "rounded-full border px-3 py-1 text-xs " +
                (active
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border-gold bg-darkest text-cream hover:border-gold hover:text-gold")
              }
            >
              {DIRECTION_LABELS[d]}
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-text-light">
          {rows.length === 200 ? "Showing latest 200" : `${rows.length} message${rows.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {msgError ? (
        <Card padding="md" className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">
            Failed to load messages: {msgError.message}
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <Card padding="lg" className="border-dashed text-center">
          <p className="text-sm text-text-light">
            {activeDir === "all"
              ? "No messages yet."
              : `No ${DIRECTION_LABELS[activeDir].toLowerCase()} messages yet.`}
          </p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-border-gold">
            {rows.map((row) => {
              const isParentToCoach = !!row.recipient_coach_user_id;

              // Resolve names for both directions.
              const coachName = isParentToCoach
                ? (coaches[row.recipient_coach_user_id!] ?? "Coach")
                : (coaches[row.sender_user_id] ?? "Coach");

              const kid = Array.isArray(row.recipient_kid)
                ? row.recipient_kid[0]
                : row.recipient_kid;
              const kidName = kid
                ? [kid.first_name, kid.last_name].filter(Boolean).join(" ")
                : "—";

              const senderName = isParentToCoach
                ? (row.sender_display?.trim() || "Parent")
                : coachName;
              const recipientName = isParentToCoach ? coachName : kidName;

              const video = Array.isArray(row.video) ? row.video[0] : row.video;
              const playbackId = video?.mux_playback_id ?? null;

              const preview = row.message_text?.trim() || (playbackId ? null : "(no text)");

              return (
                <li
                  key={row.id}
                  className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-darkest/40"
                >
                  {/* Mux thumbnail */}
                  {playbackId ? (
                    <a
                      href={`https://stream.mux.com/${playbackId}.m3u8`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                      title="Open video stream"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={muxThumb(playbackId)}
                        alt="Video thumbnail"
                        width={80}
                        height={45}
                        className="rounded border border-border-gold object-cover opacity-80 hover:opacity-100"
                        style={{ width: 80, height: 45 }}
                      />
                    </a>
                  ) : (
                    <div className="h-[45px] w-[80px] shrink-0 rounded border border-border-gold bg-darkest" />
                  )}

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Direction badge */}
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] " +
                          (isParentToCoach
                            ? "border border-gold bg-gold/10 text-gold"
                            : "border border-border-gold bg-darkest text-text-light")
                        }
                      >
                        {isParentToCoach ? "Parent → Coach" : "Coach → Family"}
                      </span>
                      <span className="text-sm font-semibold text-cream-light">
                        {senderName}
                        <span className="font-normal text-text-light"> → </span>
                        {recipientName}
                      </span>
                      {!isParentToCoach && kidName !== recipientName && (
                        <span className="text-xs text-text-light">
                          about {kidName}
                        </span>
                      )}
                      {row.label ? (
                        <span className="inline-flex items-center rounded-full border border-border-gold bg-darkest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-deep">
                          {row.label.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </div>
                    {preview ? (
                      <p className="mt-1 truncate text-sm text-text-light">
                        {preview}
                      </p>
                    ) : null}
                  </div>

                  {/* Meta: time + viewed */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-text-light">
                      {relativeTime(row.created_at)}
                    </span>
                    {row.viewed_at ? (
                      <span className="text-[11px] text-text-light/70">Viewed</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gold">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                        Unread
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Link
        href="/admin"
        className="inline-block text-sm text-text-light hover:text-gold"
      >
        ← Back to admin
      </Link>
    </div>
  );
}
