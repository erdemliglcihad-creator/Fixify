import { Tabs } from "expo-router";
import { t } from "../../i18n/index.ts";
import { TabBar } from "../../ui/TabBar.tsx";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      // Transparent scenes: the global aurora glows through, and morphs when the area changes.
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" }, animation: "shift" }}
    >
      <Tabs.Screen name="index" options={{ title: t("Home") }} />
      <Tabs.Screen name="fixvoice" options={{ title: "FixVoice" }} />
      {/* The scan tab is the camera itself: full screen, no tab bar. The bar shows it as the raised middle button. */}
      <Tabs.Screen name="scan" options={{ title: t("Scan"), tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="library" options={{ title: t("Library") }} />
      <Tabs.Screen name="settings" options={{ title: t("Settings") }} />
    </Tabs>
  );
}
