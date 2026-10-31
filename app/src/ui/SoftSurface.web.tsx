// Web preview version of the soft card: CSS gradients, the glows and rim as box shadows, grain.
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Grain } from "./Grain";
import type { SoftPalette } from "./soft.ts";

export function SoftSurface({
  palette,
  radius,
  glow = 1,
  grain = 0.22,
  style,
  children,
}: {
  palette: SoftPalette;
  radius: number;
  glow?: number;
  grain?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const blobs = palette.blobs.map((b) => `radial-gradient(circle at ${b.x * 100}% ${b.y * 100}%, ${b.color} 0%, ${b.color}00 ${b.r * 100}%)`);
  const stops = palette.colors.map((col, i) => `${col} ${palette.positions[i] * 100}%`).join(", ");
  const alpha = Math.round(0.6 * glow * 255).toString(16).padStart(2, "0");
  const layer = {
    borderRadius: radius,
    overflow: "hidden",
    backgroundImage: [...blobs, `linear-gradient(180deg, ${stops})`].join(", "),
    // Outer glow spilling out below, light glowing in from the edges and pooling at the bottom, thin rim.
    boxShadow: `0 14px 50px ${palette.glow}${alpha}, inset 0 -26px 34px -8px ${palette.inner}, inset 0 0 22px ${palette.inner}40, inset 0 0 0 1.5px ${palette.rim}55`,
  };
  return (
    <View style={style}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, layer as object]}>
        <Grain opacity={grain} />
      </View>
      {children}
    </View>
  );
}
