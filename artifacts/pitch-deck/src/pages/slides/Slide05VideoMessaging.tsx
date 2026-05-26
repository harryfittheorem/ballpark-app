const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";

export default function Slide05VideoMessaging() {
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
        Feature 02 — Video Messaging
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "1vh" }}>
        Two-Way{" "}
        <span style={{ color: GOLD }}>Video Messaging</span>
      </h2>

      <p style={{ fontFamily: BODY, fontSize: "2vw", color: MUTED, margin: "0 0 3vh 0" }}>
        A relationship tool, not just a messaging tool.
      </p>

      <div style={{ height: "1px", background: `linear-gradient(to right, ${GOLD}, transparent)`, opacity: 0.4, marginBottom: "3vh" }} />

      <div style={{ display: "flex", gap: "4vw", flex: 1, alignItems: "stretch" }}>
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${GOLD}`, borderRadius: 6, padding: "3vh 2.5vw", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2vh" }}>
            Coach Portal
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.8vw", color: TEXT, marginBottom: "1.5vh", lineHeight: 1.1 }}>
            Coach sends a swing breakdown
          </div>
          <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: MUTED, marginBottom: "1vh" }}>Records or uploads video on portal</div>
          <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: MUTED, marginBottom: "1vh" }}>Mux processes to HLS in under 60 seconds</div>
          <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: MUTED, marginBottom: "1vh" }}>Parent gets email (Resend) + in-app notification</div>
          <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: MUTED }}>Full-screen playback, marks as viewed automatically</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1vh" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "3vw", color: GOLD, fontWeight: 900 }}>{"→"}</div>
          <div style={{ fontFamily: BODY, fontSize: "1.5vw", color: MUTED }}>Mux</div>
          <div style={{ fontFamily: DISPLAY, fontSize: "3vw", color: GOLD, fontWeight: 900 }}>{"←"}</div>
        </div>

        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid #c9a227`, borderRadius: 6, padding: "3vh 2.5vw", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: "#c9a227", textTransform: "uppercase", marginBottom: "2vh" }}>
            Family App
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.8vw", color: TEXT, marginBottom: "1.5vh", lineHeight: 1.1 }}>
            Family replies with a video
          </div>
          <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: MUTED, marginBottom: "1vh" }}>Records 10-second clip on phone</div>
          <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: MUTED, marginBottom: "1vh" }}>Mux upload and processing fully in-app</div>
          <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: MUTED, marginBottom: "1vh" }}>Coach receives in portal in real time</div>
          <div style={{ fontFamily: BODY, fontSize: "1.75vw", color: MUTED }}>Thread shows both sides inline</div>
        </div>
      </div>
    </div>
  );
}
