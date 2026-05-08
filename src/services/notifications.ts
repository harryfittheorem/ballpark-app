import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
// Kept for documentation: the JWT-decode helper and tenant_id lookup that
// used to live here moved into the `register_device_token` SECURITY
// DEFINER RPC. Client no longer needs to read the JWT tenant claim.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function devicePlatform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

/**
 * Persist (or refresh) the current device's Expo push token in
 * `public.device_tokens` for the signed-in user. Idempotent —
 * repeat sign-ins just bump `last_seen_at`.
 *
 * Routed through the `register_device_token` SECURITY DEFINER RPC
 * (see 20260508040000_v07_register_device_token_rpc.sql) instead of a
 * direct INSERT/UPSERT. The RPC handles the "one phone, two accounts"
 * reassignment atomically — a plain client DELETE+upsert can't, because
 * device_tokens RLS only lets a user delete their OWN rows, so a sibling
 * signing in on the same phone would leave the previous owner's row
 * intact and pushes would fan out to both accounts. The RPC pulls
 * user_id + tenant_id from auth.uid() / auth.jwt() server-side so the
 * client cannot impersonate another user.
 */
export async function upsertDeviceToken(expoPushToken: string): Promise<void> {
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr || !session?.user) {
    console.warn("[push] no active session; skipping device_tokens upsert");
    return;
  }

  const { error } = await supabase.rpc("register_device_token", {
    p_expo_push_token: expoPushToken,
    p_platform: devicePlatform(),
  });

  if (error) {
    console.warn("[push] register_device_token RPC failed", error.message);
  }
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push permission not granted");
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
    })
  ).data;

  console.log("Expo Push Token:", token);

  // Persist to device_tokens so the server can fan a push out later. Don't
  // throw on failure — the token is still useful in-memory and the next
  // sign-in will retry.
  try {
    await upsertDeviceToken(token);
  } catch (err) {
    console.warn("[push] upsertDeviceToken threw", err);
  }

  return token;
}
