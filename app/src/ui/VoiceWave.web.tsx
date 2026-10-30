// Web preview fallback for the Skia wave: a few soft gradient strands that sway and stretch with the level.
import { View } from "react-native";
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import type { OrbMode } from "./VoiceOrb";

type Props = { level: SharedValue<number>; mode: OrbMode; width: number; height: number; colors: readonly [string, string, string] };

const STRANDS = [-0.3, -0.1, 0.1, 0.3];

export function VoiceWave({ level, width, height, colors }: Props) {
  const time = useSharedValue(0);
  useFrameCallback((f) => {
    time.value = (f.timeSinceFirstFrame ?? 0) / 1000;
  });
  return (
    <View style={{ width, height, justifyContent: "center" }} pointerEvents="none">
      {STRANDS.map((o, i) => (
        <Strand key={i} offset={o} index={i} time={time} level={level} width={width} height={height} colors={colors} />
      ))}
    </View>
  );
}

function Strand({ offset, index, time, level, width, height, colors }: { offset: number; index: number; time: SharedValue<number>; level: SharedValue<number>; width: number; height: number; colors: readonly [string, string, string] }) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: offset * height * 0.5 + Math.sin(time.value * 1.1 + index) * height * (0.06 + level.value * 0.2) },
      { scaleY: 1 + level.value * 2 },
      { rotate: `${Math.sin(time.value * 0.7 + index) * 0.08}rad` },
    ],
  }));
  return (
    <Animated.View
      style={[
        { position: "absolute", left: 0, width, height: 2, borderRadius: 1, backgroundImage: `linear-gradient(90deg, ${colors[2]}, ${colors[0]}, #FFFFFF, ${colors[0]}, ${colors[2]})`, filter: "blur(0.5px)", boxShadow: `0 0 12px ${colors[0]}` } as object,
        style,
      ]}
    />
  );
}
