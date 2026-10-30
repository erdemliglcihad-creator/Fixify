// Web preview version of the soft card: CSS gradients blurred with a filter, grain from ui/Grain.
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Grain } from "./Grain";
import type { SoftPalette } from "./soft.ts";

export function SoftSurface({
  palette,
  radius,
  feather = 9,
  grain = 0.28,
  style,
  children,
}: {
  palette: SoftPalette;
  radius: number;
  feather?: number;
  grain?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const blobs = palette.blobs.map((b) => `radial-gradient(circle at ${b.x * 100}% ${b.y * 100}%, ${b.color} 0%, ${b.color}00 ${b.r * 100}%)`);
  const stops = palette.colors.map((col, i) => `${col} ${palette.positions[i] * 100}%`).join(", ");
  const layer = {
    borderRadius: radius,
    backgroundImage: [...blobs, `linear-gradient(180deg, ${stops})`].join(", "),
    boxShadow: `inset 0 0 0 6px ${palette.rim}8C`,
    filter: `blur(${feather}px)`,
  };
  return (
    <View style={style}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, layer as object]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { margin: feather, borderRadius: radius, overflow: "hidden" }]}>
        <Grain opacity={grain} />
      </View>
      {children}
    </View>
  );
}
