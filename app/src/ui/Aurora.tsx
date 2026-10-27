// Global glowing backdrop (native, Skia). Three heavily blurred color fields drift slowly near the top
// and morph to the current area's colors. Runs on the UI thread, so it never blocks touches.
import { BlurMask, Canvas, Circle, Fill, Group, LinearGradient, Rect, vec } from "@shopify/react-native-skia";
import { useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Easing, interpolateColor, useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useCurrentArea } from "../services/area.ts";
import { areaColors, useTheme } from "./theme.ts";

export function Aurora() {
  const { width, height } = useWindowDimensions();
  const { dark, c } = useTheme();
  const area = useCurrentArea();
  const reduceMotion = useReducedMotion();

  const from = useRef(areaColors[area].glow);
  const fromColors = useSharedValue<string[]>([...areaColors[area].glow]);
  const toColors = useSharedValue<string[]>([...areaColors[area].glow]);
  const progress = useSharedValue(1);
  const time = useSharedValue(0);

  useEffect(() => {
    // Morph: start from where the colors are now, ease into the new area.
    fromColors.value = from.current as unknown as string[];
    toColors.value = [...areaColors[area].glow];
    progress.value = 0;
    progress.value = withTiming(1, { duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    from.current = areaColors[area].glow;
  }, [area]);

  useFrameCallback((frame) => {
    if (!reduceMotion) time.value = (frame.timeSinceFirstFrame ?? 0) / 1000;
  });

  const blend = (i: number) =>
    useDerivedValue(() => interpolateColor(progress.value, [0, 1], [fromColors.value[i], toColors.value[i]]));
  const c0 = blend(0);
  const c1 = blend(1);
  const c2 = blend(2);

  const r = Math.max(width, height) * 0.42;
  const x0 = useDerivedValue(() => width * 0.15 + Math.sin(time.value * 0.21) * width * 0.12);
  const y0 = useDerivedValue(() => height * 0.08 + Math.cos(time.value * 0.17) * height * 0.04);
  const x1 = useDerivedValue(() => width * 0.85 + Math.cos(time.value * 0.19) * width * 0.1);
  const y1 = useDerivedValue(() => height * 0.12 + Math.sin(time.value * 0.23) * height * 0.05);
  const x2 = useDerivedValue(() => width * 0.5 + Math.sin(time.value * 0.13 + 1.3) * width * 0.18);
  const y2 = useDerivedValue(() => height * 0.3 + Math.cos(time.value * 0.11) * height * 0.04);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill color={c.background} />
      <Group opacity={dark ? 0.85 : 0.45}>
        <Circle cx={x0} cy={y0} r={r} color={c0}>
          <BlurMask blur={120} style="normal" />
        </Circle>
        <Circle cx={x1} cy={y1} r={r * 0.9} color={c1}>
          <BlurMask blur={130} style="normal" />
        </Circle>
        <Circle cx={x2} cy={y2} r={r * 0.7} color={c2} opacity={0.6}>
          <BlurMask blur={140} style="normal" />
        </Circle>
      </Group>
      {/* Fade to the base color lower down, so content sits on calm dark (or light) ground. */}
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, height * 0.18)} end={vec(0, height * 0.62)} colors={[`${c.background}00`, c.background]} />
      </Rect>
    </Canvas>
  );
}
