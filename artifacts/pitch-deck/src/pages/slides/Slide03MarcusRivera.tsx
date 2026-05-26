const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const BORDER = "#272727";

export default function Slide03MarcusRivera() {
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
      <div
        style={{
          width: "42vw",
          background: "linear-gradient(160deg, #1a1200 0%, #0c0c0c 100%)",
          borderRight: `1px solid ${BORDER}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "6vh 4vw",
        }}
      >
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2.5vh" }}>
          Part 2 — The Product
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "9vw", color: GOLD, lineHeight: 1, letterSpacing: "-0.01em" }}>847</div>
        <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: MUTED, marginBottom: "2vh" }}>points</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "3.5vw", color: TEXT, lineHeight: 1.1 }}>#3 in 14U</div>
        <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "3vh" }}>Infinite Hitting</div>
        <div style={{ height: "1px", background: `linear-gradient(to right, ${GOLD}, transparent)`, opacity: 0.5, width: "8vw", marginBottom: "2.5vh" }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.4vw", color: TEXT, lineHeight: 1.3 }}>Marcus Rivera, 14U.</div>
        <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: MUTED, marginTop: "1vh", fontStyle: "italic", lineHeight: 1.5 }}>
          One athlete. One day.
        </div>
        <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: MUTED, fontStyle: "italic", lineHeight: 1.5 }}>
          Six capabilities.
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "6vh 4.5vw" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.8vw", color: TEXT, marginBottom: "2.5vh", lineHeight: 1.1 }}>
          What Marcus sees when he opens the app
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.8vw", color: GOLD, fontWeight: 700, flexShrink: 0, minWidth: "2.5vw" }}>01</div>
            <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: TEXT, lineHeight: 1.4 }}>HitTrax auto-import — session data 2 min after leaving the cage</div>
          </div>
          <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.8vw", color: GOLD, fontWeight: 700, flexShrink: 0, minWidth: "2.5vw" }}>02</div>
            <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: TEXT, lineHeight: 1.4 }}>Two-way video messaging — coach sends breakdowns, family replies</div>
          </div>
          <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.8vw", color: GOLD, fontWeight: 700, flexShrink: 0, minWidth: "2.5vw" }}>03</div>
            <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: TEXT, lineHeight: 1.4 }}>Drill assignments — homework with points, coach reviews 1–5 stars</div>
          </div>
          <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.8vw", color: GOLD, fontWeight: 700, flexShrink: 0, minWidth: "2.5vw" }}>04</div>
            <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: TEXT, lineHeight: 1.4 }}>Gamification engine — points, leaderboard, redemption codes</div>
          </div>
          <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.8vw", color: GOLD, fontWeight: 700, flexShrink: 0, minWidth: "2.5vw" }}>05</div>
            <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: TEXT, lineHeight: 1.4 }}>Booking — filter, pick, confirm in under 20 seconds</div>
          </div>
          <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.8vw", color: GOLD, fontWeight: 700, flexShrink: 0, minWidth: "2.5vw" }}>06</div>
            <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: TEXT, lineHeight: 1.4 }}>Profile — PRs grid, achievements catalog, order history</div>
          </div>
        </div>
      </div>
    </div>
  );
}
