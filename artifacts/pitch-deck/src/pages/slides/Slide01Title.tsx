const DISPLAY = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const BODY = "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOLD = "#d4a843";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";

export default function Slide01Title() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, #1a1400 0%, #0c0c0c 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: BODY,
        color: TEXT,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(to right, transparent, ${GOLD}, transparent)` }} />

      <div style={{ textAlign: "center", maxWidth: "72vw" }}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: "1.6vw",
            letterSpacing: "0.35em",
            color: GOLD,
            textTransform: "uppercase",
            marginBottom: "3vh",
          }}
        >
          BALLPARK
        </div>

        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: "7.5vw",
            color: TEXT,
            lineHeight: 1.0,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          The Operating System
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: "7.5vw",
            color: GOLD,
            lineHeight: 1.0,
            letterSpacing: "-0.01em",
            marginBottom: "3.5vh",
          }}
        >
          for Youth Sports
        </div>

        <div
          style={{
            height: "1px",
            background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`,
            opacity: 0.5,
            maxWidth: "20vw",
            margin: "0 auto 3.5vh",
          }}
        />

        <p
          style={{
            fontFamily: BODY,
            fontSize: "2.2vw",
            color: MUTED,
            margin: 0,
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          MindBody runs a gym. Ballpark runs a franchise.
        </p>
        <p
          style={{
            fontFamily: BODY,
            fontSize: "2.2vw",
            color: MUTED,
            margin: 0,
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          The difference is the kid.
        </p>
      </div>
    </div>
  );
}
