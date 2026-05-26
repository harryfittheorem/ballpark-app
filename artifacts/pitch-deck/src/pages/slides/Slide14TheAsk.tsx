const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const GREEN = "#27ae60";

export default function Slide14TheAsk() {
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
        Part 7 — The Ask
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5.5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "3vh" }}>
        The{" "}
        <span style={{ color: GOLD }}>Ask</span>
      </h2>

      <div style={{ height: "1px", background: `linear-gradient(to right, ${GOLD}, transparent)`, opacity: 0.4, marginBottom: "3vh" }} />

      <div style={{ display: "flex", gap: "2.5vw", flex: 1, alignItems: "stretch" }}>
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: "#4a9cc4", textTransform: "uppercase", marginBottom: "2vh" }}>Investors</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.8vw", color: TEXT, marginBottom: "2vh", lineHeight: 1.1 }}>Raise to scale</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Anchor customer live. Pilot in June.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Technology deployed.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Hire first full-time engineer.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Scale to 5 franchise locations.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED }}>EAS production builds and full HitTrax partnership.</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: "#4a9cc4", fontStyle: "italic", marginTop: "2vh" }}>
            The data moat deepens every session.
          </div>
        </div>

        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2vh" }}>Franchise Partners (IH)</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.8vw", color: TEXT, marginBottom: "2vh", lineHeight: 1.1 }}>Run the June pilot</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>We handle everything — onboarding, tech support, data recaps.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Tell us if coaches like it and families open it.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: TEXT, fontWeight: 500, marginBottom: "0.8vh" }}>If 3+ opens/kid/week and 40%+ app bookings hold —</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: TEXT, fontWeight: 500 }}>We expand to your next location in August.</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: GOLD, fontStyle: "italic", marginTop: "2vh" }}>
            Zero cost to pilot. Full support included.
          </div>
        </div>

        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3vh 2.5vw", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GREEN, textTransform: "uppercase", marginBottom: "2vh" }}>New Franchise Tenants</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.8vw", color: TEXT, marginBottom: "2vh", lineHeight: 1.1 }}>Live in 30 days</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Booking, messaging, gamification, HitTrax or equivalent.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Under your brand, in your app.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: MUTED, marginBottom: "0.8vh" }}>Already built. You don&rsquo;t pay for the build.</div>
          <div style={{ fontFamily: BODY, fontSize: "1.7vw", color: TEXT, fontWeight: 500 }}>Platform fee on transactions + per-active-family monthly.</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: GREEN, fontStyle: "italic", marginTop: "2vh" }}>
            Soccer. Lacrosse. Swimming. Same infrastructure.
          </div>
        </div>
      </div>
    </div>
  );
}
