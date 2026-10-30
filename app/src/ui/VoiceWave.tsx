// FixVoice wave (native, Skia): a ribbon of thin lines that twists across the screen and swings with the
// voice: yours while listening, FixVoice's while it speaks, a slow breath while thinking.
// All lines are one path, drawn twice: a soft glow underneath and the crisp lines on top.
import { BlurMask, Canvas, Group, LinearGradient, Path, usePathValue, vec } from "@shopify/react-native-skia";
import { useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { follow } from "./smooth.ts";
import type { OrbMode } from "./VoiceOrb";

type Props = { level: SharedValue<number>; mode: OrbMode; width: number; height: number; colors: readonly [string, string, string] };

const LINES = 18;
const POINTS = 72;

export function VoiceWave({ level, mode, width: W, height: H, colors }: Props) {
  const reduceMotion = useReducedMotion();
  const time = useSharedValue(0);
  const energy = useSharedValue(0.1);
  const thinking = useSharedValue(0);
  thinking.value = mode === "thinking" ? 1 : 0;

  useFrameCallback((f) => {
    if (!reduceMotion) time.value = (f.timeSinceFirstFrame ?? 0) / 1000;
    // The swing eases toward the voice every frame (rising a bit faster than it settles), so it never twitches.
    const target = 0.1 + level.value * 0.9;
    energy.value = follow(energy.value, target, f.timeSincePreviousFrame ?? 16, target > energy.value ? 160 : 420);
  });

  const cy = H / 2;
  const ribbon = usePathValue((p) => {
    "worklet";
    const t = time.value;
    const e = energy.value + thinking.value * 0.12 * (0.5 + 0.5 * Math.sin(t * 2.4));
    for (let i = 0; i < LINES; i++) {
      // u runs across the ribbon (-0.5 … 0.5); the ribbon twists because its width swings with x and time.
      const u = i / (LINES - 1) - 0.5;
      for (let k = 0; k <= POINTS; k++) {
        const s = k / POINTS;
        const env = 0.35 + 0.65 * Math.sin(Math.PI * s);
        const swing = Math.sin(s * Math.PI * 2.4 + t * 1.1 + u * 1.4) * (0.22 + e * 0.9);
        const twist = u * Math.cos(s * Math.PI * 1.6 - t * 0.7) * (0.35 + e * 0.8);
        const y = cy + H * 0.36 * env * swing + H * 0.42 * twist;
        if (k === 0) p.moveTo(0, y);
        else p.lineTo(s * W, y);
      }
    }
  });

  const shade = <LinearGradient start={vec(0, 0)} end={vec(W, 0)} colors={[colors[2], colors[0], "#FFFFFF", colors[0], colors[2]]} positions={[0, 0.3, 0.5, 0.72, 1]} />;
  return (
    <Canvas style={{ width: W, height: H }} pointerEvents="none">
      <Group blendMode="screen">
        <Path path={ribbon} style="stroke" strokeWidth={3} opacity={0.45}>
          {shade}
          <BlurMask blur={8} style="normal" />
        </Path>
        <Path path={ribbon} style="stroke" strokeWidth={1} opacity={0.9}>
          {shade}
        </Path>
      </Group>
    </Canvas>
  );
}
