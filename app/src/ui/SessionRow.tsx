import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { currentAnalysis, currentStep, progress } from "../core/session.ts";
import type { FixSession } from "../core/types.ts";
import { lang, t } from "../i18n/index.ts";
import { agoParts, formatDate } from "../core/format.ts";
import { categoryInfo } from "./categories.ts";
import { Caption, ProgressBar, StatusBadge } from "./components.tsx";
import { space, type, useTheme } from "./theme.ts";

export function Thumb({ session, size }: { session: FixSession; size: number }) {
  const { c } = useTheme();
  const first = session.images[0];
  if (first) return <Image source={{ uri: first.uri }} style={{ width: size, height: size, borderRadius: 12 }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={session.category ? categoryInfo[session.category].icon : "chatbubble-ellipses-outline"} size={size * 0.4} color={c.accent} />
    </View>
  );
}

export function relativeTime(ms: number) {
  const ago = agoParts(ms, Date.now());
  switch (ago.unit) {
    case "now":
      return t("just now");
    case "minutes":
      return t("%lld min ago", ago.n);
    case "hours":
      return t("%lld h ago", ago.n);
    case "yesterday":
      return t("yesterday");
    case "days":
      return t("%lld days ago", ago.n);
    default:
      return formatDate(ms, lang);
  }
}

export function SessionRow({ session, onPress }: { session: FixSession; onPress: () => void }) {
  const { c } = useTheme();
  const analysis = currentAnalysis(session);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button">
      <Thumb session={session} size={52} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[type.headline, { color: c.text }]} numberOfLines={1}>
          {analysis?.title ?? session.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
          <StatusBadge status={session.status} />
          <Caption>{relativeTime(session.updatedAt)}</Caption>
        </View>
        {analysis?.steps.length ? <ProgressBar value={progress(session)} /> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.secondary} />
    </Pressable>
  );
}

export function ActiveCard({ session, onPress }: { session: FixSession; onPress: () => void }) {
  const { c } = useTheme();
  const step = currentStep(session);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: 220, gap: space.s, opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button">
      <View style={{ height: 124, borderRadius: 16, overflow: "hidden" }}>
        {session.images[0] ? (
          <Image source={{ uri: session.images[0].uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name={session.category ? categoryInfo[session.category].icon : "chatbubble-ellipses-outline"} size={32} color={c.accent} />
          </View>
        )}
        <View style={styles.progressPill}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{Math.round(progress(session) * 100)}%</Text>
        </View>
      </View>
      <Text style={[type.headline, { color: c.text }]} numberOfLines={1}>
        {currentAnalysis(session)?.title ?? session.title}
      </Text>
      <Caption style={{ marginTop: -4 }}>{step ? t("Next: %@", step.title) : t("Not analyzed")}</Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.m, paddingVertical: space.s },
  progressPill: { position: "absolute", top: 8, right: 8, backgroundColor: "#00000088", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
});
