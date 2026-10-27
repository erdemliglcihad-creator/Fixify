// Glowing wave orb for the voice mode (Skia, UI thread). Wave rings wobble with the voice level:
// your microphone while listening, word pulses while FixBot speaks, a slow breath while thinking.
import { BlurMask, Canvas, Circle, Group, Path, RadialGradient, usePathValue, vec } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";

export type OrbMode = "idle" | "listening" | "thinking" | "speaking";

type Props = { level: SharedValue<number>; mode: OrbMode; size?: number; colors: readonly [string, string, string] };

const POINTS = 120;

export function VoiceOrb({ level, mode, size = 300, colors }: Props) {
  const reduceMotion = useReducedMotion();
  const time = useSharedValue(0);
  const thinking = useSharedValue(0);
  thinking.value = mode === "thinking" ? 1 : 0;

  useFrameCallback((frame) => {
    if (!reduceMotion) time.value = (frame.timeSinceFirstFrame ?? 0) / 1000;
  });

  const c = size / 2;
  const R = size * 0.27;
  // Energy: a calm minimum so the orb always breathes a little, plus the live level.
  const energy = useDerivedValue(() => 0.14 + level.value * 0.86 + thinking.value * 0.18 * (0.5 + 0.5 * Math.sin(time.value * 3)));

  const ring = (lobes: number, speed: number, phase: number, amp: number, scale: number) =>
    usePathValue((p) => {
      "worklet";
      const t = time.value;
      const e = energy.value;
      for (let i = 0; i <= POINTS; i++) {
        const a = (i / POINTS) * Math.PI * 2;
        const wobble = Math.sin(a * lobes + t * speed + phase) * 0.6 + Math.sin(a * (lobes + 2) - t * speed * 0.7 + phase * 2) * 0.4;
        const r = R * scale * (1 + wobble * amp * e);
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        if (i === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
      p.close();
    });

  const fill = ring(3, 1.1, 0, 0.12, 1);
  const r1 = ring(4, 1.6, 1.2, 0.16, 1.08);
  const r2 = ring(5, -1.3, 2.4, 0.2, 1.16);
  const r3 = ring(2, 0.9, 3.9, 0.24, 1.26);

  const glowR = useDerivedValue(() => R * (1.55 + energy.value * 0.45));
  const coreR = useDerivedValue(() => R * (0.62 + energy.value * 0.12));

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Circle cx={c} cy={c} r={glowR} color={colors[0]} opacity={0.45}>
        <BlurMask blur={size * 0.16} style="normal" />
      </Circle>
      <Group blendMode="screen">
        <Path path={fill} opacity={0.55}>
          <RadialGradient c={vec(c, c)} r={R * 1.3} colors={["#FFFFFF", colors[2], colors[0], `${colors[1]}00`]} positions={[0, 0.25, 0.7, 1]} />
          <BlurMask blur={6} style="solid" />
        </Path>
        <Path path={r1} style="stroke" strokeWidth={2.5} color={colors[2]} opacity={0.9}>
          <BlurMask blur={3} style="solid" />
        </Path>
        <Path path={r2} style="stroke" strokeWidth={2} color={colors[0]} opacity={0.75}>
          <BlurMask blur={4} style="solid" />
        </Path>
        <Path path={r3} style="stroke" strokeWidth={1.5} color={colors[1]} opacity={0.6}>
          <BlurMask blur={6} style="solid" />
        </Path>
        <Circle cx={c} cy={c} r={coreR} opacity={0.9}>
          <RadialGradient c={vec(c, c)} r={R * 0.75} colors={["#FFFFFFEE", `${colors[2]}AA`, `${colors[0]}00`]} />
          <BlurMask blur={14} style="normal" />
        </Circle>
      </Group>
    </Canvas>
  );
}
