const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";

export default function Slide09TechStack() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        background: "#0c0c0c",
        display: "flex",
        flexDirection: "column",
        padding: "5vh 6vw",
        fontFamily: BODY,
        color: TEXT,
      }}
    >
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2vh" }}>
        Part 3 — The Backend
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "3vh" }}>
        Tech{" "}
        <span style={{ color: GOLD }}>Stack</span>
      </h2>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh", justifyContent: "center" }}>
        <div style={{ background: "#0f1a20", border: `1px solid #1d3a4a`, borderRadius: 6, padding: "2vh 2.5vw", display: "flex", alignItems: "center", gap: "3vw" }}>
          <div style={{ width: "18vw" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: "#4a9cc4", textTransform: "uppercase", marginBottom: "0.5vh" }}>Mobile</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.5vw", color: TEXT }}>React Native / Expo</div>
          </div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, flex: 1 }}>
            SDK 54 · React 19 · TypeScript strict · Zustand + TanStack Query · Expo EAS for distribution
          </div>
        </div>

        <div style={{ textAlign: "center", fontFamily: DISPLAY, fontSize: "2vw", fontWeight: 900, color: BORDER }}>&#8597;</div>

        <div style={{ background: "#0d1a0d", border: `1px solid #1d3a1d`, borderRadius: 6, padding: "2vh 2.5vw", display: "flex", alignItems: "center", gap: "3vw" }}>
          <div style={{ width: "18vw" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: "#3ecf8e", textTransform: "uppercase", marginBottom: "0.5vh" }}>Data Layer</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.5vw", color: TEXT }}>Supabase</div>
          </div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, flex: 1 }}>
            Postgres + Auth + Realtime + Edge Functions · Row-level security on every table · pg_cron for polling · tenant_id on every record
          </div>
        </div>

        <div style={{ textAlign: "center", fontFamily: DISPLAY, fontSize: "2vw", fontWeight: 900, color: BORDER }}>&#8597;</div>

        <div style={{ display: "flex", gap: "2vw" }}>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `2px solid ${GOLD}`, borderRadius: 6, padding: "2vh 2vw" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "0.5vh" }}>HitTrax</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>Sensor data pipeline. 5 Edge Functions. 2-min polling via pg_cron.</div>
          </div>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `2px solid ${GOLD}`, borderRadius: 6, padding: "2vh 2vw" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "0.5vh" }}>Mux</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>Video CDN and HLS transcoding. Under 60s coach-to-parent delivery.</div>
          </div>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `2px solid ${GOLD}`, borderRadius: 6, padding: "2vh 2vw" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "0.5vh" }}>Stripe Connect</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>Per-location accounts. Platform fee model. Franchise-ready.</div>
          </div>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `2px solid ${GOLD}`, borderRadius: 6, padding: "2vh 2vw" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "0.5vh" }}>Resend</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>Transactional email. Coach video alerts, booking confirmations.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
