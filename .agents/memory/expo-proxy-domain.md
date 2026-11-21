---
name: Expo Go proxy domain
description: Which Replit domain to use as EXPO_MANIFEST_PROXY_URL so Expo Go on a physical device can reach Metro through the portal proxy.
---

# Expo Go proxy domain on Replit (riker.replit.dev)

## Rule
Use the current `REPLIT_DEV_DOMAIN` (not `REPLIT_EXPO_DEV_DOMAIN`) for Expo's manifest/packager proxies and the development portal API origin.

**Why:** The Expo-specific subdomain did not reliably route external traffic to the portal. Also, task forks have different development domains: copying a literal portal URL left phone checklists and enrollment calling an old workspace even though local API tests passed.

## How to apply
Derive development origins at workflow launch instead of copying a development hostname between forks. Keep the production portal URL independent; do not replace it with a preview URL.
- No `--clear` flag (clears bundle cache = slow cold-start every restart).
- No port number appended to the domain URL.
- Always re-scan the QR in Expo Go after restarting the workflow.
