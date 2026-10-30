// Web preview version of the backdrop: two red radial lights (static) and grain.
import { StyleSheet, View } from "react-native";
import { Grain } from "./Grain";
import { useTheme } from "./theme.ts";

export function Ambient() {
  const { dark } = useTheme();
  const s = dark ? "66" : "2E";
  const light = {
    backgroundImage: `radial-gradient(circle at 82% 12%, #CA0808${s} 0%, #CA080800 60%), radial-gradient(circle at 12% 86%, #FF5A4F${s} 0%, #FF5A4F00 55%)`,
  };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, light as object]} />
      <Grain opacity={dark ? 0.16 : 0.1} />
    </View>
  );
}
