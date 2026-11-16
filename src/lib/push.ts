import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { api } from "@/lib/api";

/** Show notifications as banners even while the app is open. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

let currentToken: string | null = null;

const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Ask permission, create the Android channel and return this install's Expo push token (null when unavailable). */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators/emulators can't receive push
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Leads & follow-ups",
      // eslint-disable-next-line import/namespace -- enum is re-exported from a .types module the lint resolver misses
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#5B3FD6",
      sound: "default",
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? existing.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;
  const id = projectId();
  if (!id) {
    console.warn("[push] No EAS projectId in app.json (run `npx eas-cli init`). Push is disabled.");
    return null;
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  return data;
}

/** Remove this device's token from the server (call before signing out). */
export async function unregisterPush() {
  if (!currentToken) return;
  const token = currentToken;
  currentToken = null;
  await api("/crm/push/expo/unregister", { method: "POST", body: { token } }).catch(() => {});
}

/** Open the screen a notification points at (web-style links like /crm/leads/123). */
function openFromData(data: Record<string, unknown> | undefined) {
  const link = typeof data?.link === "string" ? data.link : "";
  const lead = link.match(/\/crm\/leads\/(\d+)/);
  if (lead) router.push(`/lead/${lead[1]}`);
  else if (link.includes("followups")) router.push("/followups");
  else router.push("/notifications");
}

/**
 * While signed in: register for push, keep data fresh when a notification arrives,
 * and route taps (including the tap that cold-started the app) to the right screen.
 */
export function usePushNotifications(enabled: boolean) {
  const qc = useQueryClient();
  const handledLaunch = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getPushToken();
        if (!token || cancelled) return;
        currentToken = token;
        await api("/crm/push/expo", { method: "POST", body: { token, platform: Platform.OS, deviceName: Device.deviceName ?? Device.modelName ?? undefined } });
      } catch (e) {
        console.warn("[push] registration failed", e);
      }
    })();

    const refresh = () => ["notifications", "dashboard", "leads", "followups"].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
    const received = Notifications.addNotificationReceivedListener(refresh);
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => { refresh(); openFromData(r.notification.request.content.data); });
    const appState = AppState.addEventListener("change", (s) => { if (s === "active") void qc.invalidateQueries({ queryKey: ["notifications"] }); });

    if (!handledLaunch.current) {
      handledLaunch.current = true;
      void Notifications.getLastNotificationResponseAsync().then((r) => {
        if (r && !cancelled) { setTimeout(() => openFromData(r.notification.request.content.data), 900); void Notifications.clearLastNotificationResponseAsync(); }
      });
    }
    return () => { cancelled = true; received.remove(); tapped.remove(); appState.remove(); };
  }, [enabled, qc]);
}
