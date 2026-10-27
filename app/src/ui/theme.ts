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

const dark: typeof light = {
  background: "#0B0D12",
  surface: "#151922",
  raised: "#1D2230",
  hairline: "#2A3040",
  text: "#F2F4F8",
  secondary: "#9AA3B5",
  accent: "#5B8CFF",
  accentSoft: "#1B2747",
  onAccent: "#FFFFFF",
  marker: "#FFB61E",
  success: "#3DD68C",
  caution: "#F2A93B",
  danger: "#FF6B6B",
  hero: "#1D3FA8",
};

export type Palette = typeof light;

export function useTheme(): { c: Palette; dark: boolean } {
  const system = useColorScheme();
  const { appearance } = useSettings();
  const isDark = appearance === "dark" || (appearance === "system" && system === "dark");
  return { c: isDark ? dark : light, dark: isDark };
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { card: 22, control: 14, chip: 9 };
export const type = {
  // Size-specific tracking like SF Pro: tight for large text, neutral for body.
  display: { fontSize: 34, fontWeight: "700" as const, letterSpacing: -0.6, lineHeight: 40 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3, lineHeight: 28 },
  headline: { fontSize: 17, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 17 },
  caption: { fontSize: 14 },
  small: { fontSize: 12 },
};

export const mono = Platform.select({ ios: "Menlo", default: "monospace" });
