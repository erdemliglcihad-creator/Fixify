import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ProblemAnalysis, SessionStatus } from "../core/types.ts";
import { t } from "../i18n/index.ts";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { statusInfo, type IconName } from "./categories.ts";
import { Glass } from "./Glass.tsx";
import { radius, space, type, useTheme, type Palette, font } from "./theme.ts";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, dark } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }, !dark && styles.lift, style]}>{children}</View>;
}

/** Clean rounded Liquid Glass card for grouped content (not for safety warnings, those stay solid). */
export function GlassCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { dark } = useTheme();
  return (
    // Soft glow under the glass: a wide, faint blue light plus a tight dark shadow for contrast.
    <View style={[styles.glassGlow, { boxShadow: dark ? GLOW_DARK : GLOW_LIGHT }]}>
      <Glass style={[styles.glassCard, style]}>
        <LightCatch dark={dark} />
        {children}
      </Glass>
    </View>
  );
}

const GLOW_DARK = "0 18px 44px rgba(30, 91, 255, 0.16), 0 2px 12px rgba(0, 0, 0, 0.5)";
const GLOW_LIGHT = "0 14px 34px rgba(30, 91, 255, 0.12), 0 1px 4px rgba(16, 24, 48, 0.08)";

/** Light catching the top of the glass: a faint sheen and a bright rim that fades out to both sides. */
export function LightCatch({ dark }: { dark: boolean }) {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[dark ? "#FFFFFF12" : "#FFFFFF99", "#FFFFFF00"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["#FFFFFF00", dark ? "#FFFFFF59" : "#FFFFFFFF", "#FFFFFF00"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.rim}
      />
    </>
  );
}

/** Pill-shaped glass switcher. The bright inner pill glides to the chosen option on a spring; the label pops. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const { c, dark } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(options.findIndex(([v]) => v === value), 0);
  const slot = width / Math.max(options.length, 1);
  const x = useSharedValue(0);
  const ready = useSharedValue(false);

  useEffect(() => {
    if (!slot) return;
    // First layout: jump into place; afterwards glide (critically damped, no overshoot).
    x.value = ready.value ? withSpring(index * slot, { duration: 380, dampingRatio: 0.9 }) : index * slot;
    ready.value = true;
  }, [index, slot]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Glass style={styles.segment}>
      <View style={{ flex: 1, flexDirection: "row" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {slot > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentPill,
              { width: slot, backgroundColor: dark ? "#FFFFFF24" : "#FFFFFFF2", boxShadow: dark ? undefined : "0 1px 6px rgba(16, 24, 48, 0.12)" },
              pill,
            ]}
          />
        )}
        {options.map(([v, label]) => (
          <SegmentLabel
            key={v}
            label={label}
            on={value === v}
            onPress={() => {
              if (value !== v && Platform.OS !== "web") Haptics.selectionAsync();
              onChange(v);
            }}
            color={value === v ? c.text : c.secondary}
          />
        ))}
      </View>
    </Glass>
  );
}

function SegmentLabel({ label, on, onPress, color }: { label: string; on: boolean; onPress: () => void; color: string }) {
  const scale = useSharedValue(1);
  const mounted = useRef(false);
  useEffect(() => {
    // A small pop when this option becomes the chosen one (not on first appearance).
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (on) scale.value = withSequence(withTiming(1.08, { duration: 120 }), withSpring(1, { duration: 300, dampingRatio: 0.8 }));
  }, [on]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable onPress={onPress} style={styles.segmentItem} aria-selected={on} accessibilityRole="button">
      <Animated.Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[{ color, fontSize: 14, fontFamily: on ? font.semibold : font.medium }, animated]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
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
      <Text style={[type.small, { color: tint, fontFamily: font.semibold }]}>{text}</Text>
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
      <Text style={{ fontSize: size * 0.5, fontFamily: font.bold, color: "#000" }}>{number}</Text>
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
  const glass = kind === "primary" || kind === "secondary";
  const fg = kind === "primary" ? c.onAccent : kind === "danger" ? c.danger : c.accent;
  const inner = [styles.button, compact && { paddingVertical: 9, paddingHorizontal: 14 }];
  const label = (
    <>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[type.headline, { color: fg, fontSize: compact ? 15 : 17 }]}>{title}</Text>
    </>
  );
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={Boolean(disabled || loading)}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        onPress();
      }}
      // Feedback on touch-down, not on release.
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}
    >
      {glass ? (
        <Glass
          interactive
          tint={kind === "primary" ? c.accent : undefined}
          style={[inner, { borderRadius: radius.control }, kind === "primary" && { boxShadow: `0 8px 26px ${c.accent}55` }]}
        >
          {label}
        </Glass>
      ) : (
        <View style={[inner, { backgroundColor: kind === "danger" ? c.danger + "18" : "transparent" }]}>{label}</View>
      )}
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
        <Body style={{ fontFamily: font.semibold }}>{t("We recommend getting a qualified professional for this. Do not continue if you are unsure.")}</Body>
      )}
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }} />;
}

const styles = StyleSheet.create({
  glassCard: { borderRadius: radius.card, padding: space.l, gap: space.m, borderCurve: "continuous" },
  glassGlow: { borderRadius: radius.card, borderCurve: "continuous" },
  rim: { position: "absolute", top: 0, left: 24, right: 24, height: StyleSheet.hairlineWidth * 2 },
  segment: { flexDirection: "row", borderRadius: 999, padding: 4 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 9, paddingHorizontal: 6, borderRadius: 999 },
  segmentPill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 999 },
  card: { borderRadius: radius.card, padding: space.l, gap: space.m, borderWidth: StyleSheet.hairlineWidth, borderCurve: "continuous" },
  // Content cards are solid; a soft shadow separates them from the gradient behind.
  lift: { boxShadow: "0 1px 2px rgba(16, 24, 48, 0.06), 0 8px 24px rgba(16, 24, 48, 0.06)" },
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
