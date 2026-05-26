const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const GREEN = "#27ae60";

export default function Slide11PilotPlan() {
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
        Part 5 — The June Pilot
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "0.8vh" }}>
        Pilot Plan —{" "}
        <span style={{ color: GOLD }}>One Location</span>
      </h2>

      <p style={{ fontFamily: BODY, fontSize: "1.9vw", color: MUTED, margin: "0 0 3vh 0" }}>
        One Infinite Hitting facility · 40–60 families · 4–6 coaches
      </p>

      <div style={{ display: "flex", gap: "2vw", flex: 1 }}>
        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${GOLD}`, borderRadius: 6, padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "1.5vh" }}>Week 1</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.6vw", color: TEXT, marginBottom: "1.5vh" }}>Soft Launch</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>10 families · 2 coaches</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>Invite-only via email</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>Front desk walkthrough</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED }}>Coach provisioning and portal setup</div>
        </div>

        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${GOLD}`, borderRadius: 6, padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "1.5vh" }}>Weeks 2–3</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.6vw", color: TEXT, marginBottom: "1.5vh" }}>Expanded Beta</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>All coaches onboarded</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>30–40 families invited</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>HitTrax pipeline active</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED }}>First real redemptions</div>
        </div>

        <div style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${GOLD}`, borderRadius: 6, padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "1.5vh" }}>Week 4</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.6vw", color: TEXT, marginBottom: "1.5vh" }}>Full Location</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>Everyone gets access</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>Push email blast</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>Coach Mike demo for families</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED }}>Front desk QR scanner active</div>
        </div>

        <div style={{ flex: 1, background: "#0d1a0d", border: `1px solid #1d3a1d`, borderRadius: 6, padding: "2.5vh 2vw" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GREEN, textTransform: "uppercase", marginBottom: "1.5vh" }}>We Own</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.6vw", color: TEXT, marginBottom: "1.5vh" }}>Full Support</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>Coach onboarding — 10 min each</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>Family invite emails via Resend</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginBottom: "0.8vh" }}>Week 1 live support (Slack channel)</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED }}>Weekly data recaps to IH leadership</div>
        </div>
      </div>
    </div>
  );
}
