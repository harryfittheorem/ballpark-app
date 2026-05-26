import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const manifestPath = resolve(root, "src/data/slides-manifest.json");

let errors = 0;

function fail(msg) {
  console.error("  FAIL:", msg);
  errors++;
}

function pass(msg) {
  console.log("  pass:", msg);
}

console.log("\nValidating slides manifest...");

if (!existsSync(manifestPath)) {
  console.error("FAIL: slides-manifest.json not found at", manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest)) {
  console.error("FAIL: manifest must be an array");
  process.exit(1);
}

console.log(`  Found ${manifest.length} slides\n`);

const ids = new Set();
const positions = new Set();

for (const slide of manifest) {
  const label = `Slide ${slide.position} (${slide.id})`;

  if (!slide.id) fail(`${label}: missing id`);
  else if (ids.has(slide.id)) fail(`${label}: duplicate id "${slide.id}"`);
  else { ids.add(slide.id); }

  if (slide.position == null) fail(`${label}: missing position`);
  else if (positions.has(slide.position)) fail(`${label}: duplicate position ${slide.position}`);
  else { positions.add(slide.position); }

  if (!slide.filepath) fail(`${label}: missing filepath`);
  else {
    const full = resolve(root, slide.filepath);
    if (!existsSync(full)) fail(`${label}: file not found — ${slide.filepath}`);
    else pass(`${label}: file exists`);
  }

  if (!slide.title) fail(`${label}: missing title`);
  if (slide.speakerNotes == null) fail(`${label}: missing speakerNotes`);
}

const sorted = [...positions].sort((a, b) => a - b);
for (let i = 0; i < sorted.length; i++) {
  if (sorted[i] !== i + 1) {
    fail(`Positions are not contiguous starting at 1 — gap at ${i + 1}`);
    break;
  }
}

console.log(`\nValidation ${errors === 0 ? "PASSED" : "FAILED"} (${errors} error${errors !== 1 ? "s" : ""})\n`);
process.exit(errors > 0 ? 1 : 0);
