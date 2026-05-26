const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const BG = "#0c0c0c";

export default function Slide08Differentiators() {
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
        Part 4 — Key Differentiators
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "3vh" }}>
        Why not{" "}
        <span style={{ color: MUTED }}>MindBody</span>?
      </h2>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", background: SURFACE, borderRadius: "4px 4px 0 0", border: `1px solid ${BORDER}`, borderBottom: "none" }}>
          <div style={{ flex: 2, padding: "1.5vh 2vw", fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: MUTED, textTransform: "uppercase" }}>Capability</div>
          <div style={{ flex: 2, padding: "1.5vh 2vw", fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: MUTED, textTransform: "uppercase", borderLeft: `1px solid ${BORDER}` }}>MindBody</div>
          <div style={{ flex: 2, padding: "1.5vh 2vw", fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", borderLeft: `1px solid ${BORDER}` }}>Ballpark</div>
        </div>

        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: BG }}>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: TEXT, fontWeight: 500 }}>Built for</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>Owner and front desk</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}`, fontWeight: 500 }}>The athlete</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: SURFACE }}>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: TEXT, fontWeight: 500 }}>HitTrax / sensor data</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>None</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}`, fontWeight: 500 }}>Automated, 2-min lag</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: BG }}>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: TEXT, fontWeight: 500 }}>Franchise OS</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>Per-location only</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}`, fontWeight: 500 }}>Multi-tenant, one view</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderBottom: "none", background: SURFACE }}>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: TEXT, fontWeight: 500 }}>Kid engagement</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>Login screen</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}`, fontWeight: 500 }}>Daily reason to open</div>
        </div>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, background: BG }}>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: TEXT, fontWeight: 500 }}>Points economy</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: MUTED, borderLeft: `1px solid ${BORDER}` }}>No</div>
          <div style={{ flex: 2, padding: "1.8vh 2vw", fontFamily: BODY, fontSize: "1.9vw", color: GOLD, borderLeft: `1px solid ${BORDER}`, fontWeight: 500 }}>Full gamification loop</div>
        </div>
      </div>

      <p style={{ fontFamily: BODY, fontSize: "1.8vw", color: MUTED, fontStyle: "italic", margin: "2.5vh 0 0 0" }}>
        We&rsquo;re not competing for the front desk. We&rsquo;re competing for the kid&rsquo;s attention against TikTok.
      </p>
    </div>
  );
}
