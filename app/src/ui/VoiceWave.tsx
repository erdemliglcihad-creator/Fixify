// FixVoice wave (native, Skia): a ribbon of thin lines that twists across the screen and swings with the
// voice: yours while listening, FixVoice's while it speaks, a slow breath while thinking. Touch it and it
// bends toward your finger.
// The crisp lines are one path without blur; the glow is a single thick, blurred centerline plus a soft halo,
// which keeps every frame cheap (a blurred copy of all lines made the iPhone drop frames and stutter).
import { BlurMask, Canvas, Circle, Group, LinearGradient, Path, RadialGradient, usePathValue, vec } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { follow } from "./smooth.ts";
import type { OrbMode } from "./VoiceOrb";

type Props = { level: SharedValue<number>; mode: OrbMode; width: number; height: number; colors: readonly [string, string, string] };

const LINES = 16;
const POINTS = 64;
/** Room above and below for the swing and the glow, so nothing is ever cut off at the canvas edge. */
const PAD = 40;

const touchTick = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
};

export function VoiceWave({ level, mode, width: W, height: H, colors }: Props) {
  const reduceMotion = useReducedMotion();
  const time = useSharedValue(0);
  const energy = useSharedValue(0.1);
  const thinking = useSharedValue(0);
  thinking.value = mode === "thinking" ? 1 : 0;
  // Finger on the wave: where it is, and how strongly the ribbon is pulled toward it (eased in and out).
  const touchX = useSharedValue(W / 2);
  const touchY = useSharedValue(PAD + H / 2);
  const touching = useSharedValue(0);
  const pull = useSharedValue(0);

  useFrameCallback((f) => {
    if (!reduceMotion) time.value = (f.timeSinceFirstFrame ?? 0) / 1000;
    const dt = f.timeSincePreviousFrame ?? 16;
    // The swing glides toward the voice (rising a bit faster than it settles), so it never jitters.
    const target = 0.1 + level.value * 0.9 + pull.value * 0.25;
    energy.value = follow(energy.value, target, dt, target > energy.value ? 300 : 700);
    pull.value = follow(pull.value, touching.value, dt, touching.value ? 140 : 450);
  });

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      touchX.value = e.x;
      touchY.value = e.y;
      touching.value = 1;
      scheduleOnRN(touchTick);
    })
    .onUpdate((e) => {
      touchX.value = e.x;
      touchY.value = e.y;
    })
    .onFinalize(() => {
      touching.value = 0;
    });

  const cy = PAD + H / 2;
  // y of line u at position s (0…1) across the screen.
  const lineY = (u: number, s: number, t: number, e: number, tx: number, ty: number, p: number) => {
    "worklet";
    const env = 0.35 + 0.65 * Math.sin(Math.PI * s);
    const swing = Math.sin(s * Math.PI * 2.4 + t * 1.1 + u * 1.4) * (0.22 + e * 0.9);
    const twist = u * Math.cos(s * Math.PI * 1.6 - t * 0.7) * (0.35 + e * 0.8);
    // Stays within about ±0.43 H at full voice, so the ribbon stretches but never leaves the canvas.
    const y = cy + H * (0.26 * env * swing + 0.24 * twist);
    // The finger pulls a soft bump out of the ribbon around its position.
    const dx = (s * W - tx) / (W * 0.2);
    const toward = Math.max(-H * 0.45, Math.min(H * 0.45, ty - cy));
    return y + toward * p * Math.exp(-dx * dx) * 0.8;
  };

  const ribbon = usePathValue((path) => {
    "worklet";
    const t = time.value;
    const e = Math.min(1, energy.value + thinking.value * 0.12 * (0.5 + 0.5 * Math.sin(t * 2.4)));
    for (let i = 0; i < LINES; i++) {
      const u = i / (LINES - 1) - 0.5;
      let px = 0;
      let py = 0;
      for (let k = 0; k <= POINTS; k++) {
        const s = k / POINTS;
        const x = s * W;
        const y = lineY(u, s, t, e, touchX.value, touchY.value, pull.value);
        // Curves through the midpoints instead of straight segments: smooth even when strongly stretched.
        if (k === 0) path.moveTo(x, y);
        else path.quadTo(px, py, (px + x) / 2, (py + y) / 2);
        px = x;
        py = y;
      }
      path.lineTo(px, py);
    }
  });

  const center = usePathValue((path) => {
    "worklet";
    const t = time.value;
    const e = Math.min(1, energy.value);
    for (let k = 0; k <= 32; k++) {
      const s = k / 32;
      const y = lineY(0, s, t, e, touchX.value, touchY.value, pull.value);
      if (k === 0) path.moveTo(0, y);
      else path.lineTo(s * W, y);
    }
  });

  // A soft halo behind the ribbon that breathes with the voice and follows the finger.
  const haloC = useDerivedValue(() => vec(W / 2 + (touchX.value - W / 2) * pull.value * 0.6, cy));
  const haloR = useDerivedValue(() => W * (0.32 + energy.value * 0.22));

  const shade = <LinearGradient start={vec(0, 0)} end={vec(W, 0)} colors={[colors[2], colors[0], "#FFFFFF", colors[0], colors[2]]} positions={[0, 0.3, 0.5, 0.72, 1]} />;
  return (
    <GestureDetector gesture={pan}>
      <Canvas style={{ width: W, height: H + PAD * 2, marginVertical: -PAD }}>
        <Circle c={haloC} r={haloR} opacity={0.55}>
          <RadialGradient c={haloC} r={haloR} colors={[`${colors[2]}88`, `${colors[0]}44`, `${colors[0]}00`]} />
        </Circle>
        <Group blendMode="screen">
          <Path path={center} style="stroke" strokeWidth={26} opacity={0.5} strokeCap="round">
            {shade}
            <BlurMask blur={22} style="normal" />
          </Path>
          <Path path={center} style="stroke" strokeWidth={6} opacity={0.6} strokeCap="round">
            {shade}
            <BlurMask blur={6} style="normal" />
          </Path>
          <Path path={ribbon} style="stroke" strokeWidth={1} opacity={0.95}>
            {shade}
          </Path>
        </Group>
      </Canvas>
    </GestureDetector>
  );
}
