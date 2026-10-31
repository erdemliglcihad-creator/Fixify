// The backdrop behind every screen: dark ground with four soft gradients in the theme colors that drift
// slowly and react when you tilt the iPhone (each at its own depth, like parallax behind glass), plus film
// grain. Quiet enough that the cards stay the brightest thing.
import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { SensorType, useAnimatedSensor, useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { activeBackground, useSettings } from "../services/settings.ts";
import { CustomBackdrop } from "./CustomBackdrop.tsx";
import { Grain } from "./Grain";
import { follow } from "./smooth.ts";
import { useTheme } from "./theme.ts";

export function Ambient() {
  // Your own picture or video replaces the lights and grain (Settings > Background).
  const background = activeBackground(useSettings());
  if (background) return <CustomBackdrop background={background} />;
  return <Lights />;
}

/** Where each light rests (fractions of the screen), how far it drifts, how strongly it follows the tilt. */
type LightSpec = { x: number; y: number; r: number; drift: number; speed: number; depth: number; color: string };

function Lights() {
  const { width: W, height: H } = useWindowDimensions();
  const { dark, brand } = useTheme();
  const reduceMotion = useReducedMotion();
  const time = useSharedValue(0);
  // Tilt: gravity seen by the phone, eased so the lights glide instead of shaking with the hand.
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: "auto" });
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  useFrameCallback((f) => {
    if (reduceMotion) return;
    time.value = (f.timeSinceFirstFrame ?? 0) / 1000;
    const g = gravity.sensor.value;
    const dt = f.timeSincePreviousFrame ?? 16;
    tiltX.value = follow(tiltX.value, Math.max(-1, Math.min(1, g.x / 9.81)), dt, 400);
    tiltY.value = follow(tiltY.value, Math.max(-1, Math.min(1, (g.y + 6) / 9.81)), dt, 400);
  });

  const lights: LightSpec[] = [
    { x: 0.82, y: 0.12, r: 0.95, drift: 0.12, speed: 0.21, depth: 0.18, color: brand.lights[0] },
    { x: 0.12, y: 0.86, r: 0.85, drift: 0.1, speed: 0.17, depth: 0.12, color: brand.lights[1] },
    { x: 0.2, y: 0.4, r: 0.6, drift: 0.14, speed: 0.13, depth: 0.28, color: "#261598" },
    { x: 0.85, y: 0.62, r: 0.55, drift: 0.12, speed: 0.24, depth: 0.22, color: "#3D2BD8" },
  ];
  const strength = dark ? "5C" : "2A";
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        {lights.map((l, i) => (
          <Light key={i} spec={l} index={i} W={W} H={H} time={time} tiltX={tiltX} tiltY={tiltY} strength={strength} />
        ))}
      </Canvas>
      <Grain opacity={dark ? 0.16 : 0.1} />
    </View>
  );
}

function Light({ spec, index, W, H, time, tiltX, tiltY, strength }: { spec: LightSpec; index: number; W: number; H: number; time: SharedValue<number>; tiltX: SharedValue<number>; tiltY: SharedValue<number>; strength: string }) {
  // A slow Lissajous drift (never in sync with the others) plus the tilt, deeper lights moving further.
  const c = useDerivedValue(() =>
    vec(
      W * (spec.x + spec.drift * Math.sin(time.value * spec.speed + index * 1.7) + tiltX.value * spec.depth),
      H * (spec.y + spec.drift * 0.7 * Math.cos(time.value * spec.speed * 0.8 + index) - tiltY.value * spec.depth * 0.6),
    ),
  );
  // The size breathes a little, so the gradients never look like fixed circles.
  const r = useDerivedValue(() => W * spec.r * (1 + 0.08 * Math.sin(time.value * spec.speed * 1.3 + index * 2.1)));
  return (
    <Circle c={c} r={r}>
      <RadialGradient c={c} r={r} colors={[`${spec.color}${strength}`, `${spec.color}00`]} />
    </Circle>
  );
}
