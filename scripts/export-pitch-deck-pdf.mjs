/**
 * Export the Ballpark pitch deck to a PDF.
 *
 * Usage:
 *   node scripts/export-pitch-deck-pdf.mjs
 *
 * Builds the pitch deck, serves it via vite preview, then uses Puppeteer to
 * capture every slide at 1920×1080 and writes a single 15-page PDF.
 *
 * Output: artifacts/pitch-deck/ballpark-pitch-deck.pdf
 */

import { execSync, spawn } from "child_process";
import { createServer } from "net";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const deckDir = path.join(repoRoot, "artifacts", "pitch-deck");
const outPath = path.join(deckDir, "ballpark-pitch-deck.pdf");

// ── helpers ──────────────────────────────────────────────────────────────────

function findFreePort(start = 4321) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(start, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", () => findFreePort(start + 1).then(resolve, reject));
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForPort(port, maxMs = 30_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const s = createServer();
      s.once("error", () => resolve(false));
      s.listen(port, "127.0.0.1", () => {
        s.close(() => resolve(true));
      });
    });
    if (!ok) return; // port is already in use → someone is listening
    await wait(300);
  }
  throw new Error(`Timed out waiting for port ${port}`);
}

// ── 1. Build ──────────────────────────────────────────────────────────────────

console.log("▶ Building pitch deck…");
execSync("./node_modules/.bin/vite build --config vite.config.ts", {
  cwd: deckDir,
  stdio: "inherit",
});
console.log("✓ Build complete.");

// ── 2. Serve ──────────────────────────────────────────────────────────────────

const port = await findFreePort(4321);
console.log(`▶ Starting preview server on port ${port}…`);

const server = spawn(
  "./node_modules/.bin/vite",
  [
    "preview",
    "--config", "vite.config.ts",
    "--host", "127.0.0.1",
    "--port", String(port),
    "--strictPort",
  ],
  { cwd: deckDir, stdio: "pipe" }
);

server.stderr.on("data", (d) => process.stderr.write(d));

await waitForPort(port);
await wait(500); // let vite settle
console.log("✓ Preview server ready.");

// ── 3. Export PDF ─────────────────────────────────────────────────────────────

let browser;
try {
  console.log("▶ Launching Puppeteer…");
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  // Each slide is 1920×1080. Use a matching viewport so vw/vh units resolve
  // correctly inside each slide component.
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  console.log("▶ Navigating to /allslides…");
  await page.goto(`http://127.0.0.1:${port}/allslides`, {
    waitUntil: "networkidle0",
    timeout: 30_000,
  });

  // Wait for the last slide element to be present in the DOM.
  await page.waitForSelector(".slide:last-child", { timeout: 15_000 });

  // Extra settle time for CSS animations and web fonts.
  await wait(1500);

  // ── Inject print CSS ────────────────────────────────────────────────────────
  // The App root wrapper has `height: 100vh; overflow: hidden` which clamps
  // everything to one viewport. Override those constraints so all 15 slides are
  // in the printable flow, then add a page break after each one.
  await page.addStyleTag({
    content: `
      /* Remove viewport clamp from App root and the AllSlides wrapper */
      html, body {
        height: auto !important;
        overflow: visible !important;
      }
      /* Target the App root div and AllSlides wrapper div */
      #root > div,
      #root > div > div {
        height: auto !important;
        overflow: visible !important;
      }
      /* Each slide occupies exactly one printed page */
      .slide {
        break-after: page !important;
        page-break-after: always !important;
        /* Keep the explicit pixel dimensions so each page is exactly 1920×1080 */
        width: 1920px !important;
        height: 1080px !important;
        overflow: hidden !important;
      }
      /* No blank trailing page */
      .slide:last-child {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
    `,
  });

  const slideCount = await page.$$eval(".slide", (els) => els.length);
  console.log(`✓ Detected ${slideCount} slides.`);

  console.log(`▶ Exporting PDF → ${outPath}`);
  await page.pdf({
    path: outPath,
    width: "1920px",
    height: "1080px",
    printBackground: true,
    landscape: false, // dimensions are already landscape (wider than tall)
  });

  console.log(`✓ PDF written: ${outPath}`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
