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
  secondary: "#5A6478",
  accent: "#2459F5",
  accentSoft: "#E4ECFF",
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
  secondary: "#8A92A4",
  accent: "#2F6BFF",
  accentSoft: "#0B1838",
  onAccent: "#FFFFFF",
  marker: "#FFB61E",
  success: "#3DD68C",
  caution: "#F2A93B",
  danger: "#FF6B6B",
  hero: "#1E5BFF",
};

/** Areas share one blue glow now; the type stays so screens can still mark where they are. */
export type Area = "home" | "fixbot" | "library" | "settings" | "session";
const BLUE = { glow: ["#1E5BFF", "#0B2A6B", "#5AA8FF"] as [string, string, string], accent: "#2F6BFF" };
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

/** Font families (loaded in the root layout). Montserrat for everything, Neue Montreal as the accent. */
export const font = {
  light: "Montserrat-Light",
  regular: "Montserrat-Regular",
  medium: "Montserrat-Medium",
  semibold: "Montserrat-SemiBold",
  bold: "Montserrat-Bold",
  accentLight: "NeueMontreal-Light",
  accent: "NeueMontreal-Regular",
  accentMedium: "NeueMontreal-Medium",
  accentBold: "NeueMontreal-Bold",
};

// Minimal, airy spacing: large gutters, few boxes.
export const space = { xs: 4, s: 8, m: 14, l: 22, xl: 32, xxl: 48 };
export const radius = { card: 24, control: 18, chip: 10 };
export const type = {
  // Size-specific tracking: tight for large text, neutral for body.
  display: { fontSize: 34, fontFamily: font.medium, letterSpacing: -1, lineHeight: 40 },
  hero: { fontSize: 38, fontFamily: font.medium, letterSpacing: -1.4, lineHeight: 44 },
  title: { fontSize: 22, fontFamily: font.semibold, letterSpacing: -0.4, lineHeight: 28 },
  headline: { fontSize: 16, fontFamily: font.semibold, letterSpacing: -0.2 },
  body: { fontSize: 16, fontFamily: font.regular, lineHeight: 23 },
  caption: { fontSize: 14, fontFamily: font.regular },
  small: { fontSize: 12, fontFamily: font.medium },
  /** Small accent labels (Neue Montreal), e.g. "Hello" above a headline. */
  eyebrow: { fontSize: 15, fontFamily: font.accent, letterSpacing: 0.2 },
};

/** Soft glow behind headlines in dark mode (more presence, still readable). */
export const textGlow = (dark: boolean) =>
  dark ? { textShadowColor: "rgba(110, 160, 255, 0.45)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 } : {};

export const mono = Platform.select({ ios: "Menlo", default: "monospace" });
