---
name: Expo Go proxy domain
description: Which Replit domain to use as EXPO_MANIFEST_PROXY_URL so Expo Go on a physical device can reach Metro through the portal proxy.
---

# Expo Go proxy domain on Replit (riker.replit.dev)

## Rule
Use `REPLIT_DEV_DOMAIN` (not `REPLIT_EXPO_DEV_DOMAIN`) as `EXPO_MANIFEST_PROXY_URL` and `EXPO_PACKAGER_PROXY_URL` in the "Expo dev (proxy)" workflow.

**Why:** `REPLIT_EXPO_DEV_DOMAIN` (`*.expo.riker.replit.dev`) does not reliably route external HTTPS traffic to the portal (port 3000). `REPLIT_DEV_DOMAIN` (`*.riker.replit.dev`) does — it is the domain the Replit preview pane uses and is confirmed to reach local port 3000 from outside.

## How to apply
Correct workflow command:
```
EXPO_PACKAGER_PROXY_URL="https://$REPLIT_DEV_DOMAIN" EXPO_MANIFEST_PROXY_URL="https://$REPLIT_DEV_DOMAIN" npx expo start --port 8080 < /dev/null
```
- No `--clear` flag (clears bundle cache = slow cold-start every restart).
- No port number appended to the domain URL.
- Always re-scan the QR in Expo Go after restarting the workflow.

## Supporting architecture
- Portal (port 3000) `next.config.ts` beforeFiles rewrites forward any request with `expo-platform` header to `http://localhost:8080` (Metro).
- `portal/middleware.ts` short-circuits Supabase auth for expo-platform requests so they reach the rewrite layer.
- Metro binds to `::` (all interfaces) on port 8080.
- Self-referential curl from inside the Replit container always returns 502 — Replit loop-prevention policy; does NOT indicate the proxy is broken.
