---
name: Portal port routing (Replit dev)
description: Why the portal must run on port 5000 and what breaks if it doesn't
---

# Portal must run on port 5000 in Replit dev

## The rule
The Portal dev workflow command must be `cd portal && npm run dev -- -p 5000` with `outputType: "webview"` and `waitForPort: 5000`. Never revert to port 3000.

## Why
Replit routes all public traffic (REPLIT_DEV_DOMAIN) to the configured webview port (5000). If the portal runs on port 3000:
- The preview pane shows blank/0.0.0.0 (webview expects port 5000)
- The Replit dev domain serves whatever else owns port 5000 (historically the Expo web workflow), not the portal
- Stripe Connect callbacks land on the wrong page after onboarding

## How to apply
- Portal dev workflow: `cd portal && npm run dev -- -p 5000`, outputType webview, waitForPort 5000
- Do NOT have an "Expo web" workflow on port 5000 — it conflicts
- Expo Go physical device routing still works: REPLIT_DEV_DOMAIN → portal (5000) → expo-platform header → portal rewrites to Metro (localhost:8080)
- `portal/next.config.ts` already has the beforeFiles rewrites for expo-platform → localhost:8080
- `portal/middleware.ts` already short-circuits auth for expo-platform requests
