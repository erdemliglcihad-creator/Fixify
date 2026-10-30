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
  const alpha = Math.round(0.55 * glow * 255).toString(16).padStart(2, "0");
  const layer = {
    borderRadius: radius,
    overflow: "hidden",
    backgroundImage: [...blobs, `linear-gradient(180deg, ${stops})`].join(", "),
    // Outer glow spilling out below, light pooling inside from the bottom edge, the milky white rim.
    boxShadow: `0 12px 44px ${palette.glow}${alpha}, inset 0 -22px 30px -6px ${palette.inner}, inset 0 0 14px 4px #FFFFFF5C`,
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
