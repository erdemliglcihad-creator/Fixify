import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ProblemAnalysis, SessionStatus } from "../core/types.ts";
import { t } from "../i18n/index.ts";
import { statusInfo, type IconName } from "./categories.ts";
import { radius, space, type, useTheme, type Palette } from "./theme.ts";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }, style]}>{children}</View>;
}

export function SectionTitle({ title, icon }: { title: string; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header">
      {icon && <Ionicons name={icon} size={18} color={c.accent} />}
      <Text style={[type.headline, { color: c.text }]}>{title}</Text>
    </View>
  );
}

export function Body({ children, secondary, style }: { children: ReactNode; secondary?: boolean; style?: object }) {
  const { c } = useTheme();
  return <Text style={[type.body, { color: secondary ? c.secondary : c.text }, style]}>{children}</Text>;
}

export function Caption({ children, color, style }: { children: ReactNode; color?: string; style?: object }) {
  const { c } = useTheme();
  return <Text style={[type.caption, { color: color ?? c.secondary }, style]}>{children}</Text>;
}

export const toneColor = (c: Palette, tone: "accent" | "success" | "caution" | "danger" | "secondary") =>
  ({ accent: c.accent, success: c.success, caution: c.caution, danger: c.danger, secondary: c.secondary })[tone];

export function Chip({ text, color, icon }: { text: string; color?: string; icon?: IconName }) {
  const { c } = useTheme();
  const tint = color ?? c.accent;
  return (
    <View style={[styles.chip, { backgroundColor: tint + "22" }]}>
      {icon && <Ionicons name={icon} size={12} color={tint} />}
      <Text style={[type.small, { color: tint, fontWeight: "600" }]}>{text}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  const { c } = useTheme();
  const info = statusInfo[status];
  return <Chip text={info.title()} icon={info.icon} color={toneColor(c, info.tone)} />;
}

/** Number marker used both on images and in lists, so the two can be matched at a glance. */
export function MarkerBadge({ number, size = 24, estimated, dimmed }: { number: number; size?: number; estimated?: boolean; dimmed?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityLabel={t("Marker %lld", number)}
      style={[
        styles.marker,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.marker,
          borderStyle: estimated ? "dashed" : "solid",
          opacity: dimmed ? 0.45 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.5, fontWeight: "800", color: "#000" }}>{number}</Text>
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { c } = useTheme();
  return (
    <View
      style={[styles.progressTrack, { backgroundColor: c.hairline }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <View style={{ width: `${Math.round(value * 100)}%`, height: "100%", borderRadius: 3, backgroundColor: color ?? c.accent }} />
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  icon?: IconName;
  kind?: "primary" | "secondary" | "plain" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({ title, onPress, icon, kind = "primary", disabled, loading, style, compact }: ButtonProps) {
  const { c } = useTheme();
  const bg = kind === "primary" ? c.accent : kind === "danger" ? c.danger + "18" : kind === "secondary" ? c.accentSoft : "transparent";
  const fg = kind === "primary" ? c.onAccent : kind === "danger" ? c.danger : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={Boolean(disabled || loading)}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        compact && { paddingVertical: 9, paddingHorizontal: 14 },
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[type.headline, { color: fg, fontSize: compact ? 15 : 17 }]}>{title}</Text>
    </Pressable>
  );
}

export function InfoRow({ icon, title, detail }: { icon: IconName; title: string; detail?: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { alignItems: "flex-start" }]} accessible>
      <Ionicons name={icon} size={20} color={c.accent} style={{ width: 24, marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Body>{title}</Body>
        {detail ? <Caption>{detail}</Caption> : null}
      </View>
    </View>
  );
}

export function SafetyBanner({ safety }: { safety: ProblemAnalysis["safety"] }) {
  const { c } = useTheme();
  if (safety.level === "none" && !safety.recommendProfessional) return null;
  const color = safety.level === "danger" ? c.danger : c.caution;
  return (
    <View style={[styles.banner, { backgroundColor: color + "1F", borderColor: color + "66" }]} accessible>
      <View style={styles.row}>
        <Ionicons name={safety.level === "danger" ? "alert-circle" : "warning"} size={20} color={color} />
        <Text style={[type.headline, { color }]}>{safety.level === "danger" ? t("Safety risk") : t("Be careful")}</Text>
      </View>
      {safety.warnings.map((w) => (
        <Body key={w}>{w}</Body>
      ))}
      {safety.recommendProfessional && (
        <Body style={{ fontWeight: "600" }}>{t("We recommend getting a qualified professional for this. Do not continue if you are unsure.")}</Body>
      )}
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.l, gap: space.m, borderWidth: StyleSheet.hairlineWidth, borderCurve: "continuous" },
  row: { flexDirection: "row", alignItems: "center", gap: space.s },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.chip, alignSelf: "flex-start" },
  marker: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#FFFFFFE6" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", flex: 1 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.s,
    paddingVertical: 14,
    paddingHorizontal: space.l,
    borderRadius: radius.control,
    borderCurve: "continuous",
  },
  banner: { borderRadius: radius.card, padding: space.l, gap: space.s, borderWidth: 1 },
});
