import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { t } from "../../i18n/index.ts";
import { useTheme } from "../../ui/theme.ts";

/**
 * Apple's own tab bar (UITabBarController): real Liquid Glass with the sliding lens, finger dragging and
 * merging surfaces on iOS 26. Scan uses the system's separate round button (the "search" slot).
 * Screens place their own safe-area and tab-bar spacing, so the automatic content insets are off
 * (otherwise everything moved down by the status bar height a second time).
 */
export default function TabsLayout() {
  const { c } = useTheme();
  const pathname = usePathname();
  return (
    <NativeTabs
      tintColor={c.accent}
      // The bar always stays; iOS cannot shrink it only at the very end of a list.
      minimizeBehavior="never"
      // The scan tab is the camera itself: full screen, no tab bar.
      hidden={pathname === "/scan"}
    >
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>{t("Home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fixvoice" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="waveform" />
        <NativeTabs.Trigger.Label>FixVoice</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: "books.vertical", selected: "books.vertical.fill" }} />
        <NativeTabs.Trigger.Label>{t("Library")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>{t("Settings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan" role="search" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon sf="viewfinder" />
        <NativeTabs.Trigger.Label>{t("Scan")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
