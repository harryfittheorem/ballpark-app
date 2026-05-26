const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const GREEN = "#27ae60";

export default function Slide10MultiTenant() {
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
      <div style={{ width: "44vw", display: "flex", flexDirection: "column", justifyContent: "center", padding: "5vh 5vw", borderRight: `1px solid ${BORDER}` }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: GOLD, textTransform: "uppercase", marginBottom: "2vh" }}>
          Architecture — Tenancy
        </div>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "5vw", margin: 0, lineHeight: 1.0, letterSpacing: "-0.01em", marginBottom: "3vh" }}>
          Multi-Tenant{" "}
          <span style={{ color: GOLD }}>Franchise OS</span>
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
            <div style={{ width: "2px", height: "4vh", background: GOLD, flexShrink: 0, marginTop: "0.3vh" }} />
            <p style={{ fontFamily: BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
              Every record has a{" "}
              <span style={{ color: GOLD, fontFamily: "monospace" }}>tenant_id</span>. Zero data crosses tenant boundaries. Enforced at the database level, not in code.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
            <div style={{ width: "2px", height: "4vh", background: GOLD, flexShrink: 0, marginTop: "0.3vh" }} />
            <p style={{ fontFamily: BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
              Infinite Hitting is Tenant #1. The next franchise becomes Tenant #2. Same infrastructure, different brand, different coaches, different store.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
            <div style={{ width: "2px", height: "4vh", background: GOLD, flexShrink: 0, marginTop: "0.3vh" }} />
            <p style={{ fontFamily: BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
              A new franchise goes live in 30 days. New revenue line with near-zero marginal cost.
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "5vh 4vw", gap: "2vh" }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: MUTED, textTransform: "uppercase", marginBottom: "0.5vh" }}>Today</div>

        <div style={{ background: "#1a1200", border: `2px solid ${GOLD}`, borderRadius: 6, padding: "2vh 2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.5vw", color: GOLD }}>Infinite Hitting</div>
            <div style={{ fontFamily: BODY, fontSize: "1.5vw", color: MUTED }}>Tenant #1 · 400 families · 15 coaches</div>
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.8vw", color: GREEN }}>LIVE</div>
        </div>

        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: "1.5vw", letterSpacing: "0.2em", color: MUTED, textTransform: "uppercase", marginTop: "1vh", marginBottom: "0.5vh" }}>Next</div>

        <div style={{ background: SURFACE, border: `1px dashed ${BORDER}`, borderRadius: 6, padding: "2vh 2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.5vw", color: MUTED }}>XYZ Baseball Academy</div>
            <div style={{ fontFamily: BODY, fontSize: "1.5vw", color: MUTED }}>Tenant #2 · white-label build · 30 days to live</div>
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.8vw", color: MUTED }}>COMING</div>
        </div>

        <div style={{ background: SURFACE, border: `1px dashed ${BORDER}`, borderRadius: 6, padding: "2vh 2vw", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.5 }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "2.5vw", color: MUTED }}>Soccer / Lacrosse / Swimming</div>
            <div style={{ fontFamily: BODY, fontSize: "1.5vw", color: MUTED }}>Multi-sport · same infrastructure · different sensor data</div>
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: "1.8vw", color: MUTED }}>ROADMAP</div>
        </div>

        <p style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, fontStyle: "italic", margin: "1vh 0 0 0" }}>
          A franchisor logs in once and sees all locations — bookings, retention, coach performance — in one view.
        </p>
      </div>
    </div>
  );
}
