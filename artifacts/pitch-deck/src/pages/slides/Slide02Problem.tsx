const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";
const SURFACE = "#161616";
const BORDER = "#272727";
const RED = "#c0392b";

export default function Slide02Problem() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        background: "#0c0c0c",
        display: "flex",
        flexDirection: "column",
        padding: "6vh 6vw",
        fontFamily: BODY,
        color: TEXT,
      }}
    >
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: "1.5vw",
          letterSpacing: "0.2em",
          color: GOLD,
          textTransform: "uppercase",
          marginBottom: "2vh",
        }}
      >
        Part 1 — The Problem
      </div>

      <h2
        style={{
          fontFamily: DISPLAY,
          fontWeight: 900,
          fontSize: "4.5vw",
          margin: 0,
          maxWidth: "55vw",
          lineHeight: 1.05,
          color: TEXT,
          letterSpacing: "-0.01em",
          marginBottom: "2.5vh",
        }}
      >
        Youth sports facilities run on tools built for yoga studios.
      </h2>

      <div
        style={{
          height: "1px",
          background: `linear-gradient(to right, ${GOLD}, transparent)`,
          opacity: 0.5,
          width: "8vw",
          marginBottom: "3vh",
        }}
      />

      <div style={{ display: "flex", gap: "2vw", marginBottom: "3vh" }}>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${GOLD}`, borderRadius: 4, padding: "2vh 2.5vw", flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "5vw", color: GOLD, fontWeight: 900, lineHeight: 1 }}>5</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginTop: "0.5vh" }}>Locations</div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${GOLD}`, borderRadius: 4, padding: "2vh 2.5vw", flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "5vw", color: GOLD, fontWeight: 900, lineHeight: 1 }}>15</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginTop: "0.5vh" }}>Coaches</div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: `3px solid ${GOLD}`, borderRadius: 4, padding: "2vh 2.5vw", flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "5vw", color: GOLD, fontWeight: 900, lineHeight: 1 }}>400</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginTop: "0.5vh" }}>Families</div>
        </div>
        <div style={{ background: "#1a0a00", border: `1px solid #3a1a00`, borderTop: `3px solid ${RED}`, borderRadius: 4, padding: "2vh 2.5vw", flex: 2 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "3.5vw", color: RED, fontWeight: 900, lineHeight: 1 }}>$300–$500</div>
          <div style={{ fontFamily: BODY, fontSize: "1.6vw", color: MUTED, marginTop: "0.5vh" }}>lost per churned family per year</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
          <div style={{ width: "2px", height: "3.2vh", background: GOLD, flexShrink: 0, marginTop: "0.4vh" }} />
          <p style={{ fontFamily: BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
            A coach texts drill feedback. A 12-year-old hits 88 mph. Nobody records it.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
          <div style={{ width: "2px", height: "3.2vh", background: GOLD, flexShrink: 0, marginTop: "0.4vh" }} />
          <p style={{ fontFamily: BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
            The kid walks out the door. The relationship is gone. The facility has zero presence in his life.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
          <div style={{ width: "2px", height: "3.2vh", background: GOLD, flexShrink: 0, marginTop: "0.4vh" }} />
          <p style={{ fontFamily: BODY, fontSize: "1.9vw", color: TEXT, margin: 0, lineHeight: 1.4 }}>
            5 locations, zero visibility. The owner has no idea which coaches are retaining families, which kids are about to churn.
          </p>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "3.5vh", left: "6vw", fontFamily: BODY, fontSize: "1.6vw", fontStyle: "italic", color: GOLD }}>
        It&rsquo;s not a booking problem. It&rsquo;s an engagement problem.
      </div>
    </div>
  );
}
