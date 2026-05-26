const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const GOLD_DIM = "#9a7020";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";

export default function Slide13Roadmap() {
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
        Part 6 — Roadmap
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "3vh" }}>
        What We Build{" "}
        <span style={{ color: GOLD }}>Next</span>
      </h2>

      <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "0.5vh" }}>Near-Term (60–90 days)</div>

          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 4, padding: "1.8vh 1.8vw" }}>
            <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>AI Daily Recap</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>2-sentence SMS or push every morning. Marcus&rsquo;s rank, pending drill, coach note. Zero coach time.</div>
          </div>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 4, padding: "1.8vh 1.8vw" }}>
            <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>Coach Mobile App</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>Send messages, review drills, mark sessions complete from the cage. No laptop required.</div>
          </div>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 4, padding: "1.8vh 1.8vw" }}>
            <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>Multi-Kid Families</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>One parent account, multiple siblings. Each kid gets their own profile and leaderboard position.</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD_DIM, textTransform: "uppercase", marginBottom: "0.5vh" }}>Medium-Term (3–6 months)</div>

          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD_DIM}`, borderRadius: 4, padding: "1.8vh 1.8vw" }}>
            <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>Franchisor Portal</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>Owner of 12 locations logs in once. Engagement, retention, coach performance — all in one view.</div>
          </div>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD_DIM}`, borderRadius: 4, padding: "1.8vh 1.8vw" }}>
            <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>White-Label Builds</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>&ldquo;XYZ Baseball Academy&rdquo; app. Different name, different colors, same infrastructure. Each franchise is a new revenue line.</div>
          </div>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${GOLD_DIM}`, borderRadius: 4, padding: "1.8vh 1.8vw" }}>
            <div style={{ fontFamily: BODY, fontSize: "1.8vw", color: TEXT, fontWeight: 600, marginBottom: "0.5vh" }}>Cross-Location Leaderboard</div>
            <div style={{ fontFamily: BODY, fontSize: "1.55vw", color: MUTED }}>Top 10 in the state. Regional competitions. More locations on the platform means more compelling the leaderboard.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
