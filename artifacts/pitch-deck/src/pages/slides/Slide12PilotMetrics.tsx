const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const BG = "#0c0c0c";

export default function Slide12PilotMetrics() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        background: BG,
        display: "flex",
        flexDirection: "column",
        padding: "5vh 6vw",
        fontFamily: BODY,
        color: TEXT,
      }}
    >
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2vh" }}>
        Part 5 — Pilot Metrics
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "2.5vh" }}>
        What We{" "}
        <span style={{ color: GOLD }}>Measure</span>
      </h2>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", background: SURFACE, borderRadius: "4px 4px 0 0", border: `1px solid ${BORDER}`, borderBottom: "none" }}>
          <div style={{ flex: 3, padding: "1.3vh 2vw", fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: MUTED, textTransform: "uppercase" }}>Metric</div>
          <div style={{ flex: 1, padding: "1.3vh 2vw", fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", borderLeft: `1px solid ${BORDER}` }}>Target</div>
          <div style={{ flex: 2, padding: "1.3vh 2vw", fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: MUTED, textTransform: "uppercase", borderLeft: `1px solid ${BORDER}` }}>How We Measure</div>
        </div>

        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: BG }}>
          <div style={{ flex: 3, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.75vw", color: TEXT }}>Weekly app opens per kid</div>
          <div style={{ flex: 1, padding: "1.4vh 2vw", fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}` }}>&#8805; 3x</div>
          <div style={{ flex: 2, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.6vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>Supabase analytics</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: SURFACE }}>
          <div style={{ flex: 3, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.75vw", color: TEXT }}>Bookings via app vs. phone</div>
          <div style={{ flex: 1, padding: "1.4vh 2vw", fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}` }}>&#8805; 40%</div>
          <div style={{ flex: 2, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.6vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>bookings.source field</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: BG }}>
          <div style={{ flex: 3, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.75vw", color: TEXT }}>Drill completion rate</div>
          <div style={{ flex: 1, padding: "1.4vh 2vw", fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}` }}>&#8805; 60%</div>
          <div style={{ flex: 2, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.6vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>Assignment status</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: SURFACE }}>
          <div style={{ flex: 3, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.75vw", color: TEXT }}>Coach response time</div>
          <div style={{ flex: 1, padding: "1.4vh 2vw", fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}` }}>&lt; 24h</div>
          <div style={{ flex: 2, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.6vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>coach_messages timestamps</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: BG }}>
          <div style={{ flex: 3, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.75vw", color: TEXT }}>Points redemptions in 4 weeks</div>
          <div style={{ flex: 1, padding: "1.4vh 2vw", fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}` }}>&#8805; 10</div>
          <div style={{ flex: 2, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.6vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>orders table</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: SURFACE }}>
          <div style={{ flex: 3, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.75vw", color: TEXT }}>Net Promoter Score at week 4</div>
          <div style={{ flex: 1, padding: "1.4vh 2vw", fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}` }}>&#8805; 8</div>
          <div style={{ flex: 2, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.6vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>Google Form survey</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, background: BG }}>
          <div style={{ flex: 3, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.75vw", color: TEXT }}>Crash rate per session</div>
          <div style={{ flex: 1, padding: "1.4vh 2vw", fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}` }}>&lt; 2%</div>
          <div style={{ flex: 2, padding: "1.4vh 2vw", fontFamily: BODY, fontSize: "1.6vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>Expo error tracking</div>
        </div>
      </div>
    </div>
  );
}
