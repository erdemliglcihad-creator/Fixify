import { Platform, useColorScheme } from "react-native";
import { useSettings } from "../services/settings.ts";

// One red color world (Station palette: #CA0808, #120404, #270A0A, white, black), on black (dark) or
// light gray (light). The amber marker stays because it reads on arbitrary camera images.
const shared = {
  onAccent: "#FFFFFF",
  marker: "#F5A300",
  success: "#14894E",
  caution: "#B86E00",
  danger: "#C62828",
};

const light = { ...shared, background: "#ECECEE", surface: "#FFFFFF", raised: "#FFFFFF", hairline: "#DCDCE0", text: "#120404", secondary: "#6B5555", accent: "#CA0808", accentSoft: "#FBE3E3", hero: "#CA0808" };

// Hard contrast: black ground, deep red surfaces, pure white text, one saturated red to act on.
const dark: typeof light = {
  ...shared,
  background: "#000000",
  surface: "#120404",
  raised: "#270A0A",
  hairline: "#FFFFFF1F",
  text: "#FFFFFF",
  secondary: "#B8A4A4",
  accent: "#CA0808",
  accentSoft: "#270A0A",
  marker: "#FFB61E",
  success: "#34E89A",
  caution: "#FFB23E",
  danger: "#FF5A4F",
  hero: "#CA0808",
};

export type Palette = typeof light;

/** Everything colored that is not a plain surface or text: glows, lights, the moving edge. */
export const brand = {
  /** FixVoice orb and wave: main, depth, highlight. */
  orb: ["#CA0808", "#270A0A", "#FF6A5A"] as [string, string, string],
  /** The two drifting lights of the backdrop. */
  lights: ["#CA0808", "#FF5A4F"] as [string, string],
  /** The moving rainbow edge (first and last equal). */
  rainbow: ["#CA0808", "#FF3B2F", "#FF8A7A", "#FFE3DE", "#FFFFFF", "#FF5A4F", "#7A0505", "#E01414", "#CA0808"],
  /** Deep end of the accent gradient on round buttons. */
  accentDeep: "#7A0505",
  /** "r, g, b" of the glow under glass cards. */
  glowRgb: "202, 8, 8",
  /** Bright mark (e.g. the streak line). */
  mark: "#FF3B2F",
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
