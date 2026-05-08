/**
 * Dynamic Expo config.
 *
 * Wraps the static `app.json` so we can wire up universal links / Android
 * App Links for the Supabase email-confirmation flow without hard-coding the
 * production domain. Set `EXPO_PUBLIC_AUTH_REDIRECT_HOST` in EAS / Replit
 * Secrets to e.g. `app.ballpark.com`. When unset (local dev / Expo Go) the
 * app falls back to the `ballpark://` custom scheme registered in app.json,
 * which is enough for round-tripping confirmation emails on a personal
 * device but won't work for users who don't yet have the app installed.
 */

const base = require("./app.json");

module.exports = () => {
  const config = JSON.parse(JSON.stringify(base));
  const expo = config.expo;
  const authHost = process.env.EXPO_PUBLIC_AUTH_REDIRECT_HOST;

  // EAS config
  expo.owner = "harjinderharry";
  expo.extra = expo.extra ?? {};
  expo.extra.eas = expo.extra.eas ?? {};
  expo.extra.eas.projectId = "4ce07796-bc3a-4c22-b3a1-502a1d5d6dfc";

  // Universal links / deep links
  if (authHost) {
    expo.ios = expo.ios ?? {};
    expo.ios.associatedDomains = Array.from(
      new Set([...(expo.ios.associatedDomains ?? []), `applinks:${authHost}`]),
    );

    expo.android = expo.android ?? {};
    expo.android.intentFilters = [
      ...(expo.android.intentFilters ?? []),
      {
        action: "VIEW",
        autoVerify: true,
        category: ["DEFAULT", "BROWSABLE"],
        data: [
          {
            scheme: "https",
            host: authHost,
            pathPrefix: "/auth/callback",
          },
        ],
      },
    ];
  }

  return config;
};
