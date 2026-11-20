# Clubhouse mobile rebrand

## Names and scope

- iOS Home Screen and Android launcher label: **Clubhouse** (`expo.name`).
- Full product name and intended App Store Connect listing title:
  **Clubhouse by Infinite Hitting** — 29 characters including spaces, within
  Apple's 30-character limit. The listing title is separate from the device label.
- Splash: white batter silhouette, **CLUBHOUSE**, then **BY INFINITE HITTING**
  on the existing dark background. Both text-free app icons are retained.
- Native permissions, sign-in/onboarding, welcome, coach, HitTrax, kiosk, sharing,
  and payment-sheet copy now use Clubhouse. Payment sheets use the full product
  name, retaining Infinite Hitting attribution rather than inventing a new
  “Clubhouse Sports” merchant. Stripe accounts, charge routing, statement
  descriptors, and merchant records are not changed.
- The portal and external services are unchanged.

## Identity that must remain unchanged

| Setting | Existing value |
| --- | --- |
| iOS bundle identifier | `com.fittheorem.ballpark` |
| Android package | `com.fittheorem.ballpark` |
| Expo slug | `ballpark-app` |
| URL scheme | `ballpark` |
| EAS project ID | `4ce07796-bc3a-4c22-b3a1-502a1d5d6dfc` |
| Update URL | `https://u.expo.dev/4ce07796-bc3a-4c22-b3a1-502a1d5d6dfc` |
| EAS owner | `harjinderharry` |
| App Store submission target | `6773873454` |

`eas.json` remains unchanged, including build profiles/channels and the
`production-infinitehitting` tenant setting. HTTPS links still use
`EXPO_PUBLIC_AUTH_REDIRECT_HOST` when configured. Existing `ballpark://` links,
auth redirects, push links, support/privacy URLs, and local storage keys are
deliberately not renamed. No `clubhouse://` alias is registered.

## Verification and release checklist

1. Run `node scripts/check-mobile-branding.cjs` for configuration, artwork,
   icon integrity, mobile-copy, and representative deep-link checks. It checks
   the resolved Expo configuration both without a redirect host and with a
   synthetic HTTPS host; it does not contact or change external services.
2. **Make new native iOS and Android builds through the existing EAS profiles.**
   A JavaScript/OTA update cannot change the installed launcher label, native
   splash resources, or compiled permission descriptions. Do not create a new
   app record, signing identity, bundle/package ID, or EAS project.
3. Before submitting, install the release builds on a small phone, a modern
   Android phone (including Android 12+ launch behavior), and an iPad/tablet.
   Cold-launch each and check the short launcher label, unclipped and readable
   splash text, permission wording, and absence of stale Ballpark launch art.
   OS launch snapshots can be cached: if an upgraded device shows stale art,
   compare with a clean test install/reboot without deleting real user data.
   Expo Go and web previews do not verify compiled native launch resources.
4. In the installed builds, open existing `ballpark:///auth/callback` email
   links and configured HTTPS confirmation links; also check
   `ballpark://me/payment-method`, waitlist claims, coach threads, and assignments.
   Use the existing auth redirect allow-list; do not change it for this rebrand.
5. Separately, an authorized release owner must change the **existing** App
   Store Connect listing title to **Clubhouse by Infinite Hitting**. Changing
   `expo.name` does not update store metadata.
6. Verify both payment sheets retain the Infinite Hitting attribution and
   existing connected-account behavior. This change only edits display text;
   it does not change charges or saved payment methods.

No native build, submission, production deployment, App Store Connect edit,
or payment-provider metadata change is performed by this code change.

## Checks performed in this workspace

- Branding/configuration/deep-link checks passed with
  `node scripts/check-mobile-branding.cjs`.
- Production JavaScript/Hermes exports succeeded for both iOS and Android with
  `npx expo export --platform ios --platform android --output-dir generated-artifacts/clubhouse/native-export`.
  These are local bundle exports, not installable native builds or submissions.
- Reviewed the source artwork and layout proofs at small-phone, Android 200dp
  logo, and tablet sizes. Proofs are under
  `generated-artifacts/clubhouse/splash-size-proofs.png` (ignored generated output).
- ESLint on the changed mobile screens reported zero errors and two existing
  hook-dependency warnings.
- `npm run typecheck` is not clean in the existing repository. A mobile-only
  check found 17 errors; comparing their files, positions, and diagnostic codes
  with the unchanged Git baseline confirmed all 17 predate this change.
  The broader check also includes unrelated portal/mockup errors.
- The Expo workflow starts, but the web preview cannot bundle the existing
  native-only Stripe module (`codegenNativeCommands`). No web workaround was
  introduced in this native-only branding task. Successful native bundle
  exports provide the relevant compilation check.
- Actual OS launch behavior, cached launch snapshots, and installed launcher
  labels still need the release-build device checks above. Layout proofs and
  Expo Go/web cannot replace that final release QA.
