/**
 * App Store screenshot generator — faithful Ballpark UI replicas.
 * Uses exact design tokens, fonts, and component layouts from the real app source.
 *
 * Usage:  node scripts/generate-screenshots.mjs
 * Output: app-store-screenshots/iphone/*.png  (1242×2688 — iPhone 6.5")
 *         app-store-screenshots/ipad/*.png    (2048×2732 — iPad Pro 12.9")
 */

import puppeteer from 'puppeteer';
import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';

await mkdir('app-store-screenshots/iphone', { recursive: true });
await mkdir('app-store-screenshots/ipad',  { recursive: true });

// ─── Exact design tokens from src/theme ───────────────────────────────────────
const T = {
  darkest:    '#0B0B0B',
  darker:     '#141414',
  dark:       '#1C1C1C',
  border:     '#2A2A2A',
  borderGold: 'rgba(232,167,71,0.35)',
  goldDim:    'rgba(232,167,71,0.10)',
  gold:       '#E8A747',
  text:       '#F5F5F5',
  textLight:  '#CCCCCC',
  textMuted:  '#888888',
  success:    '#4ADE80',
  successDim: 'rgba(74,222,128,0.15)',
  red:        'rgba(220,38,38,0.8)',
};

// ─── Google Fonts link ────────────────────────────────────────────────────────
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

// ─── Shared base CSS ──────────────────────────────────────────────────────────
const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { width: 414px; background: ${T.darkest}; }
body { width: 414px; min-height: 896px; background: ${T.darkest};
  font-family: 'Inter', -apple-system, sans-serif; color: ${T.text};
  -webkit-font-smoothing: antialiased; }

/* ── Status bar ── */
.sb {
  height: 50px; display: flex; align-items: center;
  justify-content: space-between; padding: 14px 20px 0;
  background: ${T.darkest}; flex-shrink: 0;
}
.sb-time { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 15px; color: ${T.text}; }
.sb-icons { display: flex; gap: 6px; align-items: center; }

/* ── Tab bar ── */
.tabbar {
  position: fixed; bottom: 0; left: 0; right: 0; width: 414px;
  background: ${T.darker}; border-top: 1px solid ${T.border};
  display: flex; padding: 8px 0 28px; z-index: 100;
}
.tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.tab-ico { width: 24px; height: 24px; }
.tab-lbl { font-family: 'Oswald', sans-serif; font-size: 10px; letter-spacing: 0.1em; color: ${T.textMuted}; }
.tab.on .tab-lbl { color: ${T.gold}; }
.tab-dot { width: 4px; height: 4px; border-radius: 50%; margin-top: 1px; }
.tab.on .tab-dot { background: ${T.gold}; }

/* ── Screen wrapper ── */
.screen { display: flex; flex-direction: column; min-height: 896px; background: ${T.darkest}; padding-bottom: 88px; }

/* ── Screen title ── */
.screen-title {
  font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 28px;
  color: ${T.gold}; letter-spacing: 0.08em; padding: 8px 20px 14px; flex-shrink: 0;
}

/* ── Scroll area ── */
.scroll { flex: 1; overflow: hidden; padding: 0 16px; display: flex; flex-direction: column; gap: 10px; }

/* ── Cards ── */
.card {
  background: ${T.dark}; border: 1px solid ${T.border}; border-radius: 16px; padding: 16px;
}
.card-gold { border-color: ${T.borderGold}; background: rgba(232,167,71,0.04); }

/* ── Section label ── */
.section-lbl {
  font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 11px;
  color: ${T.gold}; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px;
}

/* ── Pills ── */
.pill { display: inline-flex; align-items: center; justify-content: center;
  padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
.pill-gold { background: ${T.goldDim}; color: ${T.gold}; border: 1px solid ${T.borderGold}; }
.pill-green { background: ${T.successDim}; color: ${T.success}; border: 1px solid rgba(74,222,128,0.3); }
.pill-dark { background: ${T.darker}; color: ${T.textMuted}; border: 1px solid ${T.border}; }

/* ── Sub-tabs ── */
.subtabs { display: flex; gap: 6px; padding: 0 16px 10px; flex-shrink: 0; overflow: hidden; }
.st { padding: 6px 13px; border-radius: 99px; font-family: 'Inter', sans-serif;
  font-size: 12px; font-weight: 600; color: ${T.textMuted}; border: 1px solid ${T.border}; white-space: nowrap; }
.st.on { background: ${T.gold}; color: ${T.darkest}; border-color: ${T.gold}; }

/* ── Progress ── */
.prog-track { background: ${T.darker}; border-radius: 99px; height: 6px; width: 100%; overflow: hidden; }
.prog-fill  { background: ${T.gold}; border-radius: 99px; height: 6px; }

/* ── Chevron ── */
.chev { width: 16px; height: 16px; color: ${T.gold}; flex-shrink: 0; }

/* ── Row item ── */
.row-item {
  background: ${T.darker}; border: 1px solid ${T.border}; border-radius: 16px;
  padding: 14px 16px; display: flex; align-items: center; gap: 12px;
}
.row-ico {
  width: 34px; height: 34px; border-radius: 99px; background: ${T.darkest};
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

/* ── Oswald number ── */
.big-num { font-family: 'Oswald', sans-serif; font-weight: 700; color: ${T.gold}; line-height: 1; }
`;

// ─── SVG icons ────────────────────────────────────────────────────────────────
function ico(path, opts = {}) {
  const { size = 20, color = T.gold, stroke = 2, fill = 'none' } = opts;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
const I = {
  home:     () => ico('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  activity: () => ico('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
  calendar: () => ico('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
  star:     () => ico('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  user:     () => ico('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  chev:     (c = T.gold) => ico('<polyline points="9 18 15 12 9 6"/>', { color: c }),
  trophy:   (s=18, c=T.gold) => ico('<path d="M6 9H4a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h.14M18 9h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-.14M12 17v4M8 21h8"/><rect x="6" y="2" width="12" height="13" rx="2"/>', { size: s, color: c }),
  play:     (c=T.gold) => ico('<polygon points="5 3 19 12 5 21 5 3"/>', { color: c, fill: c }),
  video:    () => ico('<path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.361a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>'),
  shield:   () => ico('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  gift:     () => ico('<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M7 7H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2c1.55 0 3 1.5 4 3zm10 0h3a2 2 0 0 0 2-2 2 2 0 0 0-2-2c-1.55 0-3 1.5-4 3z"/>'),
  flash:    (c=T.gold) => ico('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', { color: c }),
  target:   () => ico('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  ruler:    () => ico('<path d="M21.3 8.7L8.7 21.3c-.4.4-.8.6-1.3.7L3 22l-.1-4.5c0-.4.3-.9.6-1.2L16.3 2.7a2.4 2.4 0 0 1 3.3 0l1.7 1.7a2.4 2.4 0 0 1 0 3.3z"/>'),
  credit:   () => ico('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'),
  bookmark: () => ico('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
  flame:    () => ico('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
  map:      () => ico('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'),
  gauge:    () => ico('<path d="M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z"/><path d="M12 6v6l4 2"/>'),
  trend:    () => ico('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
};

// ─── Status bar ───────────────────────────────────────────────────────────────
function statusBar(time = '9:41') {
  return `<div class="sb">
    <span class="sb-time">${time}</span>
    <div class="sb-icons">
      <svg width="17" height="12" viewBox="0 0 17 12">
        <rect x="0" y="3" width="3" height="9" rx="1" fill="${T.text}" opacity=".4"/>
        <rect x="4.5" y="2" width="3" height="10" rx="1" fill="${T.text}" opacity=".6"/>
        <rect x="9" y="0" width="3" height="12" rx="1" fill="${T.text}"/>
        <rect x="13.5" y="0" width="3" height="12" rx="1" fill="${T.text}"/>
      </svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
        <path d="M8 2.5C10 2.5 11.8 3.3 13.1 4.6L14.5 3.1C12.8 1.2 10.5 0 8 0S3.2 1.2 1.5 3.1L2.9 4.6C4.2 3.3 6 2.5 8 2.5Z" fill="${T.text}"/>
        <path d="M8 5.3C9.4 5.3 10.6 5.8 11.5 6.7L12.9 5.2C11.6 3.9 9.9 3.1 8 3.1S4.4 3.9 3.1 5.2L4.5 6.7C5.4 5.8 6.6 5.3 8 5.3Z" fill="${T.text}"/>
        <circle cx="8" cy="10" r="2" fill="${T.text}"/>
      </svg>
      <svg width="27" height="13" viewBox="0 0 27 13">
        <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="${T.text}" stroke-opacity="0.35"/>
        <rect x="23" y="4" width="4" height="5" rx="1.5" fill="${T.text}" fill-opacity="0.4"/>
        <rect x="2" y="2" width="18" height="9" rx="2" fill="${T.text}"/>
      </svg>
    </div>
  </div>`;
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function tabBar(active) {
  const tabs = [
    { id: 'home', lbl: 'HOME',  svg: I.home() },
    { id: 'work', lbl: 'WORK',  svg: I.activity() },
    { id: 'book', lbl: 'BOOK',  svg: I.calendar() },
    { id: 'earn', lbl: 'EARN',  svg: I.star() },
    { id: 'me',   lbl: 'ME',    svg: I.user() },
  ];
  // Re-colour the active tab icon gold vs muted
  const tabSvg = (t) => {
    const on = t.id === active;
    const svg = t.svg.replace(/stroke="[^"]+"/g, `stroke="${on ? T.gold : T.textMuted}"`);
    return svg;
  };
  return `<div class="tabbar">
    ${tabs.map(t => `
    <div class="tab ${t.id === active ? 'on' : ''}">
      <div class="tab-ico">${tabSvg(t)}</div>
      <span class="tab-lbl">${t.lbl}</span>
      <div class="tab-dot"></div>
    </div>`).join('')}
  </div>`;
}

// ─── HTML shell ───────────────────────────────────────────────────────────────
function page(body, activeTab) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=414, initial-scale=1">
${FONTS}
<style>${BASE_CSS}</style>
</head><body>
<div class="screen">
  ${statusBar()}
  ${body}
</div>
${tabBar(activeTab)}
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — HOME DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
const homeHTML = page(`
  <!-- Header row -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 16px 12px;flex-shrink:0">
    <span style="font-family:'Oswald',sans-serif;font-weight:700;font-size:26px;color:${T.gold};letter-spacing:.08em">BALLPARK</span>
    <!-- Kid switcher pill -->
    <div style="display:flex;align-items:center;gap:7px;background:${T.dark};border:1px solid ${T.borderGold};border-radius:99px;padding:6px 12px">
      <div style="width:24px;height:24px;border-radius:50%;background:${T.gold};display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-weight:700;font-size:12px;color:${T.darkest};flex-shrink:0">M</div>
      <span style="font-family:'Inter',sans-serif;font-size:12px;font-weight:600;color:${T.text}">Marcus Rivera</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${T.gold}" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
  </div>

  <div class="scroll">
    <!-- Points hero card -->
    <div class="card card-gold" style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div>
          <div style="font-size:11px;font-weight:600;color:${T.textMuted};letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Points Balance</div>
          <div style="display:flex;align-items:baseline;gap:6px">
            <span class="big-num" style="font-size:58px">847</span>
            <span style="font-size:14px;color:${T.textMuted};font-weight:600">pts</span>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;font-weight:600;color:${T.textMuted};letter-spacing:.08em;margin-bottom:4px">NEXT REWARD</div>
          <div style="font-size:13px;font-weight:700;color:${T.text}">Pro Grip Tape</div>
          <div style="font-size:11px;color:${T.gold};margin-top:3px">153 pts to go</div>
        </div>
      </div>
      <div class="prog-track"><div class="prog-fill" style="width:85%"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:5px">
        <span style="font-size:10px;color:${T.textMuted}">847 pts</span>
        <span style="font-size:10px;color:${T.textMuted}">1,000 pts</span>
      </div>
    </div>

    <!-- Stat tiles -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      ${statTile(I.flame(), '12', 'STREAK', 'days')}
      ${statTile(I.trophy(), '#3', 'RANK', 'this week')}
      ${statTile(I.flash(), '88.4', 'EXIT VELO', 'mph')}
    </div>

    <!-- Coach video card -->
    <div class="card" style="display:flex;gap:12px;align-items:center;padding:14px">
      <div style="position:relative;flex-shrink:0">
        <div style="width:66px;height:66px;border-radius:12px;background:${T.darker};border:1px solid ${T.border};display:flex;align-items:center;justify-content:center;overflow:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${T.gold}"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.75);border-radius:4px;padding:1px 4px;font-size:9px;font-weight:600;color:${T.text}">0:47</div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
          <span style="font-size:14px;font-weight:700;color:${T.text}">Coach Mike</span>
          <span class="pill pill-gold" style="font-size:9px;padding:2px 7px">NEW</span>
        </div>
        <div style="font-size:12px;color:${T.textMuted};line-height:1.4">Great hip mechanics today — watch this drill breakdown.</div>
      </div>
      ${I.chev()}
    </div>

    <!-- Upcoming session card -->
    <div class="card" style="padding:14px">
      <div class="section-lbl" style="margin-bottom:10px">Upcoming Session</div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="background:${T.goldDim};border:1px solid ${T.borderGold};border-radius:12px;padding:10px 12px;text-align:center;flex-shrink:0">
          <div style="font-size:10px;font-weight:700;color:${T.gold};letter-spacing:.08em">TUE</div>
          <div class="big-num" style="font-size:26px">22</div>
        </div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;color:${T.text}">Private Lesson</div>
          <div style="font-size:12px;color:${T.textMuted};margin-top:3px">9:00 AM · Coach Mike · Cage 3</div>
          <div style="margin-top:7px"><span class="pill pill-green" style="font-size:10px">Confirmed</span></div>
        </div>
      </div>
    </div>

    <!-- Pending drill -->
    <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px">
      <div style="width:42px;height:42px;border-radius:12px;background:${T.goldDim};border:1px solid ${T.borderGold};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${I.bookmark()}
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:${T.text}">Hip Rotation Drill</div>
        <div style="font-size:11px;color:${T.textMuted};margin-top:3px">Due Jul 24 · +25 pts on completion</div>
      </div>
      ${I.chev()}
    </div>

    <!-- HitTrax personal best -->
    <div class="card card-gold" style="display:flex;align-items:center;gap:12px;padding:14px">
      <div style="width:42px;height:42px;border-radius:12px;background:${T.goldDim};border:1px solid ${T.borderGold};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${I.flash()}
      </div>
      <div style="flex:1">
        <div style="font-size:10px;font-weight:600;color:${T.textMuted};letter-spacing:.08em;text-transform:uppercase">New Personal Best</div>
        <div style="font-size:13px;font-weight:700;color:${T.gold};margin-top:2px">88.4 mph Exit Velocity 🎉</div>
        <div style="font-size:11px;color:${T.textMuted};margin-top:2px">HitTrax · Today's session</div>
      </div>
    </div>
  </div>
`, 'home');

function statTile(icon, value, label, sub) {
  return `<div class="card" style="padding:12px 10px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px">
    <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center">${icon}</div>
    <div class="big-num" style="font-size:24px">${value}</div>
    <div style="font-size:9px;font-weight:700;color:${T.textMuted};letter-spacing:.1em;text-transform:uppercase">${label}</div>
    <div style="font-size:9px;color:${T.textMuted}">${sub}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — BOOK
// ═══════════════════════════════════════════════════════════════════════════════
const bookHTML = page(`
  <div class="screen-title">BOOK</div>

  <!-- Credit banner -->
  <div style="margin:0 16px 10px;background:${T.goldDim};border:1px solid ${T.borderGold};border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0">
    ${I.credit()}
    <div>
      <div style="font-size:12px;font-weight:700;color:${T.gold}">4 of 12 session credits remaining</div>
      <div style="font-size:11px;color:${T.textMuted}">Monthly membership · renews Aug 1</div>
    </div>
  </div>

  <div class="scroll">
    <!-- Upcoming -->
    <div class="section-lbl">UPCOMING</div>
    ${bookingCard('TUE', '22', '9:00 AM', 'Private Lesson · Coach Mike · Cage 3', true)}
    ${bookingCard('THU', '24', '11:00 AM', 'Group Session · Coach Mike · Cage 1', true)}
    ${bookingCard('SAT', '26', '2:00 PM', 'Cage Rental · 60 min · Cage 5', false)}

    <div style="height:1px;background:${T.border};flex-shrink:0"></div>

    <!-- New booking -->
    <div class="section-lbl">BOOK A SESSION</div>

    <!-- Lesson / Cage toggle -->
    <div style="display:flex;background:${T.dark};border-radius:12px;padding:3px;flex-shrink:0">
      <div style="flex:1;background:${T.gold};border-radius:10px;padding:9px;text-align:center;font-size:13px;font-weight:700;color:${T.darkest};font-family:'Inter',sans-serif">Hitting Lessons</div>
      <div style="flex:1;padding:9px;text-align:center;font-size:13px;font-weight:600;color:${T.textMuted}">Cage Rentals</div>
    </div>

    <!-- Day pills -->
    <div style="display:flex;gap:6px;overflow:hidden">
      ${dayPill('MON','21',false)} ${dayPill('TUE','22',true)} ${dayPill('WED','23',false)}
      ${dayPill('THU','24',false)} ${dayPill('FRI','25',false)}
    </div>

    <!-- Time slots 2×2 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${timeSlot('9:00 AM', true)} ${timeSlot('11:00 AM', false)}
      ${timeSlot('2:00 PM', false)} ${timeSlot('4:00 PM', false)}
    </div>

    <!-- Coach list (compact) -->
    <div style="background:${T.dark};border:1px solid ${T.border};border-radius:12px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:${T.textMuted};letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">SELECT COACH</div>
      ${coachRow('Coach Mike', '⚾ Hitting Specialist', true)}
      ${coachRow('Coach Sarah', '⚾ Pitching Specialist', false)}
    </div>

    <!-- Confirm button -->
    <div style="background:${T.gold};border-radius:14px;padding:16px;text-align:center;font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;color:${T.darkest};letter-spacing:.06em;cursor:pointer">
      CONFIRM BOOKING
    </div>
  </div>
`, 'book');

function bookingCard(day, date, time, detail, confirmed) {
  return `<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px">
    <div style="background:${T.goldDim};border:1px solid ${T.borderGold};border-radius:10px;padding:8px 10px;text-align:center;flex-shrink:0;min-width:46px">
      <div style="font-size:9px;font-weight:700;color:${T.gold};letter-spacing:.08em">${day}</div>
      <div class="big-num" style="font-size:22px">${date}</div>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;color:${T.text}">${time}</div>
      <div style="font-size:11px;color:${T.textMuted};margin-top:2px">${detail}</div>
    </div>
    <span class="pill ${confirmed ? 'pill-green' : 'pill-gold'}" style="font-size:10px">${confirmed ? 'Confirmed' : 'Pending'}</span>
  </div>`;
}

function dayPill(day, date, active) {
  return `<div style="flex:1;background:${active ? T.gold : T.dark};border:1px solid ${active ? T.gold : T.border};border-radius:10px;padding:8px 4px;text-align:center">
    <div style="font-size:9px;font-weight:700;color:${active ? T.darkest : T.textMuted};letter-spacing:.06em">${day}</div>
    <div class="big-num" style="font-size:18px;color:${active ? T.darkest : T.text}">${date}</div>
  </div>`;
}

function timeSlot(t, active) {
  return `<div style="background:${active ? T.gold : T.dark};border:1px solid ${active ? T.gold : T.border};border-radius:12px;padding:12px;text-align:center;font-size:14px;font-weight:600;color:${active ? T.darkest : T.textMuted}">${t}</div>`;
}

function coachRow(name, spec, active) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;${active ? `border-left:2px solid ${T.gold};padding-left:8px;margin-left:-8px;` : ''}">
    <div style="width:32px;height:32px;border-radius:50%;background:${active ? T.gold : T.border};display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-weight:700;font-size:14px;color:${active ? T.darkest : T.textMuted};flex-shrink:0">${name[6]}</div>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:600;color:${active ? T.text : T.textMuted}">${name}</div>
      <div style="font-size:11px;color:${T.textMuted}">${spec}</div>
    </div>
    ${active ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="${T.gold}"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10" stroke="${T.darkest}" stroke-width="2.5" fill="none"/></svg>` : ''}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — WORK / COACH MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════
const workHTML = page(`
  <div style="padding:4px 16px 10px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
    <span style="font-family:'Oswald',sans-serif;font-weight:700;font-size:28px;color:${T.gold};letter-spacing:.08em">WORK</span>
    <span class="pill pill-gold">2 new</span>
  </div>

  <div class="subtabs">
    <div class="st">Swings</div>
    <div class="st">Assign</div>
    <div class="st on">Messages</div>
    <div class="st">HW</div>
    <div class="st">Drills</div>
  </div>

  <div class="scroll" style="gap:12px">
    <!-- Video message from coach — full card -->
    <div class="card" style="padding:0;overflow:hidden">
      <!-- Video thumbnail -->
      <div style="background:${T.darker};height:190px;display:flex;align-items:center;justify-content:center;position:relative">
        <!-- Fake waveform -->
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:3px;opacity:0.12">
          ${Array.from({length:40}, (_,i) => `<div style="width:3px;height:${10+Math.abs(Math.sin(i)*45)}px;background:${T.gold};border-radius:2px"></div>`).join('')}
        </div>
        <!-- Play button -->
        <div style="width:60px;height:60px;border-radius:50%;background:rgba(232,167,71,0.25);border:2px solid ${T.gold};display:flex;align-items:center;justify-content:center;z-index:1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${T.gold}"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <!-- Coach name top-left -->
        <div style="position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:6px">
          <div style="width:28px;height:28px;border-radius:50%;background:${T.gold};display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-weight:700;font-size:13px;color:${T.darkest}">M</div>
          <span style="font-size:13px;font-weight:700;color:${T.text}">Coach Mike</span>
        </div>
        <!-- NEW badge -->
        <span class="pill pill-gold" style="position:absolute;top:10px;right:10px;font-size:10px">NEW</span>
        <!-- Duration -->
        <div style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.75);border-radius:5px;padding:2px 7px;font-size:11px;font-weight:600;color:${T.text}">0:47</div>
      </div>
      <!-- Message body -->
      <div style="padding:14px">
        <div style="font-size:14px;font-weight:700;color:${T.text};margin-bottom:4px">Great hip mechanics today! 🔥</div>
        <div style="font-size:12px;color:${T.textMuted};line-height:1.5">Focus on keeping your hands inside the ball on outside pitches. See the drill I attached.</div>
        <div style="font-size:10px;color:${T.textMuted};margin-top:8px">Today · 8:32 AM</div>
      </div>
    </div>

    <!-- Parent reply (right-aligned gold bubble) -->
    <div style="display:flex;justify-content:flex-end;padding:0 2px">
      <div style="background:${T.gold};border-radius:14px 14px 4px 14px;padding:11px 15px;max-width:76%">
        <div style="font-size:13px;font-weight:500;color:${T.darkest};line-height:1.4">Thank you Coach! We'll work on the hip drill tonight. 💪</div>
        <div style="font-size:10px;color:rgba(11,11,11,0.5);margin-top:4px;text-align:right">Yesterday · 7:08 PM</div>
      </div>
    </div>

    <!-- Older coach video (dimmer) -->
    <div class="card" style="display:flex;gap:12px;align-items:center;padding:12px;opacity:.7">
      <div style="position:relative;flex-shrink:0">
        <div style="width:58px;height:58px;border-radius:10px;background:${T.darker};display:flex;align-items:center;justify-content:center;border:1px solid ${T.border}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${T.gold}"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <div style="position:absolute;bottom:3px;right:3px;background:rgba(0,0,0,.75);border-radius:3px;padding:1px 4px;font-size:9px;font-weight:600;color:${T.text}">1:12</div>
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:${T.text}">Load phase analysis — Session #8</div>
        <div style="font-size:11px;color:${T.textMuted};margin-top:3px">Jul 14 · Viewed</div>
      </div>
    </div>

    <!-- Send video CTA -->
    <div style="background:${T.dark};border:1.5px dashed ${T.borderGold};border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px">
      <div style="width:38px;height:38px;border-radius:50%;background:${T.goldDim};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${I.video()}
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:${T.gold}">Send a video to your coach</div>
        <div style="font-size:11px;color:${T.textMuted}">Record or pick from your camera roll</div>
      </div>
    </div>
  </div>
`, 'work');

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 4 — EARN / REWARDS
// ═══════════════════════════════════════════════════════════════════════════════
const earnHTML = page(`
  <div class="screen-title">EARN</div>

  <div class="subtabs">
    <div class="st on">Rewards</div>
    <div class="st">Store</div>
    <div class="st">Ranks</div>
    <div class="st">Rules</div>
  </div>

  <div class="scroll">
    <!-- Points hero -->
    <div class="card card-gold" style="padding:22px;text-align:center">
      <div style="font-size:11px;font-weight:700;color:${T.textMuted};letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">YOUR BALANCE</div>
      <div class="big-num" style="font-size:68px">847</div>
      <div style="font-size:14px;color:${T.textMuted};margin-bottom:14px">points</div>
      <div class="prog-track"><div class="prog-fill" style="width:85%"></div></div>
      <div style="font-size:11px;color:${T.textMuted};margin-top:6px">153 pts until Pro Grip Tape</div>
    </div>

    <!-- Leaderboard -->
    <div class="card" style="padding:14px">
      <div class="section-lbl" style="margin-bottom:10px">FACILITY LEADERBOARD</div>
      ${ldrRow(1,'🥇','Tyler K.',1240,false)}
      ${ldrRow(2,'🥈','Jordan M.',1102,false)}
      ${ldrRow(3,'🥉','Marcus Rivera (you)',847,true)}
      ${ldrRow(4,'4','Jaylen C.',791,false)}
    </div>

    <!-- Reward catalog -->
    <div class="section-lbl">REDEEM REWARDS</div>
    ${rewardRow('🎯','Pro Grip Tape',1000,847)}
    ${rewardRow('🧢','Infinite Hitting Hat',750,847)}
    ${rewardRow('⚡','Free Session Credit',2500,847)}
    ${rewardRow('👕','Team T-Shirt',1500,847)}
  </div>
`, 'earn');

function ldrRow(n, medal, name, pts, isMe) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px;${isMe ? `background:${T.goldDim};border:1px solid ${T.borderGold};` : ''}">
    <span style="font-size:17px;width:26px;text-align:center;line-height:1">${medal}</span>
    <span style="flex:1;font-size:13px;font-weight:${isMe ? 700 : 500};color:${isMe ? T.gold : T.text}">${name}</span>
    <span style="font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;color:${isMe ? T.gold : T.textMuted}">${pts.toLocaleString()} pts</span>
  </div>`;
}

function rewardRow(emoji, name, cost, bal) {
  const can = bal >= cost;
  return `<div class="card" style="display:flex;align-items:center;gap:12px;padding:13px">
    <div style="width:44px;height:44px;border-radius:12px;background:${T.goldDim};border:1px solid ${T.borderGold};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${emoji}</div>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700;color:${T.text}">${name}</div>
      <div style="font-size:12px;color:${T.gold};margin-top:2px;font-weight:600">${cost.toLocaleString()} pts</div>
    </div>
    <div style="background:${can ? T.gold : T.dark};border:1px solid ${can ? T.gold : T.border};border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:${can ? T.darkest : T.textMuted}">
      ${can ? 'Redeem' : 'Save up'}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 5 — PROFILE / ME
// ═══════════════════════════════════════════════════════════════════════════════
const meHTML = page(`
  <div class="scroll" style="padding-top:12px;gap:14px">
    <!-- Profile header -->
    <div style="text-align:center;padding:14px 0 6px">
      <div style="width:86px;height:86px;border-radius:26px;background:${T.gold};display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-family:'Oswald',sans-serif;font-weight:700;font-size:46px;color:${T.darkest}">M</div>
      <div style="font-family:'Oswald',sans-serif;font-size:28px;font-weight:700;color:${T.gold}">Marcus Rivera</div>
      <div style="font-size:13px;color:${T.textMuted};margin-top:4px">12U · Shortstop · #24</div>
      <!-- Points pill -->
      <div style="display:inline-flex;align-items:center;gap:7px;margin-top:12px;background:${T.goldDim};border:1px solid ${T.borderGold};border-radius:99px;padding:7px 16px">
        ${I.trophy(15)}
        <span style="font-family:'Oswald',sans-serif;font-size:17px;font-weight:700;color:${T.gold}">847 pts</span>
      </div>
    </div>

    <!-- Personal Bests -->
    <div class="section-lbl">PERSONAL BESTS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${pbTile(I.flash(), 'EXIT VELO', '88.4', 'MPH')}
      ${pbTile(I.trend(), 'LAUNCH ANGLE', '14', '°')}
      ${pbTile(I.ruler(), 'DISTANCE', '312', 'FT')}
      ${pbTile(I.target(), 'CONTACT RATE', '78', '%')}
    </div>

    <!-- Achievements -->
    <div style="display:flex;align-items:baseline;justify-content:space-between">
      <div class="section-lbl" style="margin:0">ACHIEVEMENTS</div>
      <span style="font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;color:${T.textMuted}">4 / 12</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${badge('🏆','First Hit',true)}
      ${badge('🔥','On Fire',true)}
      ${badge('⚡','Speed Run',true)}
      ${badge('🎯','Dead Eye',true)}
      ${badge('👑','Top Dog',false)}
      ${badge('🌟','All Star',false)}
      ${badge('💪','Grinder',false)}
      ${badge('🚀','Rocket',false)}
    </div>

    <!-- Settings rows -->
    <div class="section-lbl" style="margin-bottom:0">SETTINGS</div>
    ${settRow(I.calendar(),'Bookings')}
    ${settRow(I.gift(),'Orders')}
    ${settRow(I.credit(),'Membership', 'Infinite Hitting Monthly')}
    ${settRow(I.shield(),'Privacy Policy')}

    <!-- Sign out -->
    <div style="border:1px solid ${T.border};border-radius:14px;padding:16px;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${T.gold}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      <span style="font-family:'Inter',sans-serif;font-size:15px;font-weight:700;color:${T.gold};text-transform:uppercase;letter-spacing:.08em">Sign out</span>
    </div>
  </div>
`, 'me');

function pbTile(icon, label, val, unit) {
  return `<div class="card" style="padding:14px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
      ${icon}
      <span style="font-size:9px;font-weight:700;color:${T.textMuted};letter-spacing:.1em;text-transform:uppercase">${label}</span>
    </div>
    <div style="display:flex;align-items:baseline;gap:4px">
      <span class="big-num" style="font-size:34px">${val}</span>
      <span style="font-size:12px;font-weight:600;color:${T.textMuted}">${unit}</span>
    </div>
  </div>`;
}

function badge(emoji, name, earned) {
  return `<div style="background:${earned ? T.gold : T.darker};border:1px solid ${earned ? T.gold : T.border};border-radius:14px;padding:10px 6px;text-align:center;${earned ? '' : 'opacity:0.5'}">
    <div style="font-size:24px;margin-bottom:5px;line-height:1">${emoji}</div>
    <div style="font-size:9px;font-weight:700;color:${earned ? T.darkest : T.textMuted};line-height:1.3">${name}</div>
  </div>`;
}

function settRow(icon, label, sub = '') {
  return `<div class="row-item" style="margin-bottom:8px">
    <div class="row-ico">${icon}</div>
    <div style="flex:1">
      <div style="font-size:14px;font-weight:600;color:${T.text}">${label}</div>
      ${sub ? `<div style="font-size:11px;color:${T.textMuted};margin-top:2px;text-transform:uppercase;letter-spacing:.06em">${sub}</div>` : ''}
    </div>
    ${I.chev()}
  </div>`;
}

// ─── Render all screens ────────────────────────────────────────────────────────
const screens = [
  { name: '01-home',        html: homeHTML },
  { name: '02-book',        html: bookHTML },
  { name: '03-coach-video', html: workHTML },
  { name: '04-earn',        html: earnHTML },
  { name: '05-profile',     html: meHTML   },
];

// Write HTML files
for (const s of screens) {
  await writeFile(`app-store-screenshots/${s.name}.html`, s.html);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none',
         '--disable-gpu', '--disable-dev-shm-usage'],
});

// iPhone 6.5"  = 1242 × 2688  →  414 × 896 @ 3×
const IPHONE = { width: 414, height: 896, deviceScaleFactor: 3 };
// iPad 12.9"   = 2048 × 2732  →  1024 × 1366 @ 2×
const IPAD   = { width: 1024, height: 1366, deviceScaleFactor: 2 };

async function capture(page, htmlFile, outPath, viewport) {
  await page.setViewport(viewport);
  await page.goto(`file://${path.resolve(htmlFile)}`, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1200)); // font render settle
  await page.screenshot({ path: outPath, fullPage: false, type: 'png' });
  console.log(`  ✓  ${outPath}`);
}

const pg = await browser.newPage();

// Enable console errors for debugging
pg.on('console', msg => { if (msg.type() === 'error') console.error('[page]', msg.text()); });

console.log('\n📱  iPhone 6.5"  (1242 × 2688)');
for (const s of screens) {
  await capture(pg, `app-store-screenshots/${s.name}.html`, `app-store-screenshots/iphone/${s.name}.png`, IPHONE);
}

console.log('\n🖥   iPad 12.9"  (2048 × 2732)');
for (const s of screens) {
  await capture(pg, `app-store-screenshots/${s.name}.html`, `app-store-screenshots/ipad/${s.name}.png`, IPAD);
}

await browser.close();

// Clean up temp HTML
for (const s of screens) {
  await unlink(`app-store-screenshots/${s.name}.html`).catch(() => {});
}

console.log('\n✅  Done!');
console.log('   app-store-screenshots/iphone/  — 5 × 1242×2688 PNG');
console.log('   app-store-screenshots/ipad/    — 5 × 2048×2732 PNG');
