import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, Share, StyleSheet, Switch, Text, View } from "react-native";
import { t } from "../../i18n/index.ts";
import { storageBytes } from "../../services/images.ts";
import { cancelAllReminders } from "../../services/reminders.ts";
import { deleteEverything, deletePhotos, useSessions } from "../../services/sessions.ts";
import { updateSettings, useSettings, type Appearance, type VoiceGender } from "../../services/settings.ts";
import { isOpen } from "../../core/session.ts";
import { Caption, Divider, GlassCard, Segmented } from "../../ui/components.tsx";
import { confirmDestructive } from "../../ui/confirm.ts";
import type { IconName } from "../../ui/categories.ts";
import { radius, space, type, useTheme, font } from "../../ui/theme.ts";
import { Reveal, RevealWords } from "../../ui/reveal.tsx";
import { Screen } from "../../ui/Screen.tsx";
import Animated, { FadeIn } from "react-native-reanimated";
import { useArea } from "../../services/area.ts";

function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Label({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <Text style={[type.body, { color: c.text, flex: 1 }]}>{children}</Text>;
}

function Link({ icon, title, onPress, danger }: { icon: IconName; title: string; onPress: () => void; danger?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? c.danger : c.accent} />
      <Text style={[type.body, { color: danger ? c.danger : c.text, flex: 1 }]}>{title}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color={c.secondary} />}
    </Pressable>
  );
}

/** One settings group. Builds up as it scrolls into view: title word by word, then the card, then the note. */
function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.s }}>
      <View style={{ marginLeft: space.s }}>
        <RevealWords text={title.toUpperCase()} style={[type.caption, { color: c.secondary, fontFamily: font.semibold, letterSpacing: 0.6 }]} />
      </View>
      <Reveal kind="build" delay={80}>
        <GlassCard style={styles.group}>{children}</GlassCard>
      </Reveal>
      {footer ? (
        <Reveal kind="fade" delay={180}>
          {/* Keyed by the text, so a changed note cross-fades instead of jumping. */}
          <Animated.View key={footer} entering={FadeIn.duration(260)}>
            <Caption style={{ marginHorizontal: space.s }}>{footer}</Caption>
          </Animated.View>
        </Reveal>
      ) : null}
    </View>
  );
}

export default function Settings() {
  useArea("settings");
  const { c } = useTheme();
  const s = useSettings();
  const sessions = useSessions();
  const [bytes, setBytes] = useState(() => storageBytes());

  return (
    <Screen title={t("Settings")}>
      <Section title={t("Appearance")}>
        <Segmented<Appearance>
          value={s.appearance}
          options={[["system", t("System")], ["light", t("Light")], ["dark", t("Dark")]]}
          onChange={(appearance) => updateSettings({ appearance })}
        />
      </Section>

      <Section title={t("About you")} footer={t("Your answers stay on this iPhone. FixVoice only gets a short summary so it can help you better.")}>
        <Row>
          <Label>{t("Name")}</Label>
          <Caption>{s.profile?.name.trim() || "–"}</Caption>
        </Row>
        <Divider />
        <Link icon="sparkles-outline" title={t("Answer the questions again")} onPress={() => router.push("/onboarding?again=1")} />
      </Section>

      <Section title="FixVoice" footer={t("German or English follows the app language. Uses the iPhone's built-in voices for now.")}>
        <Segmented<VoiceGender>
          value={s.voice}
          options={[["female", t("Female voice")], ["male", t("Male voice")]]}
          onChange={(voice) => updateSettings({ voice })}
        />
      </Section>

      <Section title={t("Privacy")} footer={t("When off, nothing leaves this iPhone, and Fixify asks before the next analysis.")}>
        <Row>
          <Label>{t("Allow sending photos for analysis")}</Label>
          <Switch value={s.consent} onValueChange={(consent) => updateSettings({ consent })} trackColor={{ true: c.success }} thumbColor="#FFFFFF" />
        </Row>
        <Divider />
        <Link icon="shield-checkmark-outline" title={t("What Fixify processes")} onPress={() => router.push("/privacy")} />
      </Section>

      <Section title={t("Storage")} footer={Platform.OS === "web" ? t("In the web preview, photos are kept in the browser.") : t("Photos are stored once even if used in several sessions.")}>
        <Row>
          <Label>{t("Sessions")}</Label>
          <Caption>{String(sessions.length)}</Caption>
        </Row>
        <Row>
          <Label>{t("Photos")}</Label>
          <Caption>{`${(bytes / 1_000_000).toFixed(1)} MB`}</Caption>
        </Row>
        <Divider />
        <Text style={[type.body, { color: c.text }]}>{t("Delete photos of solved sessions")}</Text>
        <Segmented<string>
          value={String(s.autoDeleteDays)}
          options={[["0", t("Never")], ["7", "7 d"], ["30", "30 d"], ["90", "90 d"]]}
          onChange={(v) => updateSettings({ autoDeleteDays: Number(v) })}
        />
        <Divider />
        <Link
          icon="images-outline"
          title={t("Delete photos of completed sessions now")}
          onPress={() => {
            sessions.filter((x) => !isOpen(x.status) && x.images.length).forEach((x) => deletePhotos(x.id));
            setBytes(storageBytes());
          }}
        />
        <Link
          icon="trash-outline"
          danger
          title={t("Delete all Fixify data")}
          onPress={() =>
            confirmDestructive(t("Delete all Fixify data?"), t("All sessions, photos, analyses and history are removed from this iPhone. Your settings stay."), t("Delete everything"), async () => {
              await deleteEverything();
              cancelAllReminders();
              setBytes(storageBytes());
            })
          }
        />
      </Section>

      <Section title={t("Notifications")} footer={t("Only when you ask for a reminder in a session. Fixify sends no other notifications.")}>
        <Row>
          <Label>{t("Reminders for open sessions")}</Label>
          <Switch
            trackColor={{ true: c.success }}
            thumbColor="#FFFFFF"
            value={s.reminders}
            onValueChange={(reminders) => {
              updateSettings({ reminders });
              if (!reminders) cancelAllReminders();
            }}
          />
        </Row>
      </Section>

      <Section title={t("Help & feedback")}>
        <Link icon="help-circle-outline" title={t("How Fixify works")} onPress={() => router.push("/help")} />
        <Link icon="server-outline" title={t("Use your own server")} onPress={() => router.push("/server-help")} />
        <Link
          icon="mail-outline"
          title={t("Send feedback")}
          onPress={() => Share.share({ message: t("Fixify feedback (version %@, iOS %@)\n\nWhat happened:\n\nWhat I expected:\n", Constants.expoConfig?.version ?? "", String(Platform.Version)) })}
        />
        <Row>
          <Label>{t("Version")}</Label>
          <Caption>{`${Constants.expoConfig?.version ?? "–"} · Expo Go`}</Caption>
        </Row>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.m },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 32 },
});
