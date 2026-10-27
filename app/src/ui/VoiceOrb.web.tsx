// Web preview fallback for the Skia orb: layered CSS glows that scale and spin with the level.
import { View } from "react-native";
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import type { OrbMode } from "./VoiceOrb.tsx";

export type { OrbMode };

export function VoiceOrb({ level, size = 300, colors }: { level: SharedValue<number>; mode: OrbMode; size?: number; colors: readonly [string, string, string] }) {
  const time = useSharedValue(0);
  useFrameCallback((f) => {
    time.value = (f.timeSinceFirstFrame ?? 0) / 1000;
  });
  const ring = (speed: number, base: number, amp: number) =>
    useAnimatedStyle(() => ({
      transform: [{ rotate: `${time.value * speed}rad` }, { scale: base + (0.14 + level.value) * amp + Math.sin(time.value * 2 + speed) * 0.02 }],
    }));
  const glow = ring(0, 1, 0.35);
  const a = ring(0.6, 0.9, 0.18);
  const b = ring(-0.45, 0.96, 0.24);
  const blob = (s: number) => ({ position: "absolute" as const, width: size * s, height: size * s, borderRadius: size, left: (size - size * s) / 2, top: (size - size * s) / 2 });
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Animated.View style={[blob(0.9), { backgroundColor: colors[0], opacity: 0.4, filter: "blur(48px)" } as object, glow]} />
      <Animated.View style={[blob(0.62), { borderWidth: 2, borderColor: colors[2], borderTopLeftRadius: size * 0.4, borderBottomRightRadius: size * 0.3, filter: "blur(1.5px)" } as object, a]} />
      <Animated.View style={[blob(0.66), { borderWidth: 1.5, borderColor: colors[1], borderTopRightRadius: size * 0.42, borderBottomLeftRadius: size * 0.28, filter: "blur(2px)" } as object, b]} />
      <Animated.View
        style={[
          blob(0.5),
          { backgroundImage: `radial-gradient(circle, #FFFFFFEE 0%, ${colors[2]}AA 35%, ${colors[0]}00 70%)`, filter: "blur(6px)" } as object,
          glow,
        ]}
      />
    </View>
  );
}
