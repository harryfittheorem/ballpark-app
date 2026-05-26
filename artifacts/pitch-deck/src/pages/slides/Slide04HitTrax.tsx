const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const GREEN = "#27ae60";

export default function Slide04HitTrax() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        background: "#0c0c0c",
        display: "flex",
        fontFamily: BODY,
        color: TEXT,
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "6vh 5vw" }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2vh" }}>
          Feature 01 — Performance Data
        </div>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5.5vw", margin: 0, color: TEXT, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "2.5vh" }}>
          HitTrax
        </h2>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5.5vw", margin: 0, color: GOLD, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "2.5vh" }}>
          Auto-Import
        </h2>
        <div style={{ height: "1px", background: `linear-gradient(to right, ${GOLD}, transparent)`, opacity: 0.5, width: "6vw", marginBottom: "2.5vh" }} />
        <p style={{ fontFamily: BODY, fontSize: "2vw", color: MUTED, margin: 0, lineHeight: 1.6, marginBottom: "2.5vh" }}>
          A Supabase Edge Function polls HitTrax every 2 minutes and upserts each session automatically.
        </p>
        <p style={{ fontFamily: BODY, fontSize: "2vw", color: MUTED, margin: 0, fontStyle: "italic", lineHeight: 1.5 }}>
          No coach data entry. No parent upload. It just appears.
        </p>
      </div>

      <div style={{ width: "44vw", display: "flex", flexDirection: "column", justifyContent: "center", padding: "6vh 4vw", gap: "2vh" }}>
        <div style={{ display: "flex", gap: "2vw" }}>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 4, padding: "2.5vh 2vw" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "5.5vw", color: GOLD, fontWeight: 900 }}>47</div>
            <div style={{ fontFamily: BODY, fontSize: "1.5vw", color: MUTED }}>swings today</div>
          </div>
          <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 4, padding: "2.5vh 2vw" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "5.5vw", color: GOLD, fontWeight: 900 }}>88.4</div>
            <div style={{ fontFamily: BODY, fontSize: "1.5vw", color: MUTED }}>mph avg exit velo</div>
          </div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 4, padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "5vw", color: GOLD, fontWeight: 900 }}>2 min</div>
          <div style={{ fontFamily: BODY, fontSize: "1.5vw", color: MUTED }}>data appears after leaving the cage</div>
        </div>
        <div style={{ background: "#0e1a0e", border: `1px solid #1d3a1d`, borderRadius: 4, padding: "2vh 2vw" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GREEN, textTransform: "uppercase", marginBottom: "1vh" }}>Pipeline</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: TEXT, marginBottom: "0.6vh" }}>pg_cron fires hittrax-poll every 2 minutes</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: TEXT, marginBottom: "0.6vh" }}>Sessions upserted, personal bests computed server-side</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: TEXT }}>Per-swing data available in-app immediately</div>
        </div>
        <div style={{ fontFamily: BODY, fontSize: "1.5vw", color: MUTED, fontStyle: "italic" }}>
          No competitor has automated this. The data is the hook.
        </div>
      </div>
    </div>
  );
}
