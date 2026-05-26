# Ballpark — Client Preview via Expo Go

This document explains how to share the Ballpark app with clients using Expo Go (no TestFlight, no dev server, no same-network requirement).

## Stable Expo Go link

```
exp://u.expo.dev/4ce07796-bc3a-4c22-b3a1-502a1d5d6dfc?channel-name=preview
```

Clients scan the QR code below with the **Expo Go** app (iOS or Android) to open the latest published preview build.

### QR code

![Ballpark preview QR code](./client-preview-qr.png)

Point the **Expo Go** app's scanner (or your phone's camera on iOS) at the image above. The link is permanent — this QR code never changes. After each update is published, Expo Go fetches the new JS bundle automatically the next time the app is opened.

To regenerate the PNG locally:

```bash
node -e "
const https = require('https');
const fs = require('fs');
const url = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=2&data=' + encodeURIComponent('exp://u.expo.dev/4ce07796-bc3a-4c22-b3a1-502a1d5d6dfc?channel-name=preview');
https.get(url, res => res.pipe(fs.createWriteStream('docs/client-preview-qr.png')));
"
```

## Prerequisites for the client

1. Install **Expo Go** from the App Store or Google Play.
2. Open the camera app (iOS) or Expo Go's QR scanner (Android) and point it at the QR code.
3. The app opens and authenticates against the live Supabase project.

## Publishing an update

After any feature ships, publish a new update to the preview channel:

```bash
eas update --channel preview --message "Brief description of what changed"
```

Required environment variables must be set before publishing (they are embedded in the JS bundle):

```bash
export EXPO_PUBLIC_SUPABASE_URL="<your-supabase-url>"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="<your-supabase-anon-key>"
export EXPO_PUBLIC_TENANT_SLUG="infinitehitting"
```

EAS CLI reads these from the shell environment at publish time and bakes them into the over-the-air bundle.

## How it works

- `app.json` points `expo.updates.url` at `https://u.expo.dev/4ce07796-bc3a-4c22-b3a1-502a1d5d6dfc`.
- `expo.runtimeVersion.policy` is `sdkVersion` — a bundle is compatible with any Expo Go build on the same Expo SDK version.
- `eas.json` sets `channel: "preview"` on the `preview` build profile so EAS knows which update channel to target.
- EAS Update hosts the JS bundle; Expo Go fetches it over HTTPS when the app starts.

## Useful commands

| Command | Purpose |
|---|---|
| `eas update --channel preview --message "..."` | Publish a new JS bundle to the preview channel |
| `eas update:list` | See all published updates and their channels |
| `eas update:view <update-id>` | Inspect a specific update |

## Notes

- This is **JS-only** (OTA update). If native code changes (new Expo SDK, new native module), a full EAS Build + new Expo Go-compatible binary is needed.
- The client must have internet access — Expo Go fetches the bundle from EAS servers on launch.
- The `ballpark://` deep-link scheme (Supabase auth callback) works in Expo Go without any extra configuration.
