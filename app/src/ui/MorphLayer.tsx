// Draws the card morph above everything: the card's colors grow from its frame to the whole screen,
// the action runs underneath, then the layer fades out to reveal the new screen.
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { morphDone, morphStore } from "../services/morph.ts";
import { useStore } from "../services/store.ts";
import { Grain } from "./Grain";
import { SOFT } from "./soft.ts";

const GROW = 420;

export function MorphLayer() {
  const morph = useStore(morphStore);
  const { width: W, height: H } = useWindowDimensions();
  const p = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (!morph) return;
    const run = morph.run;
    const reveal = () => {
      run();
      fade.value = withDelay(140, withTiming(0, { duration: 340 }, (done) => done && scheduleOnRN(morphDone)));
    };
    p.value = 0;
    fade.value = 1;
    p.value = withTiming(1, { duration: GROW, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }, (done) => done && scheduleOnRN(reveal));
  }, [morph?.id]);

  const style = useAnimatedStyle(() => {
    if (!morph) return { opacity: 0 };
    const f = morph.frame;
    return {
      opacity: fade.value,
      left: interpolate(p.value, [0, 1], [f.x, 0]),
      top: interpolate(p.value, [0, 1], [f.y, 0]),
      width: interpolate(p.value, [0, 1], [f.width, W]),
      height: interpolate(p.value, [0, 1], [f.height, H]),
      borderRadius: interpolate(p.value, [0, 1], [morph.radius, 0]),
    };
  });

  if (!morph) return null;
  const palette = SOFT[morph.tone];
  return (
    <Animated.View pointerEvents="none" style={[styles.layer, style]}>
      <LinearGradient colors={palette.colors as [string, string, ...string[]]} locations={palette.positions as [number, number, ...number[]]} style={StyleSheet.absoluteFill} />
      <Grain opacity={0.2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", overflow: "hidden", borderCurve: "continuous" },
});
