import type { ComponentProps } from "react";
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ProblemCategory, SessionStatus } from "../core/types.ts";
import { t } from "../i18n/index.ts";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export const categoryInfo: Record<ProblemCategory, { title: () => string; icon: IconName; emoji: string; tip: () => string }> = {
  computer: { emoji: "💻", title: () => t("Computer"), icon: "desktop-outline", tip: () => t("Fill the frame with the error message or the setting you are stuck on.") },
  network: { emoji: "📶", title: () => t("Wi-Fi & Bluetooth"), icon: "wifi-outline", tip: () => t("Photograph the connection screen or the device's status lights.") },
  peripheral: { emoji: "🖨️", title: () => t("Devices & accessories"), icon: "print-outline", tip: () => t("Show the device and its cable or status lights.") },
  software: { emoji: "📱", title: () => t("Apps & settings"), icon: "apps-outline", tip: () => t("Fill the frame with the error message or the setting you are stuck on.") },
  object: { emoji: "🔩", title: () => t("Everyday objects"), icon: "construct-outline", tip: () => t("Show the part that is broken, with something for scale if you can.") },
  appliance: {
    emoji: "🧺",
    title: () => t("Appliances"),
    icon: "home-outline",
    tip: () => t("Show the display, error code or the area that is not working. Unplug before touching anything inside."),
  },
  document: { emoji: "📄", title: () => t("Documents & forms"), icon: "document-text-outline", tip: () => t("Hold the phone straight above the page so the text is sharp.") },
  general: { emoji: "✨", title: () => t("Something else"), icon: "help-circle-outline", tip: () => t("Show what is wrong. You can add a description afterwards.") },
};

export const suggestedCategories: ProblemCategory[] = ["computer", "network", "peripheral", "appliance", "object", "document"];

export const statusInfo: Record<SessionStatus, { title: () => string; icon: IconName; tone: "accent" | "success" | "caution" | "danger" }> = {
  pendingAnalysis: { title: () => t("Not analyzed"), icon: "hourglass-outline", tone: "accent" },
  active: { title: () => t("In progress"), icon: "build-outline", tone: "accent" },
  solved: { title: () => t("Solved"), icon: "checkmark-circle", tone: "success" },
  partiallySolved: { title: () => t("Partly solved"), icon: "contrast-outline", tone: "caution" },
  unresolved: { title: () => t("Not solved"), icon: "close-circle-outline", tone: "danger" },
  unclear: { title: () => t("Result unclear"), icon: "help-circle-outline", tone: "caution" },
};
