import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { t } from "../../i18n/index.ts";
import { storageBytes } from "../../services/images.ts";
import { cancelAllReminders } from "../../services/reminders.ts";
import { deleteEverything, deletePhotos, useSessions } from "../../services/sessions.ts";
import { settingsStore, updateSettings, useSettings, type Appearance, type ColorTheme, type VoiceGender } from "../../services/settings.ts";
import { emptyProfile, type Profile } from "../../core/profile.ts";
import { DEVICE_OPTIONS, HELP_OPTIONS, TOPIC_OPTIONS } from "../../ui/OnboardingFlow.tsx";
import { isOpen } from "../../core/session.ts";
import { Caption, Divider, GlassCard, IconCircle, Segmented } from "../../ui/components.tsx";
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
      <IconCircle icon={icon} size={36} color={danger ? c.danger : undefined} />
      <Text style={[type.body, { color: danger ? c.danger : c.text, flex: 1 }]}>{title}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color={c.secondary} />}
    </Pressable>
  );
}

/** Change the profile in place: any field, any time (no need to go through the questions again). */
function updateProfile(patch: Partial<Profile>) {
  updateSettings({ profile: { ...(settingsStore.get().profile ?? emptyProfile()), ...patch } });
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function ProfileEditor({ profile }: { profile: Profile }) {
  const { c } = useTheme();
  return (
    <>
      <Row>
        <Label>{t("Name")}</Label>
        <TextInput
          value={profile.name}
          onChangeText={(name) => updateProfile({ name })}
          placeholder={t("Your first name")}
          placeholderTextColor={c.secondary}
          autoCapitalize="words"
          autoComplete="given-name"
          returnKeyType="done"
          style={[type.body, styles.nameInput, { color: c.text }]}
        />
      </Row>
      <Divider />
      <ChipGroup
        title={t("What you want to fix")}
        options={Object.values(TOPIC_OPTIONS)}
        isOn={(v) => profile.topics.includes(v as Profile["topics"][number])}
        onToggle={(v) => updateProfile({ topics: toggle(profile.topics, v as Profile["topics"][number]) })}
      />
      <Divider />
      <ChipGroup
        title={t("Your devices")}
        options={Object.values(DEVICE_OPTIONS)}
        isOn={(v) => profile.devices.includes(v as Profile["devices"][number])}
        onToggle={(v) => updateProfile({ devices: toggle(profile.devices, v as Profile["devices"][number]) })}
      />
      <Divider />
      <ChipGroup
        title={t("How you like help")}
        options={Object.values(HELP_OPTIONS)}
        isOn={(v) => profile.help === v}
        onToggle={(v) => updateProfile({ help: profile.help === v ? null : (v as Profile["help"]) })}
      />
    </>
  );
}

function ChipGroup({ title, options, isOn, onToggle }: { title: string; options: { value: string; label: () => string; icon: IconName }[]; isOn: (v: string) => boolean; onToggle: (v: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.chipGroup}>
      <Text style={[type.caption, { color: c.secondary }]}>{title}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = isOn(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => onToggle(o.value)}
              aria-selected={on}
              accessibilityRole="button"
              style={({ pressed }) => [styles.chip, { backgroundColor: on ? c.accent : c.raised, borderColor: on ? c.accent : c.hairline, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name={o.icon} size={14} color={on ? c.onAccent : c.secondary} />
              <Text style={{ color: on ? c.onAccent : c.text, fontSize: 14, ...(on ? font.semibold : font.medium) }}>{o.label()}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One settings group. Builds up as it scrolls into view: title word by word, then the card, then the note. */
function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.s }}>
      <View style={{ marginLeft: space.s }}>
        <RevealWords text={title.toUpperCase()} style={[type.caption, { color: c.secondary, ...font.semibold, letterSpacing: 0.6 }]} />
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
        <Segmented<ColorTheme>
          value={s.colorTheme ?? "red"}
          options={[["red", t("Red")], ["blue", t("Blue")]]}
          onChange={(colorTheme) => updateSettings({ colorTheme })}
        />
      </Section>

      <Section title={t("About you")} footer={t("Your answers stay on this iPhone. FixVoice only gets a short summary so it can help you better.")}>
        <ProfileEditor profile={s.profile ?? emptyProfile()} />
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
  nameInput: { flex: 1, textAlign: "right", paddingVertical: 4 },
  chipGroup: { gap: space.s, paddingVertical: space.m },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  group: { gap: space.m },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 32 },
});
