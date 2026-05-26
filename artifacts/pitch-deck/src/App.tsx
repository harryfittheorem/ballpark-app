import { useEffect, type ComponentType } from "react";
import { useLocation, useRoute, Route, Switch } from "wouter";
import { slides, components } from "./slideLoader";

/* ── Shared palette ─────────────────────────────────────── */
const GOLD = "#d4a843";
const BORDER = "#272727";
const BG = "#0c0c0c";
const MUTED = "#7a7a7a";
const TEXT = "#f2f2f2";

/* ── SlideViewer ────────────────────────────────────────── */
function SlideViewer({ position }: { position: number }) {
  const slide = slides.find((s) => s.position === position);
  if (!slide) return null;
  const Component = components[slide.id] as ComponentType | undefined;
  if (!Component) return null;
  return <Component />;
}

/* ── SlideEditor ────────────────────────────────────────── */
function SlideEditor({ position }: { position: number }) {
  return <SlideViewer position={position} />;
}

/* ── AllSlides — workspace export contract ──────────────── */
function AllSlides() {
  return (
    <div style={{ background: "black" }}>
      {slides.map((slide) => {
        const Component = components[slide.id] as ComponentType | undefined;
        return (
          <div
            key={slide.id}
            className="slide relative aspect-video overflow-hidden"
            style={{ width: "1920px", height: "1080px" }}
          >
            <div className="h-full w-full [&_.h-screen]:!h-full [&_.w-screen]:!w-full">
              {Component && <Component />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Presentation viewer at / ───────────────────────────── */
function SlideRouteWrapper() {
  const [, params] = useRoute("/slide:n");
  const position = Number(params?.n ?? 1);
  return <SlideEditor position={position} />;
}

function PresentationViewer() {
  const [, navigate] = useLocation();
  const position = slides[0]?.position ?? 1;

  useEffect(() => {
    navigate(`/slide${position}`, { replace: true });
  }, [navigate, position]);

  return null;
}

/* ── Nav chrome for viewer ──────────────────────────────── */
function NavChrome({ position }: { position: number }) {
  const [, navigate] = useLocation();
  const idx = slides.findIndex((s) => s.position === position);
  const prev = idx > 0 ? slides[idx - 1] : null;
  const next = idx < slides.length - 1 ? slides[idx + 1] : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") && next) {
        navigate(`/slide${next.position}`);
      }
      if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && prev) {
        navigate(`/slide${prev.position}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, prev, next]);

  const btnStyle = (side: "left" | "right"): React.CSSProperties => ({
    position: "fixed",
    [side]: "1.5vw",
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(20,20,20,0.85)",
    border: `1px solid ${BORDER}`,
    borderRadius: 4,
    color: GOLD,
    width: "3.5vw",
    height: "6vh",
    cursor: "pointer",
    fontSize: "1.8vw",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    fontFamily: "sans-serif",
  });

  return (
    <>
      {prev && (
        <button style={btnStyle("left")} onClick={() => navigate(`/slide${prev.position}`)}>
          ‹
        </button>
      )}
      {next && (
        <button style={btnStyle("right")} onClick={() => navigate(`/slide${next.position}`)}>
          ›
        </button>
      )}
      <div
        style={{
          position: "fixed",
          bottom: "2vh",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "0.6vw",
          zIndex: 9999,
        }}
      >
        {slides.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/slide${s.position}`)}
            title={s.title}
            style={{
              width: s.position === position ? "2.5vw" : "0.5vw",
              height: "0.5vh",
              borderRadius: 2,
              background: s.position === position ? GOLD : "#3a3a3a",
              border: "none",
              cursor: "pointer",
              padding: 0,
              minWidth: s.position === position ? "2.5vw" : "0.5vw",
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "fixed",
          bottom: "0.8vh",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "sans-serif",
          fontSize: "1.1vw",
          color: MUTED,
          zIndex: 9999,
          letterSpacing: "0.08em",
        }}
      >
        {String(position).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
      </div>
    </>
  );
}

function SlideWithNav() {
  const [, params] = useRoute("/slide:n");
  const position = Number(params?.n ?? 1);
  return (
    <div style={{ width: "100vw", height: "100vh", background: BG, overflow: "hidden" }}>
      <SlideEditor position={position} />
      <NavChrome position={position} />
    </div>
  );
}

/* ── App ────────────────────────────────────────────────── */
export default function App() {
  const [, navigate] = useLocation();

  // DO NOT edit: unknown-route redirect
  useEffect(() => {
    const { pathname } = window.location;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const local =
      basePath && pathname.startsWith(basePath)
        ? pathname.slice(basePath.length) || "/"
        : pathname;
    const isKnown =
      local === "/" ||
      local === "/allslides" ||
      slides.some((s) => local === `/slide${s.position}`);
    if (!isKnown && slides.length > 0) {
      navigate(`/slide${slides[0].position}`, { replace: true });
    }
  }, [navigate]);

  // DO NOT edit: parent navigateToSlide postMessage listener
  useEffect(() => {
    function handler(event: MessageEvent) {
      if (
        event.data?.type === "navigateToSlide" &&
        slides.some((s) => s.position === event.data.position)
      ) {
        navigate(`/slide${event.data.position}`);
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: BG,
        overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
        color: TEXT,
      }}
    >
      <Switch>
        <Route path="/allslides" component={AllSlides} />
        <Route path="/slide:n" component={SlideWithNav} />
        <Route path="/" component={PresentationViewer} />
      </Switch>
    </div>
  );
}
