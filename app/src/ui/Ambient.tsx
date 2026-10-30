// The backdrop behind every screen: dark ground with two soft lights in the theme colors (top right,
// bottom left) drifting very slowly, plus film grain. Quiet enough that the cards stay the brightest thing.
import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { Grain } from "./Grain";
import { useTheme } from "./theme.ts";

export function Ambient() {
  const { width: W, height: H } = useWindowDimensions();
  const { dark, brand } = useTheme();
  const reduceMotion = useReducedMotion();
  const time = useSharedValue(0);
  useFrameCallback((f) => {
    if (!reduceMotion) time.value = (f.timeSinceFirstFrame ?? 0) / 1000;
  });
  // Slow Lissajous paths, about half a minute per loop, never in sync.
  const a = useDerivedValue(() => vec(W * (0.82 + 0.14 * Math.sin(time.value * 0.21)), H * (0.12 + 0.08 * Math.cos(time.value * 0.17))));
  const b = useDerivedValue(() => vec(W * (0.12 + 0.12 * Math.cos(time.value * 0.19)), H * (0.86 + 0.08 * Math.sin(time.value * 0.13))));
  const strength = dark ? "66" : "2E";
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle c={a} r={W * 0.95}>
          <RadialGradient c={a} r={W * 0.95} colors={[`${brand.lights[0]}${strength}`, `${brand.lights[0]}00`]} />
        </Circle>
        <Circle c={b} r={W * 0.85}>
          <RadialGradient c={b} r={W * 0.85} colors={[`${brand.lights[1]}${strength}`, `${brand.lights[1]}00`]} />
        </Circle>
      </Canvas>
      <Grain opacity={dark ? 0.16 : 0.1} />
    </View>
  );
}
