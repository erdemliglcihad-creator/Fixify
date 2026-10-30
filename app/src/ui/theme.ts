import { Platform, useColorScheme } from "react-native";
import { useSettings } from "../services/settings.ts";

// One color world: black with a deep blue glow, an ice-blue accent, and an amber marker color
// that stays readable on arbitrary camera images.
const light = {
  background: "#F3F6FB",
  surface: "#FFFFFF",
  raised: "#FFFFFF",
  hairline: "#DCE3EE",
  text: "#070B14",
  secondary: "#4F5A72",
  accent: "#2F64FF",
  accentSoft: "#E2EAFF",
  onAccent: "#FFFFFF",
  marker: "#F5A300",
  success: "#14894E",
  caution: "#B86E00",
  danger: "#C62828",
  hero: "#1546D6",
};

const dark: typeof light = {
  // Hard contrast: near-black ground, graphite surfaces with a visible edge, pure white text,
  // and one saturated blue for everything you can act on.
  background: "#010204",
  surface: "#0D1017",
  raised: "#171B24",
  hairline: "#FFFFFF1C",
  text: "#FFFFFF",
  secondary: "#A0A9C0",
  accent: "#3D7BFF",
  accentSoft: "#0E1E4A",
  onAccent: "#FFFFFF",
  marker: "#FFB61E",
  success: "#34E89A",
  caution: "#FFB23E",
  danger: "#FF5E7A",
  hero: "#3D6BFF",
};

/** Areas share one blue glow now; the type stays so screens can still mark where they are. */
export type Area = "home" | "fixbot" | "library" | "settings" | "session";
// Vibrant: electric blue, a violet depth and a cyan highlight.
const BLUE = { glow: ["#3D6BFF", "#6A2BD9", "#4FD2FF"] as [string, string, string], accent: "#3D7BFF" };
export const areaColors: Record<Area, { glow: [string, string, string]; accent: string }> = {
  home: BLUE,
  fixbot: BLUE,
  library: BLUE,
  settings: BLUE,
  session: BLUE,
};

export type Palette = typeof light;

export function useTheme(): { c: Palette; dark: boolean } {
  const system = useColorScheme();
  const { appearance } = useSettings();
  const isDark = appearance === "dark" || (appearance === "system" && system === "dark");
  return { c: isDark ? dark : light, dark: isDark };
}

/**
 * SF Pro, Apple's system font, in every weight. On iOS no family is needed (the system picks SF Pro Text or
 * Display by size); the web preview asks for the same font. Spread into a style: `{ ...font.medium }`.
 */
const SYSTEM = Platform.select({ web: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif", default: undefined });
const weight = (fontWeight: "300" | "400" | "500" | "600" | "700") => ({ fontFamily: SYSTEM, fontWeight });
export const font = {
  light: weight("300"),
  regular: weight("400"),
  medium: weight("500"),
  semibold: weight("600"),
  bold: weight("700"),
  accentLight: weight("300"),
  accent: weight("400"),
  accentMedium: weight("500"),
  accentBold: weight("700"),
};

// Minimal, airy spacing: large gutters, few boxes.
export const space = { xs: 4, s: 8, m: 14, l: 22, xl: 32, xxl: 48 };
export const radius = { card: 24, control: 18, chip: 10 };
export const type = {
  // Size-specific tracking: tight for large text, neutral for body.
  display: { fontSize: 34, ...font.bold, letterSpacing: 0.2, lineHeight: 41 },
  hero: { fontSize: 38, ...font.bold, letterSpacing: -0.4, lineHeight: 44 },
  title: { fontSize: 22, ...font.semibold, letterSpacing: -0.3, lineHeight: 28 },
  headline: { fontSize: 16, ...font.semibold, letterSpacing: -0.2 },
  body: { fontSize: 16, ...font.regular, lineHeight: 23 },
  caption: { fontSize: 14, ...font.regular },
  small: { fontSize: 12, ...font.medium },
  /** Small labels, e.g. "Hello" above a headline. */
  eyebrow: { fontSize: 15, ...font.regular, letterSpacing: -0.2 },
};

/** Soft glow behind headlines in dark mode (more presence, still readable). */
export const textGlow = (dark: boolean) =>
  dark ? { textShadowColor: "rgba(120, 150, 255, 0.55)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 } : {};

export const mono = Platform.select({ ios: "Menlo", default: "monospace" });
