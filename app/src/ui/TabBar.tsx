// Floating glass tab bar with a raised Scan button in the middle.
// The active pill follows on a spring, stretches with its speed and drags a fading ghost behind it
// (a motion-blur look). You can also slide a finger along the bar: the pill tracks 1:1 and the
// release is projected with its velocity, like flicking a real object.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { Tabs } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming, Extrapolation } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCurrentArea } from "../services/area.ts";
import type { IconName } from "./categories.ts";
import { Glass } from "./Glass.tsx";
import { PressScale } from "./motion.tsx";
import { areaColors, useTheme, font } from "./theme.ts";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ["home-outline", "home"],
  fixvoice: ["mic-outline", "mic"],
  library: ["albums-outline", "albums"],
  settings: ["options-outline", "options"],
};
const CENTER = "scan";
const PILL_INSET = 6;

function project(velocity: number) {
  "worklet";
  // Apple's projection: where a flick would come to rest with scroll-like deceleration.
  const rate = 0.99;
  return ((velocity / 1000) * rate) / (1 - rate);
}

export function TabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const area = useCurrentArea();
  const accent = areaColors[area].accent;
  const glow = areaColors[area].glow;
  const [width, setWidth] = useState(0);

  const routes = state.routes;
  const slot = width / Math.max(routes.length, 1);
  const centerIndex = routes.findIndex((r) => r.name === CENTER);

  const x = useSharedValue(0);
  const trail = useSharedValue(0);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (!slot || state.index === centerIndex) return;
    x.value = withSpring(state.index * slot, { duration: 480, dampingRatio: 0.78 });
    trail.value = withSpring(state.index * slot, { duration: 760, dampingRatio: 1 });
  }, [state.index, slot]);

  const focused = descriptors[routes[state.index].key]?.options;
  const hidden = (StyleSheet.flatten(focused?.tabBarStyle) as { display?: string } | undefined)?.display === "none";

  function go(index: number) {
    const route = routes[index];
    if (!route) return;
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      navigateToTab(route.key);
    }
  }

  function settle(index: number) {
    // The finger let go: snap back if it stays on the same tab, otherwise switch.
    if (index === state.index) {
      x.value = withSpring(index * slot, { duration: 420, dampingRatio: 0.75 });
      trail.value = withSpring(index * slot, { duration: 700, dampingRatio: 1 });
    } else go(index);
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onBegin(() => {
      dragging.value = true;
    })
    .onUpdate((e) => {
      const max = (routes.length - 1) * slot;
      x.value = Math.min(Math.max(e.x - slot / 2, 0), max);
      trail.value = withTiming(x.value, { duration: 140 });
    })
    .onEnd((e) => {
      let target = Math.round((x.value + project(e.velocityX)) / slot);
      target = Math.min(Math.max(target, 0), routes.length - 1);
      // Never open the camera by sliding past it; pick the side the finger was heading to.
      if (target === centerIndex) target = e.velocityX >= 0 || x.value > centerIndex * slot ? centerIndex + 1 : centerIndex - 1;
      scheduleOnRN(settle, target);
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  // Main pill: stretches along its direction of travel while it moves fast.
  const pill = useAnimatedStyle(() => {
    const gap = x.value - trail.value;
    const stretch = interpolate(Math.abs(gap), [0, slot || 1], [0, 0.55], Extrapolation.CLAMP);
    return {
      transform: [{ translateX: x.value - gap * 0.25 }, { scaleX: 1 + stretch }, { scaleY: 1 - stretch * 0.22 }],
    };
  });
  // Ghost: lags behind on a softer spring and fades as it catches up.
  const ghost = useAnimatedStyle(() => {
    const gap = Math.abs(x.value - trail.value);
    return {
      opacity: interpolate(gap, [0, slot || 1], [0, 0.45], Extrapolation.CLAMP),
      transform: [{ translateX: trail.value }, { scaleX: 1 + interpolate(gap, [0, slot || 1], [0, 0.9], Extrapolation.CLAMP) }],
    };
  });

  if (hidden) return null;

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom - 6, 12) }]} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.bar}>
          <Glass style={[StyleSheet.absoluteFill, { borderRadius: 34 }]} />
          {slot > 0 && (
            <>
              <Animated.View pointerEvents="none" style={[styles.pill, { width: slot - PILL_INSET * 2, backgroundColor: accent + "40" }, ghost]} />
              <Animated.View
                pointerEvents="none"
                style={[styles.pill, { width: slot - PILL_INSET * 2, backgroundColor: accent + (dark ? "33" : "26"), borderColor: accent + "66" }, pill]}
              />
            </>
          )}
          {routes.map((route, index) => {
            const options = descriptors[route.key]?.options;
            const label = typeof options?.title === "string" ? options.title : route.name;
            const active = state.index === index;
            if (route.name === CENTER) {
              return (
                <View key={route.key} style={styles.slot}>
                  <PressScale
                    onPress={() => go(index)}
                    haptic="medium"
                    scaleTo={0.9}
                    accessibilityLabel={label}
                    style={[styles.center, { boxShadow: `0 8px 24px ${glow[0]}88, 0 0 0 4px ${dark ? "#06070B" : "#F4F5F7"}` }]}
                  >
                    <LinearGradient colors={[glow[2], glow[0], glow[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    <Ionicons name="scan" size={26} color="#fff" />
                  </PressScale>
                </View>
              );
            }
            const [off, on] = ICONS[route.name] ?? ["ellipse-outline", "ellipse"];
            return (
              <Pressable
                key={route.key}
                onPress={() => go(index)}
                accessibilityRole="tab"
                aria-selected={active}
                accessibilityLabel={label}
                style={styles.slot}
              >
                <Ionicons name={active ? on : off} size={22} color={active ? accent : c.secondary} />
                <Text numberOfLines={1} style={[styles.label, { color: active ? c.text : c.secondary }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  bar: { flexDirection: "row", height: 68, borderRadius: 34, alignItems: "center" },
  slot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, height: "100%" },
  pill: { position: "absolute", left: PILL_INSET, top: PILL_INSET, bottom: PILL_INSET, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent" },
  label: { fontSize: 10.5, fontFamily: font.semibold, letterSpacing: 0.1 },
  center: { width: 60, height: 60, borderRadius: 30, marginTop: -26, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
