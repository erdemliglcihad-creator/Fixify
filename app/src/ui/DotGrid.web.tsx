// Web preview version of the dot grid: a repeating radial gradient, fading toward the bottom.
import { StyleSheet, View } from "react-native";
import { useTheme } from "./theme.ts";

export function DotGrid({ spacing = 18, radius = 1.1, alpha = 0.16 }: { spacing?: number; radius?: number; alpha?: number }) {
  const { dark } = useTheme();
  const rgb = dark ? "255, 255, 255" : "8, 5, 35";
  const style = {
    backgroundImage: `radial-gradient(circle, rgba(${rgb}, ${dark ? alpha : alpha * 0.8}) ${radius}px, transparent ${radius + 0.8}px)`,
    backgroundSize: `${spacing}px ${spacing}px`,
    maskImage: "linear-gradient(180deg, #000 35%, rgba(0, 0, 0, 0.35) 100%)",
  };
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, style as object]} />;
}
