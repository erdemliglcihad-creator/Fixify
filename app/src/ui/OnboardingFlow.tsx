// First-launch questions, one per screen. Answers stay on this iPhone; FixVoice gets a short summary
// (core/profile.ts) so its answers fit the person. Everything is optional and can be redone in Settings.
// Used as a layer above the app on first launch, and as a screen from Settings.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useState, type ComponentProps } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInRight, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEVICES, emptyProfile, HELP, SOURCES, TOPICS, WHY, type Profile } from "../core/profile.ts";
import { t } from "../i18n/index.ts";
import { Button, IconCircle, LightCatch } from "./components.tsx";
import { PressScale } from "./motion.tsx";
import { RevealWords } from "./reveal.tsx";
import { font, space, textGlow, type, useTheme } from "./theme.ts";

type Icon = ComponentProps<typeof Ionicons>["name"];
type Option = { value: string; label: () => string; icon: Icon };

const WHY_OPTIONS: Record<(typeof WHY)[number], Option> = {
  broken: { value: "broken", label: () => t("Something is broken"), icon: "construct-outline" },
  understand: { value: "understand", label: () => t("I want to understand tech better"), icon: "bulb-outline" },
  family: { value: "family", label: () => t("I help family and friends"), icon: "people-outline" },
  work: { value: "work", label: () => t("For work"), icon: "briefcase-outline" },
  curious: { value: "curious", label: () => t("Just curious"), icon: "sparkles-outline" },
};
const TOPIC_OPTIONS: Record<(typeof TOPICS)[number], Option> = {
  computer: { value: "computer", label: () => t("Computer"), icon: "desktop-outline" },
  network: { value: "network", label: () => t("Wi-Fi & internet"), icon: "wifi-outline" },
  phone: { value: "phone", label: () => t("Phone & tablet"), icon: "phone-portrait-outline" },
  appliance: { value: "appliance", label: () => t("Appliances"), icon: "home-outline" },
  tv: { value: "tv", label: () => t("TV & streaming"), icon: "tv-outline" },
  home: { value: "home", label: () => t("Home & tools"), icon: "hammer-outline" },
  car: { value: "car", label: () => t("Car & bike"), icon: "car-outline" },
};
const DEVICE_OPTIONS: Record<(typeof DEVICES)[number], Option> = {
  iphone: { value: "iphone", label: () => "iPhone", icon: "logo-apple" },
  android: { value: "android", label: () => "Android", icon: "logo-android" },
  mac: { value: "mac", label: () => "Mac", icon: "laptop-outline" },
  windows: { value: "windows", label: () => t("Windows PC"), icon: "logo-windows" },
  ipad: { value: "ipad", label: () => "iPad", icon: "tablet-portrait-outline" },
  printer: { value: "printer", label: () => t("Printer"), icon: "print-outline" },
  smarttv: { value: "smarttv", label: () => t("Smart TV"), icon: "tv-outline" },
  console: { value: "console", label: () => t("Game console"), icon: "game-controller-outline" },
  smarthome: { value: "smarthome", label: () => t("Smart home"), icon: "bulb-outline" },
};
const HELP_OPTIONS: Record<(typeof HELP)[number], Option> = {
  voice: { value: "voice", label: () => t("Talk it through (FixVoice)"), icon: "mic-outline" },
  camera: { value: "camera", label: () => t("Show it (camera)"), icon: "camera-outline" },
  read: { value: "read", label: () => t("Read short steps"), icon: "reader-outline" },
};
const SOURCE_OPTIONS: Record<(typeof SOURCES)[number], Option> = {
  tiktok: { value: "tiktok", label: () => "TikTok", icon: "logo-tiktok" },
  instagram: { value: "instagram", label: () => "Instagram", icon: "logo-instagram" },
  youtube: { value: "youtube", label: () => "YouTube", icon: "logo-youtube" },
  friends: { value: "friends", label: () => t("Friends & family"), icon: "people-outline" },
  appstore: { value: "appstore", label: () => "App Store", icon: "storefront-outline" },
  other: { value: "other", label: () => t("Somewhere else"), icon: "ellipsis-horizontal" },
};

type Step =
  | { kind: "name"; question: () => string; hint: () => string }
  | { kind: "single"; key: "why" | "help" | "source"; question: () => string; hint?: () => string; options: Option[] }
  | { kind: "multi"; key: "topics" | "devices"; question: () => string; hint: () => string; options: Option[] };

const STEPS: Step[] = [
  { kind: "name", question: () => t("What should we call you?"), hint: () => t("For a personal greeting. Optional.") },
  { kind: "single", key: "why", question: () => t("Why did you get Fixify?"), options: Object.values(WHY_OPTIONS) },
  { kind: "multi", key: "topics", question: () => t("What do you want to fix most?"), hint: () => t("Choose as many as you like."), options: Object.values(TOPIC_OPTIONS) },
  { kind: "multi", key: "devices", question: () => t("Which devices do you have?"), hint: () => t("So FixVoice can give steps for your devices."), options: Object.values(DEVICE_OPTIONS) },
  { kind: "single", key: "help", question: () => t("How do you like to get help?"), options: Object.values(HELP_OPTIONS) },
  { kind: "single", key: "source", question: () => t("How did you hear about Fixify?"), options: Object.values(SOURCE_OPTIONS) },
];

export function OnboardingFlow({ initial, onDone }: { initial?: Profile | null; onDone: (profile: Profile | null) => void }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile>(() => initial ?? emptyProfile());
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  function finish(saved: Profile | null) {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone(saved);
  }

  function next() {
    if (last) return finish(profile);
    setIndex((i) => i + 1);
  }

  function pick(key: "why" | "help" | "source", value: string) {
    setProfile((p) => ({ ...p, [key]: p[key] === value ? null : value }));
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }

  function toggle(key: "topics" | "devices", value: string) {
    setProfile((p) => {
      const list = p[key] as string[];
      return { ...p, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }

  const answered =
    step.kind === "name" ? profile.name.trim().length > 0 : step.kind === "single" ? profile[step.key] !== null : (profile[step.key] as string[]).length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + space.s }]}>
        <Pressable
          onPress={() => (index > 0 ? setIndex(index - 1) : null)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("Back")}
          style={{ opacity: index > 0 ? 1 : 0 }}
          disabled={index === 0}
        >
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Progress index={index} total={STEPS.length} />
        <Pressable onPress={() => finish(profile.name || profile.why || profile.topics.length ? profile : null)} hitSlop={12} accessibilityRole="button">
          <Text style={{ color: c.secondary, ...font.medium, fontSize: 15 }}>{t("Skip")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        {/* Keyed by the step: each question slides in from the right. */}
        <Animated.View key={index} entering={FadeInRight.duration(380)} style={{ gap: space.xxl }}>
          <View style={{ gap: space.s }}>
            <Text style={[type.eyebrow, { color: c.accent, fontSize: 13, letterSpacing: 1.2 }]}>{`${index + 1} / ${STEPS.length}`}</Text>
            <RevealWords text={step.question()} style={[type.display, { color: c.text }, textGlow(dark)]} stagger={55} />
            {step.kind !== "single" || step.hint ? <Text style={[type.body, { color: c.secondary, marginTop: space.xs }]}>{step.hint?.()}</Text> : null}
          </View>

          {step.kind === "name" ? (
            <View style={{ gap: space.m }}>
              <View style={[styles.nameField, { backgroundColor: c.surface, borderColor: c.hairline }]}>
                <TextInput
                  value={profile.name}
                  onChangeText={(name) => setProfile((p) => ({ ...p, name }))}
                  placeholder={t("Your first name")}
                  placeholderTextColor={c.secondary}
                  autoFocus
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                  returnKeyType="next"
                  onSubmitEditing={next}
                  maxLength={40}
                  style={{ color: c.text, fontSize: 20, ...font.medium, flex: 1 }}
                />
              </View>
              <View style={styles.privacy}>
                <Ionicons name="lock-closed-outline" size={14} color={c.secondary} />
                <Text style={[type.caption, { color: c.secondary, flex: 1 }]}>
                  {t("Your answers stay on this iPhone. FixVoice only gets a short summary so it can help you better.")}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.grid}>
              {step.options.map((o, i) => {
                const on = step.kind === "single" ? profile[step.key] === o.value : (profile[step.key] as string[]).includes(o.value);
                return (
                  <Animated.View key={o.value} entering={FadeInRight.delay(60 + i * 35).duration(320)} style={styles.cell}>
                    <Choice option={o} on={on} multi={step.kind === "multi"} onPress={() => (step.kind === "single" ? pick(step.key, o.value) : toggle(step.key, o.value))} />
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.l, paddingTop: space.s }}>
        <Button title={last ? t("Let's go") : answered ? t("Continue") : t("Skip this question")} kind={answered || last ? "primary" : "secondary"} onPress={next} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Progress({ index, total }: { index: number; total: number }) {
  const { c } = useTheme();
  return (
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: index + 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <Segment key={i} filled={i <= index} color={c.accent} track={c.hairline} />
      ))}
    </View>
  );
}

function Segment({ filled, color, track }: { filled: boolean; color: string; track: string }) {
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: withSpring(filled ? 1 : 0, { duration: 450, dampingRatio: 1 }) }] }));
  return (
    <View style={[styles.segment, { backgroundColor: track }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, transformOrigin: "left", boxShadow: `0 0 8px ${color}AA` }, fill]} />
    </View>
  );
}

function Choice({ option, on, multi, onPress }: { option: Option; on: boolean; multi: boolean; onPress: () => void }) {
  const { c, dark } = useTheme();
  return (
    <PressScale onPress={onPress} haptic={false} scaleTo={0.96} accessibilityRole={multi ? "checkbox" : "radio"} aria-checked={on} accessibilityLabel={option.label()}>
      {/* A solid surface, not live glass: glass that fades in renders grey on iOS, so cards looked uneven. */}
      <View
        style={[
          styles.choice,
          { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.hairline },
          on ? { boxShadow: `0 0 0 1px ${c.accent}40, 0 10px 28px ${c.accent}40` } : { boxShadow: dark ? "0 6px 18px rgba(0, 0, 0, 0.35)" : "0 4px 14px rgba(16, 24, 48, 0.06)" },
        ]}
      >
        <LightCatch dark={dark} />
        <IconCircle icon={option.icon} size={44} active={on} />
        <Text style={{ color: c.text, fontSize: 15, ...(on ? font.semibold : font.medium), flex: 1 }} numberOfLines={2}>
          {option.label()}
        </Text>
        <Ionicons
          name={on ? (multi ? "checkmark-circle" : "radio-button-on") : multi ? "ellipse-outline" : "radio-button-off"}
          size={22}
          color={on ? c.accent : c.hairline}
        />
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.l, paddingHorizontal: space.l },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  grid: { gap: space.m + 2 },
  cell: {},
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.l,
    paddingVertical: space.m,
    paddingLeft: space.m,
    paddingRight: space.l,
    borderRadius: 22,
    minHeight: 68,
    borderWidth: 1,
    overflow: "hidden",
    borderCurve: "continuous",
  },
  choiceIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  nameField: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: space.xl, height: 60, borderWidth: 1 },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: space.s, paddingHorizontal: space.s },
});
