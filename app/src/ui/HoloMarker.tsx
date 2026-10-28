// Cyan holographic marker for tapped objects: a soft glow, two tilted rings turning (reads as 3D),
// a scan line passing through and the spot's number. Pops in on tap, never blocks touches.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { font } from "./theme.ts";

export const HOLO = "#2EF2FF";
const SIZE = 132;

export function HoloMarker({ x, y, n }: { x: number; y: number; n: number }) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(0);
  const spin = useSharedValue(0);
  const scan = useSharedValue(0);

  useEffect(() => {
    pop.value = withSpring(1, { duration: 520, dampingRatio: 0.7 });
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false);
    scan.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);

  const root = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.6 + pop.value * 0.4 }] }));
  const ringA = useAnimatedStyle(() => ({ transform: [{ perspective: 400 }, { rotateX: "62deg" }, { rotateZ: `${spin.value * 360}deg` }] }));
  const ringB = useAnimatedStyle(() => ({ transform: [{ perspective: 400 }, { rotateY: "64deg" }, { rotateZ: `${-spin.value * 360}deg` }] }));
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: (scan.value - 0.5) * SIZE * 0.62 }] }));

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { left: x - SIZE / 2, top: y - SIZE / 2 }, root]}>
      <View style={styles.glow} />
      <View style={styles.core}>
        <Animated.View style={[styles.scan, line]} />
      </View>
      <Animated.View style={[styles.ring, ringA]} />
      <Animated.View style={[styles.ring, styles.ringInner, ringB]} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{n}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  glow: {
    position: "absolute",
    width: SIZE * 0.7,
    height: SIZE * 0.7,
    borderRadius: SIZE,
    backgroundColor: `${HOLO}1F`,
    boxShadow: `0 0 34px ${HOLO}99, inset 0 0 22px ${HOLO}66`,
  },
  core: {
    width: SIZE * 0.62,
    height: SIZE * 0.62,
    borderRadius: SIZE,
    borderWidth: 1.5,
    borderColor: `${HOLO}CC`,
    backgroundColor: `${HOLO}14`,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  scan: { width: "100%", height: 2, backgroundColor: HOLO, opacity: 0.85, boxShadow: `0 0 10px ${HOLO}` },
  ring: { position: "absolute", width: SIZE * 0.92, height: SIZE * 0.92, borderRadius: SIZE, borderWidth: 1.5, borderColor: `${HOLO}AA` },
  ringInner: { width: SIZE * 0.78, height: SIZE * 0.78, borderColor: `${HOLO}77` },
  badge: {
    position: "absolute",
    top: SIZE * 0.06,
    right: SIZE * 0.1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: HOLO,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 0 12px ${HOLO}`,
  },
  badgeText: { color: "#00262A", fontFamily: font.bold, fontSize: 13 },
});
