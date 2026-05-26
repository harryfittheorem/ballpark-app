import { useState, useEffect, useCallback } from "react";

/* ── Design Tokens ─────────────────────────────────────────── */
const BG = "#0C0C0C";
const SURFACE = "#161616";
const GOLD = "#D4A843";
const GOLD_DIM = "#9A7020";
const BORDER = "#272727";
const TEXT = "#F2F2F2";
const MUTED = "#7A7A7A";
const DIM = "#3A3A3A";
const RED = "#C0392B";
const GREEN = "#27AE60";

/* ── Font injection ────────────────────────────────────────── */
function useGoogleFonts() {
  useEffect(() => {
    const id = "pitch-deck-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* ── Shared style helpers ──────────────────────────────────── */
const DISPLAY: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
  fontWeight: 900,
  letterSpacing: "-0.01em",
  lineHeight: 1.0,
};

const BODY: React.CSSProperties = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontWeight: 400,
};

const LABEL: React.CSSProperties = {
  ...BODY,
  fontWeight: 600,
  fontSize: "1.1vw",
  letterSpacing: "0.2em",
  color: GOLD,
  textTransform: "uppercase" as const,
};

const SLIDE_ROOT: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  background: BG,
  overflow: "hidden",
  position: "relative",
  color: TEXT,
  boxSizing: "border-box",
};

function GoldLine({ vertical = false, style = {} }: { vertical?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: `linear-gradient(${vertical ? "to bottom" : "to right"}, transparent, ${GOLD}, transparent)`,
        [vertical ? "width" : "height"]: "1px",
        [vertical ? "height" : "width"]: "100%",
        opacity: 0.5,
        ...style,
      }}
    />
  );
}

function SlideCounter({ current, total }: { current: number; total: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "3vh",
        right: "4vw",
        ...BODY,
        fontSize: "1.2vw",
        color: MUTED,
        letterSpacing: "0.1em",
      }}
    >
      {String(current).padStart(2, "0")} / {String(total).padStart(2, "0")}
    </div>
  );
}

function BallparkWordmark({ size = "1.4vw" }: { size?: string }) {
  return (
    <div
      style={{
        ...DISPLAY,
        fontSize: size,
        letterSpacing: "0.35em",
        color: GOLD,
        textTransform: "uppercase" as const,
        fontWeight: 700,
      }}
    >
      BALLPARK
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 01 — TITLE
══════════════════════════════════════════════════════════════ */
function Slide01() {
  return (
    <div
      style={{
        ...SLIDE_ROOT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, #1A1400 0%, #0C0C0C 70%)",
      }}
    >
      {/* Top gold rule */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />

      {/* Content */}
      <div style={{ textAlign: "center", maxWidth: "72vw" }}>
        <BallparkWordmark size="1.6vw" />
        <div style={{ height: "3vh" }} />

        <h1
          style={{
            ...DISPLAY,
            fontSize: "7.5vw",
            color: TEXT,
            margin: 0,
            textWrap: "balance" as unknown as undefined,
          }}
        >
          The Operating System
        </h1>
        <h1
          style={{
            ...DISPLAY,
            fontSize: "7.5vw",
            color: GOLD,
            margin: 0,
          }}
        >
          for Youth Sports
        </h1>

        <div style={{ height: "3.5vh" }} />
        <GoldLine style={{ width: "20vw", margin: "0 auto" }} />
        <div style={{ height: "3.5vh" }} />

        <p
          style={{
            ...BODY,
            fontSize: "2.2vw",
            color: MUTED,
            margin: 0,
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          MindBody runs a gym. Ballpark runs a franchise.
          <br />
          The difference is the kid.
        </p>
      </div>

      {/* Bottom rule */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 02 — THE PROBLEM
══════════════════════════════════════════════════════════════ */
function Slide02({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "6vh 6vw" }}>
      <div style={LABEL}>Part 1 — The Problem</div>
      <div style={{ height: "2vh" }} />

      <h2 style={{ ...DISPLAY, fontSize: "4.8vw", margin: 0, maxWidth: "55vw", lineHeight: 1.05, color: TEXT }}>
        Youth sports facilities run on tools built for yoga studios.
      </h2>

      <div style={{ height: "3vh" }} />
      <GoldLine style={{ width: "8vw" }} />
      <div style={{ height: "3.5vh" }} />

      {/* Stat row */}
      <div style={{ display: "flex", gap: "2vw", marginBottom: "3.5vh" }}>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2vh 2.5vw", flex: 1, borderTop: `3px solid ${GOLD}` }}>
          <div style={{ ...DISPLAY, fontSize: "5vw", color: GOLD, lineHeight: 1 }}>5</div>
          <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED, marginTop: "0.5vh" }}>Locations</div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2vh 2.5vw", flex: 1, borderTop: `3px solid ${GOLD}` }}>
          <div style={{ ...DISPLAY, fontSize: "5vw", color: GOLD, lineHeight: 1 }}>15</div>
          <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED, marginTop: "0.5vh" }}>Coaches</div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2vh 2.5vw", flex: 1, borderTop: `3px solid ${GOLD}` }}>
          <div style={{ ...DISPLAY, fontSize: "5vw", color: GOLD, lineHeight: 1 }}>400</div>
          <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED, marginTop: "0.5vh" }}>Families</div>
        </div>
        <div style={{ background: "#1A0A00", border: `1px solid ${GOLD_DIM}`, borderRadius: 4, padding: "2vh 2.5vw", flex: 2, borderTop: `3px solid ${RED}` }}>
          <div style={{ ...DISPLAY, fontSize: "3.5vw", color: RED, lineHeight: 1 }}>$300–$500</div>
          <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED, marginTop: "0.5vh" }}>lost per churned family per year</div>
        </div>
      </div>

      {/* Pain bullets */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
          <div style={{ width: "2px", height: "3.5vh", background: GOLD, flexShrink: 0, marginTop: "0.3vh" }} />
          <p style={{ ...BODY, fontSize: "2vw", color: TEXT, margin: 0 }}>
            A coach texts drill feedback. A 12-year-old hits 88 mph. Nobody records it.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
          <div style={{ width: "2px", height: "3.5vh", background: GOLD, flexShrink: 0, marginTop: "0.3vh" }} />
          <p style={{ ...BODY, fontSize: "2vw", color: TEXT, margin: 0 }}>
            The kid walks out. The relationship is gone. The facility has zero presence in his life.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
          <div style={{ width: "2px", height: "3.5vh", background: GOLD, flexShrink: 0, marginTop: "0.3vh" }} />
          <p style={{ ...BODY, fontSize: "2vw", color: TEXT, margin: 0 }}>
            The owner has no idea which location is performing, which coaches retain families, which kids are about to churn.
          </p>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "3.5vh", left: "6vw", ...BODY, fontSize: "1.6vw", fontStyle: "italic", color: GOLD }}>
        It&rsquo;s not a booking problem. It&rsquo;s an engagement problem.
      </div>
      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 03 — MEET MARCUS RIVERA
══════════════════════════════════════════════════════════════ */
function Slide03({ n, total }: { n: number; total: number }) {
  const capabilities = [
    "HitTrax auto-import — session data 2 min after leaving the cage",
    "Two-way video messaging — coach sends breakdowns, family replies",
    "Drill assignments — homework with points, coach reviews 1–5 stars",
    "Gamification engine — points, leaderboard, redemption codes",
    "Booking — filter, pick, confirm in under 20 seconds",
    "Profile — PRs grid, achievements, order history",
  ];
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex" }}>
      {/* Left panel */}
      <div style={{ width: "42vw", background: "linear-gradient(160deg, #1A1200 0%, #0C0C0C 100%)", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", padding: "6vh 4vw" }}>
        <div style={LABEL}>Part 2 — The Product</div>
        <div style={{ height: "2.5vh" }} />
        <div style={{ ...DISPLAY, fontSize: "9vw", color: GOLD, lineHeight: 1 }}>847</div>
        <div style={{ ...BODY, fontSize: "1.8vw", color: MUTED, marginBottom: "2vh" }}>points</div>
        <div style={{ ...DISPLAY, fontSize: "3.5vw", color: TEXT, lineHeight: 1.1 }}>
          #3 in 14U
        </div>
        <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED, marginTop: "0.5vh" }}>Infinite Hitting</div>
        <div style={{ height: "3vh" }} />
        <GoldLine style={{ width: "8vw" }} />
        <div style={{ height: "2.5vh" }} />
        <div style={{ ...DISPLAY, fontSize: "2.4vw", color: TEXT, lineHeight: 1.3 }}>
          Marcus Rivera, 14U.
        </div>
        <div style={{ ...BODY, fontSize: "1.8vw", color: MUTED, marginTop: "1vh", fontStyle: "italic" }}>
          One athlete. One day.
          <br />
          Six capabilities.
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "6vh 4.5vw" }}>
        <div style={{ ...DISPLAY, fontSize: "2.8vw", color: TEXT, marginBottom: "2.5vh" }}>
          What Marcus sees when he opens the app
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.4vh" }}>
          {capabilities.map((cap, i) => (
            <div key={i} style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ ...DISPLAY, fontSize: "1.8vw", color: GOLD, fontWeight: 700, flexShrink: 0, minWidth: "2vw" }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ ...BODY, fontSize: "1.75vw", color: TEXT, lineHeight: 1.4 }}>{cap}</div>
            </div>
          ))}
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 04 — HITTRAX AUTO-IMPORT
══════════════════════════════════════════════════════════════ */
function Slide04({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex" }}>
      {/* Left */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "6vh 5vw" }}>
        <div style={LABEL}>Feature 01 — Performance Data</div>
        <div style={{ height: "2vh" }} />
        <h2 style={{ ...DISPLAY, fontSize: "5.5vw", margin: 0, color: TEXT, lineHeight: 1.0 }}>
          HitTrax
          <br />
          <span style={{ color: GOLD }}>Auto-Import</span>
        </h2>
        <div style={{ height: "2.5vh" }} />
        <GoldLine style={{ width: "6vw" }} />
        <div style={{ height: "2.5vh" }} />
        <p style={{ ...BODY, fontSize: "2vw", color: MUTED, margin: 0, lineHeight: 1.6 }}>
          A Supabase Edge Function polls HitTrax every 2 minutes
          and upserts each session automatically.
        </p>
        <div style={{ height: "2.5vh" }} />
        <p style={{ ...BODY, fontSize: "2vw", color: MUTED, margin: 0, fontStyle: "italic", lineHeight: 1.5 }}>
          No coach data entry. No parent upload.
          <br />
          It just appears.
        </p>
      </div>

      {/* Right — stat cards */}
      <div style={{ width: "44vw", display: "flex", flexDirection: "column", justifyContent: "center", padding: "6vh 4vw", gap: "2vh" }}>
        <div style={{ display: "flex", gap: "2vw" }}>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2.5vh 2vw", borderLeft: `3px solid ${GOLD}` }}>
            <div style={{ ...DISPLAY, fontSize: "5.5vw", color: GOLD }}>47</div>
            <div style={{ ...BODY, fontSize: "1.5vw", color: MUTED }}>swings today</div>
          </div>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2.5vh 2vw", borderLeft: `3px solid ${GOLD}` }}>
            <div style={{ ...DISPLAY, fontSize: "5.5vw", color: GOLD }}>88.4</div>
            <div style={{ ...BODY, fontSize: "1.5vw", color: MUTED }}>mph avg exit velo</div>
          </div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2.5vh 2vw", borderLeft: `3px solid ${GOLD}` }}>
          <div style={{ ...DISPLAY, fontSize: "5vw", color: GOLD }}>2 min</div>
          <div style={{ ...BODY, fontSize: "1.5vw", color: MUTED }}>data appears after leaving the cage</div>
        </div>

        <div style={{ background: "#0E1A0E", border: `1px solid #1D3A1D`, borderRadius: 4, padding: "2vh 2vw" }}>
          <div style={{ ...LABEL, color: GREEN, marginBottom: "1vh" }}>Pipeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ ...BODY, fontSize: "1.6vw", color: TEXT }}>pg_cron → hittrax-poll → UPSERT sessions</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: TEXT }}>Personal bests computed server-side</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: TEXT }}>Per-swing data available in-app immediately</div>
          </div>
        </div>

        <div style={{ ...BODY, fontSize: "1.5vw", color: MUTED, fontStyle: "italic" }}>
          No competitor has automated this. The data is the hook.
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 05 — TWO-WAY VIDEO MESSAGING
══════════════════════════════════════════════════════════════ */
function Slide05({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "5vh 6vw" }}>
      <div style={LABEL}>Feature 02 — Video Messaging</div>
      <div style={{ height: "2vh" }} />
      <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, color: TEXT, lineHeight: 1.0 }}>
        Two-Way <span style={{ color: GOLD }}>Video Messaging</span>
      </h2>
      <div style={{ height: "1vh" }} />
      <p style={{ ...BODY, fontSize: "2vw", color: MUTED, margin: 0 }}>
        A relationship tool, not just a messaging tool.
      </p>
      <div style={{ height: "3vh" }} />
      <GoldLine />
      <div style={{ height: "3vh" }} />

      {/* Two columns */}
      <div style={{ display: "flex", gap: "4vw", flex: 1 }}>
        {/* Coach side */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", borderTop: `3px solid ${GOLD}` }}>
          <div style={{ ...LABEL, marginBottom: "2vh" }}>Coach Portal</div>
          <div style={{ ...DISPLAY, fontSize: "2.8vw", color: TEXT, marginBottom: "1.5vh", lineHeight: 1.1 }}>
            Coach sends a swing breakdown
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ ...BODY, fontSize: "1.75vw", color: MUTED }}>Records or uploads video on portal</div>
            <div style={{ ...BODY, fontSize: "1.75vw", color: MUTED }}>Mux processes to HLS in under 60 seconds</div>
            <div style={{ ...BODY, fontSize: "1.75vw", color: MUTED }}>Parent gets email (Resend) + in-app notification</div>
            <div style={{ ...BODY, fontSize: "1.75vw", color: MUTED }}>Full-screen playback, marks as viewed automatically</div>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1vh" }}>
          <div style={{ ...DISPLAY, fontSize: "3vw", color: GOLD }}>→</div>
          <div style={{ ...BODY, fontSize: "1.4vw", color: MUTED }}>Mux</div>
          <div style={{ ...DISPLAY, fontSize: "3vw", color: GOLD }}>←</div>
        </div>

        {/* Family side */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", borderTop: `3px solid #C9A227` }}>
          <div style={{ ...LABEL, color: "#C9A227", marginBottom: "2vh" }}>Family App</div>
          <div style={{ ...DISPLAY, fontSize: "2.8vw", color: TEXT, marginBottom: "1.5vh", lineHeight: 1.1 }}>
            Family replies with a video
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ ...BODY, fontSize: "1.75vw", color: MUTED }}>Records 10-second clip on phone</div>
            <div style={{ ...BODY, fontSize: "1.75vw", color: MUTED }}>Mux upload + processing fully in-app</div>
            <div style={{ ...BODY, fontSize: "1.75vw", color: MUTED }}>Coach receives in portal in real time</div>
            <div style={{ ...BODY, fontSize: "1.75vw", color: MUTED }}>Thread shows both sides inline</div>
          </div>
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 06 — DRILL ASSIGNMENTS
══════════════════════════════════════════════════════════════ */
function Slide06({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "5vh 6vw" }}>
      <div style={LABEL}>Feature 03 — Coaching Loop</div>
      <div style={{ height: "2vh" }} />
      <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, lineHeight: 1.0 }}>
        Drill Assignments
      </h2>
      <div style={{ height: "1vh" }} />
      <p style={{ ...BODY, fontSize: "2vw", color: MUTED, margin: 0 }}>
        Retention infrastructure. The coaching loop closes between sessions.
      </p>
      <div style={{ height: "3vh" }} />

      {/* 3-step process */}
      <div style={{ display: "flex", gap: "2.5vw", flex: 1 }}>
        {/* Step 1 */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", position: "relative" }}>
          <div style={{ ...DISPLAY, fontSize: "6vw", color: DIM, position: "absolute", top: "2vh", right: "2vw", lineHeight: 1 }}>01</div>
          <div style={{ ...LABEL, marginBottom: "2vh", color: GOLD }}>Coach Assigns</div>
          <div style={{ ...DISPLAY, fontSize: "2.4vw", color: TEXT, marginBottom: "1.5vh" }}>Hip rotation progression</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Title, description + drill video</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Due date — Thursday</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Duration — 15 minutes</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: GOLD, fontWeight: 600 }}>+25 pts on completion</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", color: GOLD }}>
          <div style={{ ...DISPLAY, fontSize: "2.5vw" }}>→</div>
        </div>

        {/* Step 2 */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", position: "relative" }}>
          <div style={{ ...DISPLAY, fontSize: "6vw", color: DIM, position: "absolute", top: "2vh", right: "2vw", lineHeight: 1 }}>02</div>
          <div style={{ ...LABEL, marginBottom: "2vh", color: GOLD }}>Family Submits</div>
          <div style={{ ...DISPLAY, fontSize: "2.4vw", color: TEXT, marginBottom: "1.5vh" }}>Mark as done</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Views assignment detail + drill video</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Taps &ldquo;Mark as done&rdquo;</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Coach notified via push</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: GOLD, fontWeight: 600 }}>Points held in escrow</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", color: GOLD }}>
          <div style={{ ...DISPLAY, fontSize: "2.5vw" }}>→</div>
        </div>

        {/* Step 3 */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", position: "relative" }}>
          <div style={{ ...DISPLAY, fontSize: "6vw", color: DIM, position: "absolute", top: "2vh", right: "2vw", lineHeight: 1 }}>03</div>
          <div style={{ ...LABEL, marginBottom: "2vh", color: GOLD }}>Coach Reviews</div>
          <div style={{ ...DISPLAY, fontSize: "2.4vw", color: TEXT, marginBottom: "1.5vh" }}>1–5 star rating + feedback</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Reviews from portal queue</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Writes text feedback</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Family notified via email + push</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: GREEN, fontWeight: 600 }}>+25 pts credited immediately</div>
          </div>
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 07 — GAMIFICATION ENGINE
══════════════════════════════════════════════════════════════ */
function Slide07({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex" }}>
      {/* Left — points system */}
      <div style={{ width: "45vw", display: "flex", flexDirection: "column", justifyContent: "center", padding: "5vh 5vw", borderRight: `1px solid ${BORDER}` }}>
        <div style={LABEL}>Feature 04 — Points Economy</div>
        <div style={{ height: "2vh" }} />
        <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, lineHeight: 1.0 }}>
          Gamification <span style={{ color: GOLD }}>Engine</span>
        </h2>
        <div style={{ height: "3vh" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2vw", background: SURFACE, padding: "1.5vh 1.5vw", borderRadius: 4, border: `1px solid ${BORDER}` }}>
            <div style={{ ...DISPLAY, fontSize: "3.5vw", color: GOLD, minWidth: "6vw" }}>+10</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: TEXT }}>Session attended</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2vw", background: SURFACE, padding: "1.5vh 1.5vw", borderRadius: 4, border: `1px solid ${BORDER}` }}>
            <div style={{ ...DISPLAY, fontSize: "3.5vw", color: GOLD, minWidth: "6vw" }}>+25</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: TEXT }}>Drill completed</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2vw", background: SURFACE, padding: "1.5vh 1.5vw", borderRadius: 4, border: `1px solid ${BORDER}` }}>
            <div style={{ ...DISPLAY, fontSize: "3.5vw", color: GOLD, minWidth: "6vw" }}>+15</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: TEXT }}>Personal record hit</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2vw", background: SURFACE, padding: "1.5vh 1.5vw", borderRadius: 4, border: `1px solid ${BORDER}` }}>
            <div style={{ ...DISPLAY, fontSize: "3.5vw", color: GOLD, minWidth: "6vw" }}>+50</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: TEXT }}>Achievement unlocked</div>
          </div>
        </div>

        <div style={{ height: "2.5vh" }} />
        <p style={{ ...BODY, fontSize: "1.8vw", color: MUTED, fontStyle: "italic", margin: 0 }}>
          Points buy lessons, gear, and store items.
          <br />
          8-char redemption codes + QR at the front desk.
        </p>
      </div>

      {/* Right — leaderboard */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "5vh 4vw" }}>
        <div style={{ ...LABEL, marginBottom: "2.5vh" }}>Live Leaderboard — 14U</div>

        {/* Podium */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh", marginBottom: "3vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", background: "#1A1200", border: `1px solid ${GOLD_DIM}`, borderRadius: 4, padding: "1.5vh 1.5vw" }}>
            <div style={{ ...DISPLAY, fontSize: "2.2vw", color: GOLD, minWidth: "3vw" }}>01</div>
            <div style={{ flex: 1, ...BODY, fontSize: "1.8vw", color: TEXT }}>Jordan K.</div>
            <div style={{ ...DISPLAY, fontSize: "2vw", color: GOLD }}>912 pts</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.5vw" }}>
            <div style={{ ...DISPLAY, fontSize: "2.2vw", color: MUTED, minWidth: "3vw" }}>02</div>
            <div style={{ flex: 1, ...BODY, fontSize: "1.8vw", color: TEXT }}>Tyler M.</div>
            <div style={{ ...DISPLAY, fontSize: "2vw", color: MUTED }}>876 pts</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", background: "#0F1400", border: `1px solid #2A3A00`, borderRadius: 4, padding: "1.5vh 1.5vw" }}>
            <div style={{ ...DISPLAY, fontSize: "2.2vw", color: GREEN, minWidth: "3vw" }}>03</div>
            <div style={{ flex: 1, ...BODY, fontSize: "1.8vw", color: TEXT }}>Marcus R. <span style={{ color: GOLD, fontSize: "1.4vw" }}>+2 this week</span></div>
            <div style={{ ...DISPLAY, fontSize: "2vw", color: GREEN }}>847 pts</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.5vw", opacity: 0.6 }}>
            <div style={{ ...DISPLAY, fontSize: "2.2vw", color: MUTED, minWidth: "3vw" }}>04</div>
            <div style={{ flex: 1, ...BODY, fontSize: "1.8vw", color: MUTED }}>Alex D.</div>
            <div style={{ ...DISPLAY, fontSize: "2vw", color: MUTED }}>821 pts</div>
          </div>
        </div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2vh 2vw" }}>
          <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED, fontStyle: "italic" }}>
            Kids who see their name, their rank, and a message from their coach —
            those kids open the app every day.
          </div>
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 08 — KEY DIFFERENTIATORS
══════════════════════════════════════════════════════════════ */
function Slide08({ n, total }: { n: number; total: number }) {
  const rows = [
    { label: "Built for", mindbody: "Owner & front desk", ballpark: "The athlete" },
    { label: "HitTrax / sensor data", mindbody: "None", ballpark: "Automated, 2-min lag" },
    { label: "Franchise OS", mindbody: "Per-location only", ballpark: "Multi-tenant, one view" },
    { label: "Kid engagement", mindbody: "Login screen", ballpark: "Daily reason to open" },
    { label: "Points economy", mindbody: "No", ballpark: "Full gamification loop" },
  ];

  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "5vh 6vw" }}>
      <div style={LABEL}>Part 4 — Key Differentiators</div>
      <div style={{ height: "2vh" }} />
      <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, lineHeight: 1.0 }}>
        Why not <span style={{ color: MUTED }}>MindBody</span>?
      </h2>
      <div style={{ height: "3vh" }} />

      {/* Table */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", background: SURFACE, borderRadius: "4px 4px 0 0", border: `1px solid ${BORDER}`, borderBottom: "none" }}>
          <div style={{ flex: 2, padding: "1.5vh 2vw", ...LABEL, color: MUTED }}>Capability</div>
          <div style={{ flex: 2, padding: "1.5vh 2vw", ...LABEL, color: MUTED, borderLeft: `1px solid ${BORDER}` }}>MindBody</div>
          <div style={{ flex: 2, padding: "1.5vh 2vw", ...LABEL, color: GOLD, borderLeft: `1px solid ${BORDER}` }}>Ballpark</div>
        </div>

        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              border: `1px solid ${BORDER}`,
              borderBottom: i === rows.length - 1 ? `1px solid ${BORDER}` : "none",
              background: i % 2 === 0 ? BG : SURFACE,
            }}
          >
            <div style={{ flex: 2, padding: "1.8vh 2vw", ...BODY, fontSize: "1.9vw", color: TEXT, fontWeight: 500 }}>{row.label}</div>
            <div style={{ flex: 2, padding: "1.8vh 2vw", ...BODY, fontSize: "1.9vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>{row.mindbody}</div>
            <div style={{ flex: 2, padding: "1.8vh 2vw", ...BODY, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}`, fontWeight: 500 }}>{row.ballpark}</div>
          </div>
        ))}
      </div>

      <div style={{ height: "2.5vh" }} />
      <p style={{ ...BODY, fontSize: "1.8vw", color: MUTED, fontStyle: "italic", margin: 0 }}>
        We&rsquo;re not competing for the front desk. We&rsquo;re competing for the kid&rsquo;s attention against TikTok.
      </p>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 09 — TECH STACK
══════════════════════════════════════════════════════════════ */
function Slide09({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "5vh 6vw" }}>
      <div style={LABEL}>Part 3 — The Backend</div>
      <div style={{ height: "2vh" }} />
      <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, lineHeight: 1.0 }}>
        Tech <span style={{ color: GOLD }}>Stack</span>
      </h2>
      <div style={{ height: "3vh" }} />

      {/* Stack diagram */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh", justifyContent: "center" }}>
        {/* Layer 1 — Mobile */}
        <div style={{ background: "#0F1A20", border: `1px solid #1D3A4A`, borderRadius: 6, padding: "2vh 2.5vw", display: "flex", alignItems: "center", gap: "3vw" }}>
          <div style={{ width: "18vw" }}>
            <div style={{ ...LABEL, color: "#4A9CC4", marginBottom: "0.5vh" }}>Mobile</div>
            <div style={{ ...DISPLAY, fontSize: "2.5vw", color: TEXT }}>React Native / Expo</div>
          </div>
          <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED, flex: 1 }}>
            SDK 54 · React 19 · TypeScript strict · Zustand + TanStack Query · Expo EAS for distribution
          </div>
        </div>

        {/* Arrow */}
        <div style={{ textAlign: "center", ...DISPLAY, fontSize: "2vw", color: BORDER }}>↕</div>

        {/* Layer 2 — Supabase */}
        <div style={{ background: "#0D1A0D", border: `1px solid #1D3A1D`, borderRadius: 6, padding: "2vh 2.5vw", display: "flex", alignItems: "center", gap: "3vw" }}>
          <div style={{ width: "18vw" }}>
            <div style={{ ...LABEL, color: "#3ECF8E", marginBottom: "0.5vh" }}>Data Layer</div>
            <div style={{ ...DISPLAY, fontSize: "2.5vw", color: TEXT }}>Supabase</div>
          </div>
          <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED, flex: 1 }}>
            Postgres + Auth + Realtime + Edge Functions · Row-level security on every table · pg_cron for polling · tenant_id on every record
          </div>
        </div>

        {/* Arrow */}
        <div style={{ textAlign: "center", ...DISPLAY, fontSize: "2vw", color: BORDER }}>↕</div>

        {/* Layer 3 — Integrations */}
        <div style={{ display: "flex", gap: "2vw" }}>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2vh 2vw", borderTop: `2px solid ${GOLD}` }}>
            <div style={{ ...LABEL, marginBottom: "0.5vh" }}>HitTrax</div>
            <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>Sensor data pipeline. 5 Edge Functions. 2-min polling.</div>
          </div>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2vh 2vw", borderTop: `2px solid ${GOLD}` }}>
            <div style={{ ...LABEL, marginBottom: "0.5vh" }}>Mux</div>
            <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>Video CDN + HLS transcoding. &lt;60s coach-to-parent delivery.</div>
          </div>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2vh 2vw", borderTop: `2px solid ${GOLD}` }}>
            <div style={{ ...LABEL, marginBottom: "0.5vh" }}>Stripe Connect</div>
            <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>Per-location accounts. Platform fee model. Franchise-ready.</div>
          </div>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2vh 2vw", borderTop: `2px solid ${GOLD}` }}>
            <div style={{ ...LABEL, marginBottom: "0.5vh" }}>Resend</div>
            <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>Transactional email. Coach video alerts, booking confirmations.</div>
          </div>
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 10 — MULTI-TENANT FRANCHISE OS
══════════════════════════════════════════════════════════════ */
function Slide10({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex" }}>
      {/* Left */}
      <div style={{ width: "44vw", display: "flex", flexDirection: "column", justifyContent: "center", padding: "5vh 5vw", borderRight: `1px solid ${BORDER}` }}>
        <div style={LABEL}>Architecture — Tenancy</div>
        <div style={{ height: "2vh" }} />
        <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, lineHeight: 1.0 }}>
          Multi-Tenant <span style={{ color: GOLD }}>Franchise OS</span>
        </h2>
        <div style={{ height: "3vh" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
            <div style={{ width: "2px", background: GOLD, height: "3.5vh", flexShrink: 0, marginTop: "0.3vh" }} />
            <p style={{ ...BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
              Every record in the system has a <code style={{ color: GOLD, fontFamily: "monospace" }}>tenant_id</code>. Zero data crosses tenant boundaries — enforced at the database level, not in code.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
            <div style={{ width: "2px", background: GOLD, height: "3.5vh", flexShrink: 0, marginTop: "0.3vh" }} />
            <p style={{ ...BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
              Infinite Hitting is Tenant #1. The next franchise becomes Tenant #2. Same infrastructure, different brand, different coaches, different store.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
            <div style={{ width: "2px", background: GOLD, height: "3.5vh", flexShrink: 0, marginTop: "0.3vh" }} />
            <p style={{ ...BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
              A new franchise goes live in 30 days. New revenue line with near-zero marginal cost.
            </p>
          </div>
        </div>
      </div>

      {/* Right — tenant cards */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "5vh 4vw", gap: "2vh" }}>
        <div style={{ ...LABEL, marginBottom: "0.5vh" }}>Today</div>
        <div style={{ background: "#1A1200", border: `2px solid ${GOLD}`, borderRadius: 6, padding: "2vh 2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ ...DISPLAY, fontSize: "2.5vw", color: GOLD }}>Infinite Hitting</div>
            <div style={{ ...BODY, fontSize: "1.5vw", color: MUTED }}>Tenant #1 · 400 families · 15 coaches</div>
          </div>
          <div style={{ ...DISPLAY, fontSize: "1.8vw", color: GREEN }}>LIVE</div>
        </div>

        <div style={{ ...LABEL, color: MUTED, marginTop: "1vh", marginBottom: "0.5vh" }}>Next</div>
        <div style={{ background: SURFACE, border: `1px dashed ${BORDER}`, borderRadius: 6, padding: "2vh 2vw", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7 }}>
          <div>
            <div style={{ ...DISPLAY, fontSize: "2.5vw", color: MUTED }}>XYZ Baseball Academy</div>
            <div style={{ ...BODY, fontSize: "1.5vw", color: MUTED }}>Tenant #2 · white-label build · 30 days to live</div>
          </div>
          <div style={{ ...DISPLAY, fontSize: "1.8vw", color: MUTED }}>COMING</div>
        </div>
        <div style={{ background: SURFACE, border: `1px dashed ${BORDER}`, borderRadius: 6, padding: "2vh 2vw", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.5 }}>
          <div>
            <div style={{ ...DISPLAY, fontSize: "2.5vw", color: MUTED }}>Soccer / Lacrosse / Swimming</div>
            <div style={{ ...BODY, fontSize: "1.5vw", color: MUTED }}>Multi-sport · same infrastructure · different sensor data</div>
          </div>
          <div style={{ ...DISPLAY, fontSize: "1.8vw", color: MUTED }}>ROADMAP</div>
        </div>

        <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED, fontStyle: "italic", marginTop: "1vh" }}>
          A franchisor logs in once and sees all 12 locations —
          bookings, retention, coach performance — in one view.
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 11 — JUNE PILOT PLAN
══════════════════════════════════════════════════════════════ */
function Slide11({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "5vh 6vw" }}>
      <div style={LABEL}>Part 5 — The June Pilot</div>
      <div style={{ height: "2vh" }} />
      <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, lineHeight: 1.0 }}>
        Pilot Plan — <span style={{ color: GOLD }}>One Location</span>
      </h2>
      <div style={{ height: "0.8vh" }} />
      <p style={{ ...BODY, fontSize: "1.9vw", color: MUTED, margin: 0 }}>
        One Infinite Hitting facility · 40–60 families · 4–6 coaches
      </p>
      <div style={{ height: "3vh" }} />

      {/* Timeline */}
      <div style={{ display: "flex", gap: "2vw", flex: 1 }}>
        {/* Week 1 */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2.5vh 2vw", borderTop: `3px solid ${GOLD}` }}>
          <div style={{ ...LABEL, marginBottom: "1.5vh" }}>Week 1</div>
          <div style={{ ...DISPLAY, fontSize: "2.6vw", color: TEXT, marginBottom: "1.5vh" }}>Soft Launch</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>10 families · 2 coaches</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Invite-only via email</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Front desk walkthrough</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Coach provisioning + portal setup</div>
          </div>
        </div>

        {/* Weeks 2-3 */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2.5vh 2vw", borderTop: `3px solid ${GOLD}` }}>
          <div style={{ ...LABEL, marginBottom: "1.5vh" }}>Weeks 2–3</div>
          <div style={{ ...DISPLAY, fontSize: "2.6vw", color: TEXT, marginBottom: "1.5vh" }}>Expanded Beta</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>All coaches onboarded</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>30–40 families invited</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>HitTrax pipeline active</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>First real redemptions</div>
          </div>
        </div>

        {/* Week 4 */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2.5vh 2vw", borderTop: `3px solid ${GOLD}` }}>
          <div style={{ ...LABEL, marginBottom: "1.5vh" }}>Week 4</div>
          <div style={{ ...DISPLAY, fontSize: "2.6vw", color: TEXT, marginBottom: "1.5vh" }}>Full Location</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Everyone gets access</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Push email blast</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Coach Mike demo for families</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Front desk QR scanner active</div>
          </div>
        </div>

        {/* What we own */}
        <div style={{ flex: 1, background: "#0D1A0D", border: `1px solid #1D3A1D`, borderRadius: 6, padding: "2.5vh 2vw" }}>
          <div style={{ ...LABEL, color: GREEN, marginBottom: "1.5vh" }}>We Own</div>
          <div style={{ ...DISPLAY, fontSize: "2.6vw", color: TEXT, marginBottom: "1.5vh" }}>Full Support</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Coach onboarding (10 min each)</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Family invite emails via Resend</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Week 1 live support</div>
            <div style={{ ...BODY, fontSize: "1.6vw", color: MUTED }}>Weekly data recaps to IH leadership</div>
          </div>
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 12 — PILOT SUCCESS METRICS
══════════════════════════════════════════════════════════════ */
function Slide12({ n, total }: { n: number; total: number }) {
  const metrics = [
    { metric: "Weekly app opens per kid", target: "≥ 3x", how: "Supabase analytics" },
    { metric: "Bookings via app vs. phone", target: "≥ 40%", how: "bookings.source field" },
    { metric: "Drill completion rate", target: "≥ 60%", how: "Assignment status" },
    { metric: "Coach response time", target: "< 24h", how: "coach_messages timestamps" },
    { metric: "Points redemptions in 4 weeks", target: "≥ 10", how: "orders table" },
    { metric: "Net Promoter Score (week 4)", target: "≥ 8", how: "Google Form survey" },
    { metric: "Crash rate per session", target: "< 2%", how: "Expo error tracking" },
  ];

  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "5vh 6vw" }}>
      <div style={LABEL}>Part 5 — Pilot Metrics</div>
      <div style={{ height: "2vh" }} />
      <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, lineHeight: 1.0 }}>
        What We <span style={{ color: GOLD }}>Measure</span>
      </h2>
      <div style={{ height: "2.5vh" }} />

      {/* Table */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", background: SURFACE, borderRadius: "4px 4px 0 0", border: `1px solid ${BORDER}`, borderBottom: "none" }}>
          <div style={{ flex: 3, padding: "1.3vh 2vw", ...LABEL, color: MUTED }}>Metric</div>
          <div style={{ flex: 1, padding: "1.3vh 2vw", ...LABEL, color: GOLD, borderLeft: `1px solid ${BORDER}` }}>Target</div>
          <div style={{ flex: 2, padding: "1.3vh 2vw", ...LABEL, color: MUTED, borderLeft: `1px solid ${BORDER}` }}>How We Measure</div>
        </div>

        {metrics.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              border: `1px solid ${BORDER}`,
              borderBottom: i === metrics.length - 1 ? `1px solid ${BORDER}` : "none",
              background: i % 2 === 0 ? BG : SURFACE,
            }}
          >
            <div style={{ flex: 3, padding: "1.4vh 2vw", ...BODY, fontSize: "1.75vw", color: TEXT }}>{row.metric}</div>
            <div style={{ flex: 1, padding: "1.4vh 2vw", ...DISPLAY, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}` }}>{row.target}</div>
            <div style={{ flex: 2, padding: "1.4vh 2vw", ...BODY, fontSize: "1.6vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>{row.how}</div>
          </div>
        ))}
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 13 — WHAT WE BUILD NEXT
══════════════════════════════════════════════════════════════ */
function Slide13({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "5vh 6vw" }}>
      <div style={LABEL}>Part 6 — Roadmap</div>
      <div style={{ height: "2vh" }} />
      <h2 style={{ ...DISPLAY, fontSize: "5vw", margin: 0, lineHeight: 1.0 }}>
        What We Build <span style={{ color: GOLD }}>Next</span>
      </h2>
      <div style={{ height: "3vh" }} />

      <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
        {/* Near-term */}
        <div style={{ flex: 1 }}>
          <div style={{ ...LABEL, marginBottom: "2vh" }}>Near-Term (60–90 days)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.8vh 1.8vw", borderLeft: `3px solid ${GOLD}` }}>
              <div style={{ ...BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>AI Daily Recap</div>
              <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>2-sentence SMS/push every morning. Marcus&rsquo;s rank, pending drill, coach note. Zero coach time.</div>
            </div>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.8vh 1.8vw", borderLeft: `3px solid ${GOLD}` }}>
              <div style={{ ...BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>Coach Mobile App</div>
              <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>Send messages, review drills, mark sessions complete from the cage. No laptop required.</div>
            </div>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.8vh 1.8vw", borderLeft: `3px solid ${GOLD}` }}>
              <div style={{ ...BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>Multi-Kid Families</div>
              <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>One parent account, multiple siblings. Each kid gets their own profile and leaderboard position.</div>
            </div>
          </div>
        </div>

        {/* Medium-term */}
        <div style={{ flex: 1 }}>
          <div style={{ ...LABEL, marginBottom: "2vh" }}>Medium-Term (3–6 months)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.8vh 1.8vw", borderLeft: `3px solid ${GOLD_DIM}` }}>
              <div style={{ ...BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>Franchisor Portal</div>
              <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>Owner of 12 locations logs in once. Engagement, retention, coach performance — all in one view.</div>
            </div>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.8vh 1.8vw", borderLeft: `3px solid ${GOLD_DIM}` }}>
              <div style={{ ...BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>White-Label Builds</div>
              <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>&ldquo;XYZ Baseball Academy&rdquo; app — different name, different colors, same infrastructure. Each franchise is a new revenue line.</div>
            </div>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.8vh 1.8vw", borderLeft: `3px solid ${GOLD_DIM}` }}>
              <div style={{ ...BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>Cross-Location Leaderboard</div>
              <div style={{ ...BODY, fontSize: "1.55vw", color: MUTED }}>Top 10 in the state. Regional competitions. More locations on the platform — more compelling the leaderboard.</div>
            </div>
          </div>
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 14 — THE ASK
══════════════════════════════════════════════════════════════ */
function Slide14({ n, total }: { n: number; total: number }) {
  return (
    <div style={{ ...SLIDE_ROOT, display: "flex", flexDirection: "column", padding: "5vh 6vw" }}>
      <div style={LABEL}>Part 7 — The Ask</div>
      <div style={{ height: "2vh" }} />
      <h2 style={{ ...DISPLAY, fontSize: "5.5vw", margin: 0, lineHeight: 1.0 }}>
        The <span style={{ color: GOLD }}>Ask</span>
      </h2>
      <div style={{ height: "3vh" }} />
      <GoldLine />
      <div style={{ height: "3vh" }} />

      <div style={{ display: "flex", gap: "2.5vw", flex: 1 }}>
        {/* Investors */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", display: "flex", flexDirection: "column" }}>
          <div style={{ ...LABEL, color: "#4A9CC4", marginBottom: "2vh" }}>Investors</div>
          <div style={{ ...DISPLAY, fontSize: "2.8vw", color: TEXT, marginBottom: "2vh", lineHeight: 1.1 }}>Raise to scale</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh", flex: 1 }}>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Anchor customer live. Pilot in June.</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Technology deployed.</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Hire first full-time engineer.</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Scale to 5 franchise locations.</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Fund EAS production builds + full HitTrax partnership.</div>
          </div>
          <div style={{ height: "2vh" }} />
          <div style={{ ...BODY, fontSize: "1.6vw", color: "#4A9CC4", fontStyle: "italic" }}>
            The data moat deepens every session.
          </div>
        </div>

        {/* Franchise partners */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", display: "flex", flexDirection: "column" }}>
          <div style={{ ...LABEL, color: GOLD, marginBottom: "2vh" }}>Franchise Partners (IH)</div>
          <div style={{ ...DISPLAY, fontSize: "2.8vw", color: TEXT, marginBottom: "2vh", lineHeight: 1.1 }}>Run the June pilot</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh", flex: 1 }}>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>We handle everything — onboarding, tech support, data recaps.</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Tell us if coaches like it and families open it.</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>If 3+ opens/kid/week and 40%+ app bookings hold—</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: TEXT, fontWeight: 500 }}>We expand to your next location in August.</div>
          </div>
          <div style={{ height: "2vh" }} />
          <div style={{ ...BODY, fontSize: "1.6vw", color: GOLD, fontStyle: "italic" }}>
            Zero cost to pilot. Full support included.
          </div>
        </div>

        {/* New franchise tenants */}
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", display: "flex", flexDirection: "column" }}>
          <div style={{ ...LABEL, color: GREEN, marginBottom: "2vh" }}>New Franchise Tenants</div>
          <div style={{ ...DISPLAY, fontSize: "2.8vw", color: TEXT, marginBottom: "2vh", lineHeight: 1.1 }}>Live in 30 days</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh", flex: 1 }}>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Booking, messaging, gamification, HitTrax (or equivalent).</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Under your brand, in your app.</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: MUTED }}>Already built. You don&rsquo;t pay for the build.</div>
            <div style={{ ...BODY, fontSize: "1.7vw", color: TEXT, fontWeight: 500 }}>Platform fee on transactions + per-active-family monthly.</div>
          </div>
          <div style={{ height: "2vh" }} />
          <div style={{ ...BODY, fontSize: "1.6vw", color: GREEN, fontStyle: "italic" }}>
            Soccer. Lacrosse. Swimming. Same infrastructure.
          </div>
        </div>
      </div>

      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SLIDE 15 — CLOSING / THE FLYWHEEL
══════════════════════════════════════════════════════════════ */
function Slide15({ n, total }: { n: number; total: number }) {
  return (
    <div
      style={{
        ...SLIDE_ROOT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, #1A1400 0%, #0C0C0C 70%)",
        textAlign: "center",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />

      <BallparkWordmark size="1.6vw" />
      <div style={{ height: "4vh" }} />

      <div style={{ ...LABEL, marginBottom: "2vh" }}>The Flywheel</div>

      {/* Flywheel chain */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", marginBottom: "4vh" }}>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ ...DISPLAY, fontSize: "2vw", color: GOLD }}>More kids</div>
        </div>
        <div style={{ ...DISPLAY, fontSize: "2.5vw", color: GOLD_DIM }}>→</div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ ...DISPLAY, fontSize: "2vw", color: GOLD }}>Richer leaderboard</div>
        </div>
        <div style={{ ...DISPLAY, fontSize: "2.5vw", color: GOLD_DIM }}>→</div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ ...DISPLAY, fontSize: "2vw", color: GOLD }}>More engagement</div>
        </div>
        <div style={{ ...DISPLAY, fontSize: "2.5vw", color: GOLD_DIM }}>→</div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ ...DISPLAY, fontSize: "2vw", color: GOLD }}>Less churn</div>
        </div>
        <div style={{ ...DISPLAY, fontSize: "2.5vw", color: GOLD_DIM }}>→</div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ ...DISPLAY, fontSize: "2vw", color: GOLD }}>More locations</div>
        </div>
      </div>

      <div style={{ ...DISPLAY, fontSize: "6vw", color: TEXT, lineHeight: 1.05, maxWidth: "65vw" }}>
        The operating system
        <br />
        for youth sports.
      </div>

      <div style={{ height: "4vh" }} />
      <GoldLine style={{ width: "20vw", margin: "0 auto" }} />
      <div style={{ height: "3vh" }} />

      <p style={{ ...BODY, fontSize: "2vw", color: MUTED, margin: 0 }}>
        Anchor customer live. Pilot in June. Technology deployed.
      </p>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />
      <SlideCounter current={n} total={total} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const SLIDES = [
  { id: 1, label: "Title" },
  { id: 2, label: "The Problem" },
  { id: 3, label: "Meet Marcus Rivera" },
  { id: 4, label: "HitTrax Auto-Import" },
  { id: 5, label: "Video Messaging" },
  { id: 6, label: "Drill Assignments" },
  { id: 7, label: "Gamification Engine" },
  { id: 8, label: "Key Differentiators" },
  { id: 9, label: "Tech Stack" },
  { id: 10, label: "Multi-Tenant Franchise OS" },
  { id: 11, label: "June Pilot Plan" },
  { id: 12, label: "Pilot Success Metrics" },
  { id: 13, label: "What We Build Next" },
  { id: 14, label: "The Ask" },
  { id: 15, label: "The Flywheel" },
];

export function PitchDeck() {
  useGoogleFonts();
  const [current, setCurrent] = useState(0);
  const total = SLIDES.length;

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(total - 1, c + 1)), [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const slideProps = { n: current + 1, total };

  return (
    <div style={{ width: "100vw", height: "100vh", background: BG, position: "relative", overflow: "hidden" }}>
      {/* Slide content */}
      {current === 0 && <Slide01 />}
      {current === 1 && <Slide02 {...slideProps} />}
      {current === 2 && <Slide03 {...slideProps} />}
      {current === 3 && <Slide04 {...slideProps} />}
      {current === 4 && <Slide05 {...slideProps} />}
      {current === 5 && <Slide06 {...slideProps} />}
      {current === 6 && <Slide07 {...slideProps} />}
      {current === 7 && <Slide08 {...slideProps} />}
      {current === 8 && <Slide09 {...slideProps} />}
      {current === 9 && <Slide10 {...slideProps} />}
      {current === 10 && <Slide11 {...slideProps} />}
      {current === 11 && <Slide12 {...slideProps} />}
      {current === 12 && <Slide13 {...slideProps} />}
      {current === 13 && <Slide14 {...slideProps} />}
      {current === 14 && <Slide15 {...slideProps} />}

      {/* Navigation arrows */}
      {current > 0 && (
        <button
          onClick={prev}
          style={{
            position: "absolute",
            left: "1.5vw",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(20,20,20,0.85)",
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            color: GOLD,
            width: "3.5vw",
            height: "6vh",
            cursor: "pointer",
            fontSize: "1.8vw",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          ‹
        </button>
      )}
      {current < total - 1 && (
        <button
          onClick={next}
          style={{
            position: "absolute",
            right: "1.5vw",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(20,20,20,0.85)",
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            color: GOLD,
            width: "3.5vw",
            height: "6vh",
            cursor: "pointer",
            fontSize: "1.8vw",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          ›
        </button>
      )}

      {/* Slide nav dots */}
      <div
        style={{
          position: "absolute",
          bottom: "2vh",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "0.6vw",
          zIndex: 100,
        }}
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrent(i)}
            title={s.label}
            style={{
              width: i === current ? "2.5vw" : "0.5vw",
              height: "0.5vh",
              borderRadius: 2,
              background: i === current ? GOLD : DIM,
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "width 0.2s, background 0.2s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default PitchDeck;
