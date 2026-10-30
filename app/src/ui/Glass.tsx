// Liquid Glass for the floating control layer (tab bar, camera controls, buttons, headers).
// Content stays on solid surfaces; glass never sits on glass.
// iOS 26: native Liquid Glass (expo-glass-effect). Elsewhere: blurred material. "Reduce Transparency": solid.
import { BlurView } from "expo-blur";
import { GlassContainer, GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./theme.ts";

const nativeGlass = Platform.OS === "ios" && isGlassEffectAPIAvailable();

export function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") {
      const query = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-transparency: reduce)") : undefined;
      if (!query) return;
      setReduce(query.matches);
      const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    if (Platform.OS !== "ios") return; // The setting exists on iOS only.
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

type GlassProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** "regular" for chrome over content, "clear" over photos and the camera. */
  variant?: "regular" | "clear";
  /** Colored glass for the primary action. */
  tint?: string;
  /** Reacts to touch (iOS 26 shimmer/press). Use for buttons. */
  interactive?: boolean;
  /** Force dark glass, e.g. over the camera. */
  dark?: boolean;
};

export function Glass({ children, style, variant = "regular", tint, interactive, dark }: GlassProps) {
  const { c, dark: isDark } = useTheme();
  const reduce = useReduceTransparency();
  const scheme = dark ? "dark" : isDark ? "dark" : "light";

  if (reduce) {
    // Accessibility: a solid, clearly bordered surface instead of translucency.
    return (
      <View style={[{ backgroundColor: tint ?? c.raised, borderColor: c.hairline, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" }, style]}>
        {children}
      </View>
    );
  }

  if (nativeGlass) {
    return (
      <GlassView style={[{ overflow: "hidden" }, style]} glassEffectStyle={variant} tintColor={tint} isInteractive={interactive} colorScheme={scheme}>
        {children}
      </GlassView>
    );
  }

  // Fallback material: blur, a light veil and a bright edge where "light catches the glass".
  // Tinted glass skips the blur so the tint (with its own alpha) defines the surface, e.g. on the colored hero.
  const veil = tint
    ? tint.length === 9
      ? tint
      : tint + "D9"
    : scheme === "dark"
      ? variant === "clear"
        ? `${c.surface}55`
        : `${c.surface}99`
      : variant === "clear"
        ? "#FFFFFF33"
        : "#FFFFFFA6";
  return (
    <View style={[{ overflow: "hidden" }, style]}>
      {!tint && <BlurView intensity={variant === "clear" ? 30 : 60} tint={scheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: veil }]} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: StyleSheet.flatten(style)?.borderRadius, borderWidth: StyleSheet.hairlineWidth, borderColor: scheme === "dark" ? "#FFFFFF2E" : "#FFFFFFCC" }]}
      />
      {children}
    </View>
  );
}

/** Groups neighbouring glass elements so they merge like iOS 26 controls. */
export function GlassGroup({ children, style, spacing = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; spacing?: number }) {
  if (nativeGlass) return <GlassContainer spacing={spacing} style={style}>{children}</GlassContainer>;
  return <View style={style}>{children}</View>;
}

/** Kept for old call sites; screens sit on the plain background. */
export function Backdrop() {
  return null;
}

/** Scroll edge effect: content softly fades under the status bar instead of a hard cut. */
export function ScrollEdge() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const top = c.background;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[top + "B3", top + "00"]}
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 18 }}
    />
  );
}
