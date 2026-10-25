import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { t } from "../../i18n/index.ts";
import { useTheme } from "../../ui/theme.ts";
import type { IconName } from "../../ui/categories.ts";

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size} color={typeof color === "string" ? color : undefined} />;

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.secondary,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.hairline },
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: c.text },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("Home"), headerShown: false, tabBarIcon: icon("home-outline") }} />
      {/* The scan tab is the camera itself: full screen, no tab bar. */}
      <Tabs.Screen name="scan" options={{ title: t("Scan"), headerShown: false, tabBarStyle: { display: "none" }, tabBarIcon: icon("scan-outline") }} />
      <Tabs.Screen name="sessions" options={{ title: t("Sessions"), headerTitle: t("Fix Sessions"), tabBarIcon: icon("build-outline") }} />
      <Tabs.Screen name="library" options={{ title: t("Library"), tabBarIcon: icon("library-outline") }} />
      <Tabs.Screen name="settings" options={{ title: t("Settings"), tabBarIcon: icon("settings-outline") }} />
    </Tabs>
  );
}
