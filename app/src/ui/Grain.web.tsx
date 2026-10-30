// Web preview version of the grain: an SVG turbulence texture, desaturated.
import { StyleSheet, View } from "react-native";

const NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.24" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`;

export function Grain({ opacity = 0.12 }: { opacity?: number }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, backgroundImage: NOISE, mixBlendMode: "overlay" } as object]} />;
}
