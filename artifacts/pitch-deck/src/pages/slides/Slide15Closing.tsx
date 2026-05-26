const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const GOLD_DIM = "#9a7020";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";

export default function Slide15Closing() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, #1a1400 0%, #0c0c0c 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: BODY,
        color: TEXT,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />

      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.6vw", letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase", marginBottom: "4vh" }}>
        BALLPARK
      </div>

      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: MUTED, textTransform: "uppercase", marginBottom: "2vh" }}>
        The Flywheel
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", marginBottom: "4vh" }}>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2vw", color: GOLD }}>More kids</div>
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: "2.5vw", fontWeight: 900, color: GOLD_DIM }}>&#8594;</div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2vw", color: GOLD }}>Richer leaderboard</div>
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: "2.5vw", fontWeight: 900, color: GOLD_DIM }}>&#8594;</div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2vw", color: GOLD }}>More engagement</div>
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: "2.5vw", fontWeight: 900, color: GOLD_DIM }}>&#8594;</div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2vw", color: GOLD }}>Less churn</div>
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: "2.5vw", fontWeight: 900, color: GOLD_DIM }}>&#8594;</div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.8vw" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2vw", color: GOLD }}>More locations</div>
        </div>
      </div>

      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "6vw", color: TEXT, lineHeight: 1.05, maxWidth: "65vw", letterSpacing: "-0.01em" }}>
        The operating system
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "6vw", color: TEXT, lineHeight: 1.05, maxWidth: "65vw", letterSpacing: "-0.01em", marginBottom: "4vh" }}>
        for youth sports.
      </div>

      <div style={{ height: "1px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`, opacity: 0.5, width: "20vw", marginBottom: "3vh" }} />

      <p style={{ fontFamily: BODY, fontSize: "2vw", color: MUTED, margin: 0 }}>
        Anchor customer live. Pilot in June. Technology deployed.
      </p>
    </div>
  );
}
