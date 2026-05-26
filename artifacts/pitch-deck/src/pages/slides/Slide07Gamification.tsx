const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const GREEN = "#27ae60";

export default function Slide07Gamification() {
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
      <div style={{ width: "45vw", display: "flex", flexDirection: "column", justifyContent: "center", padding: "5vh 5vw", borderRight: `1px solid ${BORDER}` }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2vh" }}>
          Feature 04 — Points Economy
        </div>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: "0 0 3vh 0", lineHeight: 1.0, letterSpacing: "-0.01em" }}>
          Gamification{" "}
          <span style={{ color: GOLD }}>Engine</span>
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2vw", background: SURFACE, padding: "1.5vh 1.5vw", borderRadius: 4, border: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "3.5vw", fontWeight: 900, color: GOLD, minWidth: "6vw" }}>+10</div>
            <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: TEXT }}>Session attended</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2vw", background: SURFACE, padding: "1.5vh 1.5vw", borderRadius: 4, border: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "3.5vw", fontWeight: 900, color: GOLD, minWidth: "6vw" }}>+25</div>
            <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: TEXT }}>Drill completed</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2vw", background: SURFACE, padding: "1.5vh 1.5vw", borderRadius: 4, border: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "3.5vw", fontWeight: 900, color: GOLD, minWidth: "6vw" }}>+15</div>
            <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: TEXT }}>Personal record hit</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2vw", background: SURFACE, padding: "1.5vh 1.5vw", borderRadius: 4, border: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "3.5vw", fontWeight: 900, color: GOLD, minWidth: "6vw" }}>+50</div>
            <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: TEXT }}>Achievement unlocked</div>
          </div>
        </div>

        <p style={{ fontFamily: BODY, fontSize: "1.8vw", color: MUTED, fontStyle: "italic", margin: "2.5vh 0 0 0" }}>
          Points buy lessons, gear, and store items. 8-char redemption codes and QR at the front desk.
        </p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "5vh 4vw" }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2.5vh" }}>
          Live Leaderboard — 14U
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh", marginBottom: "3vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", background: "#1a1200", border: `1px solid #9a7020`, borderRadius: 4, padding: "1.5vh 1.5vw" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "2.2vw", fontWeight: 900, color: GOLD, minWidth: "3vw" }}>01</div>
            <div style={{ flex: 1, fontFamily: BODY, fontSize: "1.8vw", color: TEXT }}>Jordan K.</div>
            <div style={{ fontFamily: DISPLAY, fontSize: "2vw", fontWeight: 900, color: GOLD }}>912 pts</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.5vw" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "2.2vw", fontWeight: 900, color: MUTED, minWidth: "3vw" }}>02</div>
            <div style={{ flex: 1, fontFamily: BODY, fontSize: "1.8vw", color: TEXT }}>Tyler M.</div>
            <div style={{ fontFamily: DISPLAY, fontSize: "2vw", fontWeight: 900, color: MUTED }}>876 pts</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", background: "#0f1400", border: `1px solid #2a3a00`, borderRadius: 4, padding: "1.5vh 1.5vw" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "2.2vw", fontWeight: 900, color: GREEN, minWidth: "3vw" }}>03</div>
            <div style={{ flex: 1, fontFamily: BODY, fontSize: "1.8vw", color: TEXT }}>
              Marcus R.{" "}
              <span style={{ color: GOLD, fontSize: "1.5vw" }}>+2 this week</span>
            </div>
            <div style={{ fontFamily: DISPLAY, fontSize: "2vw", fontWeight: 900, color: GREEN }}>847 pts</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "1.5vh 1.5vw", opacity: 0.5 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "2.2vw", fontWeight: 900, color: MUTED, minWidth: "3vw" }}>04</div>
            <div style={{ flex: 1, fontFamily: BODY, fontSize: "1.8vw", color: MUTED }}>Alex D.</div>
            <div style={{ fontFamily: DISPLAY, fontSize: "2vw", fontWeight: 900, color: MUTED }}>821 pts</div>
          </div>
        </div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2vh 2vw" }}>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, fontStyle: "italic" }}>
            Kids who see their name, their rank, and a message from their coach open the app every day.
          </div>
        </div>
      </div>
    </div>
  );
}
