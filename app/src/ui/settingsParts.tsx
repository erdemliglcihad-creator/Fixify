// Building blocks for the settings pages: rows, links, groups with a note, the page frame,
// and the profile editor. Every settings section is its own full-screen page (app/prefs/*).
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { emptyProfile, type Profile } from "../core/profile.ts";
import { t } from "../i18n/index.ts";
import { settingsStore, updateSettings } from "../services/settings.ts";
import type { IconName } from "./categories.ts";
import { Caption, Divider, GlassCard, IconCircle } from "./components.tsx";
import { DEVICE_OPTIONS, HELP_OPTIONS, TOPIC_OPTIONS } from "./OnboardingFlow.tsx";
import { font, space, type, useTheme } from "./theme.ts";

/** A light tick for every switch and chip, like the iOS Settings app. */
export const tick = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync();
};

/** One settings page: native header with its title, content scrolling underneath. */
export function SettingsPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
        {children}
      </ScrollView>
    </>
  );
}

/** A group of rows on glass, with an optional note underneath. */
export function Group({ footer, children }: { footer?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.s }}>
      <GlassCard style={styles.group}>{children}</GlassCard>
      {footer ? <Caption style={{ marginHorizontal: space.s }}>{footer}</Caption> : null}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <Text style={[type.body, { color: c.text, flex: 1 }]}>{children}</Text>;
}

/** A row with a round icon that does something or opens a page; `value` shows the current setting. */
export function Link({ icon, title, value, onPress, danger, leading }: { icon?: IconName; title: string; value?: string; onPress: () => void; danger?: boolean; leading?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]} accessibilityRole="button">
      {leading ?? (icon ? <IconCircle icon={icon} size={36} color={danger ? c.danger : undefined} /> : null)}
      <Text style={[type.body, { color: danger ? c.danger : c.text, flex: 1 }]} numberOfLines={2}>
        {title}
      </Text>
      {value ? (
        <Text style={[type.caption, { color: c.secondary, maxWidth: "45%" }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
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

export function ProfileEditor({ profile }: { profile: Profile }) {
  const { c } = useTheme();
  return (
    <>
      <Group>
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
      </Group>
      <Group>
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
      </Group>
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
              onPress={() => {
                tick();
                onToggle(o.value);
              }}
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

const styles = StyleSheet.create({
  page: { padding: space.l, gap: space.xl, paddingBottom: space.xxl * 2 },
  group: { gap: space.m },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 32 },
  nameInput: { flex: 1, textAlign: "right", paddingVertical: 4 },
  chipGroup: { gap: space.s, paddingVertical: space.m },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
});
