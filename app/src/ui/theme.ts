import { Platform, useColorScheme } from "react-native";
import { useSettings } from "../services/settings.ts";

// One blue color world (Deep Nebula palette: #000008, #080523, #010094, #261598, #7548D2), on night black
// (dark) or light gray (light). The amber marker stays because it reads on arbitrary camera images.
const shared = {
  onAccent: "#FFFFFF",
  marker: "#F5A300",
  success: "#14894E",
  caution: "#B86E00",
  danger: "#C62828",
};

const light = { ...shared, background: "#ECECEE", surface: "#FFFFFF", raised: "#FFFFFF", hairline: "#DCDCE0", text: "#080523", secondary: "#5D5A78", accent: "#261598", accentSoft: "#E6E3FA", hero: "#010094" };

// Hard contrast: night black ground, deep blue surfaces, pure white text, violet to act on (bright enough on black).
const dark: typeof light = {
  ...shared,
  background: "#000008",
  surface: "#080523",
  raised: "#120C3A",
  hairline: "#FFFFFF1F",
  text: "#FFFFFF",
  secondary: "#A6A3C2",
  accent: "#7548D2",
  accentSoft: "#120C3A",
  marker: "#FFB61E",
  success: "#34E89A",
  caution: "#FFB23E",
  danger: "#FF5A4F",
  hero: "#261598",
};

export type Palette = typeof light;

/** Everything colored that is not a plain surface or text: glows, lights, the moving edge. */
export const brand = {
  /** FixVoice orb and wave: main, depth, highlight. */
  orb: ["#261598", "#080523", "#9C7BFF"] as [string, string, string],
  /** The two drifting lights of the backdrop. */
  lights: ["#010094", "#7548D2"] as [string, string],
  /** The moving rainbow edge (first and last equal). */
  rainbow: ["#261598", "#3D2BD8", "#7548D2", "#C9B8FF", "#FFFFFF", "#9C7BFF", "#010094", "#2E1FB0", "#261598"],
  /** Deep end of the accent gradient on round buttons. */
  accentDeep: "#150A66",
  /** "r, g, b" of the glow under glass cards. */
  glowRgb: "117, 72, 210",
  /** Bright mark (e.g. the streak line). */
  mark: "#9C7BFF",
};

/** Areas share one glow; the type stays so screens can still mark where they are. */
export type Area = "home" | "fixbot" | "library" | "settings" | "session";

export function useTheme(): { c: Palette; dark: boolean; brand: typeof brand } {
  const system = useColorScheme();
  const { appearance } = useSettings();
  const isDark = appearance === "dark" || (appearance === "system" && system === "dark");
  return { c: isDark ? dark : light, dark: isDark, brand };
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

// Generous spacing: large gutters, few boxes.
export const space = { xs: 4, s: 10, m: 16, l: 24, xl: 36, xxl: 56 };
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

/** Soft white glow behind headlines in dark mode (more presence, still readable). */
export const textGlow = (dark: boolean) =>
  dark ? { textShadowColor: "rgba(255, 255, 255, 0.3)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 } : {};

export const mono = Platform.select({ ios: "Menlo", default: "monospace" });
