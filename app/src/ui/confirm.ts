import { Alert, Platform } from "react-native";
import { t } from "../i18n/index.ts";

/** Destructive confirmation. Alert is a no-op in the web preview, so it falls back to window.confirm there. */
export function confirmDestructive(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: t("Cancel"), style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}

export function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}
