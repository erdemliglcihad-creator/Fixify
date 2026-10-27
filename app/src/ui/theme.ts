import { Platform, useColorScheme } from "react-native";
import { useSettings } from "../services/settings.ts";

// Same tokens as the iOS app: one restrained accent (signal blue) and an amber marker color
// that stays readable on arbitrary camera images.
const light = {
  background: "#F4F5F7",
  surface: "#FFFFFF",
  raised: "#FFFFFF",
  hairline: "#E3E6EB",
  text: "#10131A",
  secondary: "#5B6270",
  accent: "#1F5EFF",
  accentSoft: "#E6EEFF",
  onAccent: "#FFFFFF",
  marker: "#F5A300",
  success: "#14894E",
  caution: "#B86E00",
  danger: "#C62828",
  hero: "#1546D6",
};

// Dark-first: deep near-black base so the area gradients glow, solid cards for content.
const dark: typeof light = {
  background: "#06070B",
  surface: "#13151C",
  raised: "#1B1E28",
  hairline: "#FFFFFF17",
  text: "#F5F6FA",
  secondary: "#9BA1B4",
  accent: "#6E95FF",
  accentSoft: "#1A2340",
  onAccent: "#FFFFFF",
  marker: "#FFB61E",
  success: "#3DD68C",
  caution: "#F2A93B",
  danger: "#FF6B6B",
  hero: "#2A55E8",
};

/** Each area has its own glow; the backdrop morphs between them when you switch tabs. */
export type Area = "home" | "fixbot" | "library" | "settings" | "session";
export const areaColors: Record<Area, { glow: [string, string, string]; accent: string; emoji: string }> = {
  home: { glow: ["#2F6BFF", "#7A4DFF", "#00B8FF"], accent: "#6E95FF", emoji: "🛠️" },
  fixbot: { glow: ["#6A4DFF", "#2453FF", "#C04DFF"], accent: "#9C86FF", emoji: "🤖" },
  library: { glow: ["#FF6A2A", "#FF9F45", "#C2381A"], accent: "#FF9A5C", emoji: "📚" },
  settings: { glow: ["#4B5CFF", "#2A3B78", "#6A7BFF"], accent: "#8C9BFF", emoji: "⚙️" },
  session: { glow: ["#2F6BFF", "#00B3A4", "#5B3FFF"], accent: "#5FD1C4", emoji: "🔧" },
};

export type Palette = typeof light;

export function useTheme(): { c: Palette; dark: boolean } {
  const system = useColorScheme();
  const { appearance } = useSettings();
  const isDark = appearance === "dark" || (appearance === "system" && system === "dark");
  return { c: isDark ? dark : light, dark: isDark };
}

// Airy spacing like iOS: generous gutters, cards with room to breathe.
export const space = { xs: 4, s: 8, m: 12, l: 20, xl: 28, xxl: 40 };
export const radius = { card: 28, control: 18, chip: 10 };
export const type = {
  // Size-specific tracking like SF Pro: tight for large text, neutral for body.
  display: { fontSize: 36, fontWeight: "700" as const, letterSpacing: -0.9, lineHeight: 42 },
  hero: { fontSize: 40, fontWeight: "700" as const, letterSpacing: -1.2, lineHeight: 46 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3, lineHeight: 28 },
  headline: { fontSize: 17, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 17 },
  caption: { fontSize: 14 },
  small: { fontSize: 12 },
};

export const mono = Platform.select({ ios: "Menlo", default: "monospace" });
