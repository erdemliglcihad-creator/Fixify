import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { t } from "../../i18n/index.ts";
import { useTheme } from "../../ui/theme.ts";

/**
 * Apple's own tab bar (UITabBarController): real Liquid Glass with the sliding lens, finger dragging and
 * merging surfaces on iOS 26. Scan uses the system's separate round button (the "search" slot).
 */
export default function TabsLayout() {
  const { c } = useTheme();
  const pathname = usePathname();
  return (
    <NativeTabs
      tintColor={c.accent}
      minimizeBehavior="onScrollDown"
      // The scan tab is the camera itself: full screen, no tab bar.
      hidden={pathname === "/scan"}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>{t("Home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fixvoice">
        <NativeTabs.Trigger.Icon sf="waveform" />
        <NativeTabs.Trigger.Label>FixVoice</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon sf={{ default: "books.vertical", selected: "books.vertical.fill" }} />
        <NativeTabs.Trigger.Label>{t("Library")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>{t("Settings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan" role="search">
        <NativeTabs.Trigger.Icon sf="viewfinder" />
        <NativeTabs.Trigger.Label>{t("Scan")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
