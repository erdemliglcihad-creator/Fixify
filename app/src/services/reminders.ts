// Optional, user-requested reminder to continue a session. Nothing is scheduled automatically.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { t } from "../i18n/index.ts";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function scheduleReminder(sessionId: string, title: string, afterSeconds: number): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;
  await Notifications.cancelScheduledNotificationAsync(`session-${sessionId}`).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: `session-${sessionId}`,
    content: { title: t("Continue your fix"), body: title, data: { sessionId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: afterSeconds },
  });
  return true;
}

export function cancelReminder(sessionId: string) {
  if (Platform.OS !== "web") Notifications.cancelScheduledNotificationAsync(`session-${sessionId}`).catch(() => {});
}

export function cancelAllReminders() {
  if (Platform.OS !== "web") Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}
