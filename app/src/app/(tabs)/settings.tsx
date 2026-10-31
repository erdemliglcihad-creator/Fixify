// Settings, like the iOS Settings app: a list of sections, each showing its current value;
// a tap opens the section as its own full-screen page (app/prefs/*, app/background.tsx).
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { t } from "../../i18n/index.ts";
import { useArea } from "../../services/area.ts";
import { storageBytes } from "../../services/images.ts";
import { activeBackground, useSettings } from "../../services/settings.ts";
import { Divider } from "../../ui/components.tsx";
import { Reveal } from "../../ui/reveal.tsx";
import { Screen } from "../../ui/Screen.tsx";
import { Group, Link } from "../../ui/settingsParts.tsx";
import { space, useTheme } from "../../ui/theme.ts";

const open = (href: Href) => () => router.push(href);

export default function Settings() {
  useArea("settings");
  const { c } = useTheme();
  const s = useSettings();
  const bg = activeBackground(s);
  const bgPreview = bg ? (bg.kind === "image" ? bg.uri : bg.thumb) : null;
  const appearance = { system: t("System"), light: t("Light"), dark: t("Dark") }[s.appearance];

  return (
    <Screen title={t("Settings")} contentStyle={{ gap: space.xl }}>
      <Reveal kind="build" delay={60}>
        <Group>
          <Link icon="contrast-outline" title={t("Appearance")} value={appearance} onPress={open("/prefs/appearance")} />
          <Divider />
          <Link
            title={t("Background")}
            value={bg ? (bg.kind === "video" ? t("Your video") : t("Your picture")) : t("Default")}
            onPress={open("/background")}
            leading={
              <View style={[styles.thumb, { borderColor: c.hairline, backgroundColor: c.raised }]}>
                {bgPreview ? <Image source={{ uri: bgPreview }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name={bg ? "videocam" : "sparkles-outline"} size={16} color={c.secondary} />}
              </View>
            }
          />
        </Group>
      </Reveal>

      <Reveal kind="build" delay={120}>
        <Group>
          <Link icon="person-outline" title={t("About you")} value={s.profile?.name.trim() || undefined} onPress={open("/prefs/profile")} />
          <Divider />
          <Link icon="mic-outline" title="FixVoice" value={s.voice === "male" ? t("Male voice") : t("Female voice")} onPress={open("/prefs/voice")} />
        </Group>
      </Reveal>

      <Reveal kind="build" delay={180}>
        <Group>
          <Link icon="shield-checkmark-outline" title={t("Privacy")} value={s.consent ? t("Allowed") : t("Off")} onPress={open("/prefs/privacy")} />
          <Divider />
          <Link icon="server-outline" title={t("Storage")} value={`${(storageBytes() / 1_000_000).toFixed(1)} MB`} onPress={open("/prefs/storage")} />
          <Divider />
          <Link icon="notifications-outline" title={t("Notifications")} value={s.reminders ? t("On") : t("Off")} onPress={open("/prefs/notifications")} />
        </Group>
      </Reveal>

      <Reveal kind="build" delay={240}>
        <Group>
          <Link icon="help-circle-outline" title={t("Help & feedback")} onPress={open("/prefs/help")} />
        </Group>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The background preview sits where the round icons are, shaped like a phone screen.
  thumb: { width: 36, height: 54, borderRadius: 9, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
});
