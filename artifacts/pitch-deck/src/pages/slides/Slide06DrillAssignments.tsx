const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const GREEN = "#27ae60";

export default function Slide06DrillAssignments() {
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
        Feature 03 — Coaching Loop
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "1vh" }}>
        Drill Assignments
      </h2>
      <p style={{ fontFamily: BODY, fontSize: "2vw", color: MUTED, margin: "0 0 3vh 0" }}>
        Retention infrastructure. The coaching loop closes between sessions.
      </p>

      <div style={{ display: "flex", gap: "2.5vw", flex: 1, alignItems: "stretch" }}>
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2.5vh 2vw", position: "relative" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "6vw", color: "#3a3a3a", fontWeight: 900, position: "absolute", top: "2vh", right: "2vw", lineHeight: 1 }}>01</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "1.5vh" }}>
            Coach Assigns
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.4vw", color: TEXT, marginBottom: "1.5vh" }}>Hip rotation progression</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Title, description, and drill video</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Due date — Thursday</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Duration — 15 minutes</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: GOLD, fontWeight: 600 }}>+25 pts on completion</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", color: GOLD }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "2.5vw", fontWeight: 900 }}>{"→"}</div>
        </div>

        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2.5vh 2vw", position: "relative" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "6vw", color: "#3a3a3a", fontWeight: 900, position: "absolute", top: "2vh", right: "2vw", lineHeight: 1 }}>02</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "1.5vh" }}>
            Family Submits
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.4vw", color: TEXT, marginBottom: "1.5vh" }}>Mark as done</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Views assignment detail and drill video</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Taps &ldquo;Mark as done&rdquo;</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Coach notified via push</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: GOLD, fontWeight: 600 }}>Points held pending review</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", color: GOLD }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "2.5vw", fontWeight: 900 }}>{"→"}</div>
        </div>

        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "2.5vh 2vw", position: "relative" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "6vw", color: "#3a3a3a", fontWeight: 900, position: "absolute", top: "2vh", right: "2vw", lineHeight: 1 }}>03</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "1.5vh" }}>
            Coach Reviews
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.4vw", color: TEXT, marginBottom: "1.5vh" }}>1–5 star rating</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Reviews from portal queue</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Writes text feedback</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Family notified by email and push</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: GREEN, fontWeight: 600 }}>+25 pts credited immediately</div>
        </div>
      </div>
    </div>
  );
}
