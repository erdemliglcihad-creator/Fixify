import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { StyleSheet, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../../i18n/index.ts";
import type { IconName } from "../../ui/categories.ts";
import { Glass } from "../../ui/Glass.tsx";
import { useTheme } from "../../ui/theme.ts";

const icon =
  (name: IconName, active: IconName) =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : name} size={size - 2} color={typeof color === "string" ? color : undefined} />
  );

export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.secondary,
        // Floating Liquid Glass bar, like iOS 26. Content scrolls underneath it.
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom - 6, 12),
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
          borderRadius: 32,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
        },
        tabBarItemStyle: { borderRadius: 26 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarBackground: () => <Glass style={[StyleSheet.absoluteFill, { borderRadius: 32 }]} />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("Home"), tabBarIcon: icon("home-outline", "home") }} />
      {/* The scan tab is the camera itself: full screen, no tab bar. */}
      <Tabs.Screen name="scan" options={{ title: t("Scan"), tabBarStyle: { display: "none" }, tabBarIcon: icon("scan-outline", "scan") }} />
      <Tabs.Screen name="sessions" options={{ title: t("Sessions"), tabBarIcon: icon("build-outline", "build") }} />
      <Tabs.Screen name="library" options={{ title: t("Library"), tabBarIcon: icon("library-outline", "library") }} />
      <Tabs.Screen name="settings" options={{ title: t("Settings"), tabBarIcon: icon("settings-outline", "settings") }} />
    </Tabs>
  );
}
