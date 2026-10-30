// Web preview version of the backdrop: two radial lights in the theme colors (static) and grain.
import { StyleSheet, View } from "react-native";
import { Grain } from "./Grain";
import { useTheme } from "./theme.ts";

export function Ambient() {
  const { dark, brand } = useTheme();
  const s = dark ? "66" : "2E";
  const light = {
    backgroundImage: `radial-gradient(circle at 82% 12%, ${brand.lights[0]}${s} 0%, ${brand.lights[0]}00 60%), radial-gradient(circle at 12% 86%, ${brand.lights[1]}${s} 0%, ${brand.lights[1]}00 55%)`,
  };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, light as object]} />
      <Grain opacity={dark ? 0.16 : 0.1} />
    </View>
  );
}
